/**
 * A durable record of task toggles that have been shown to the user but not
 * yet confirmed by the server.
 *
 * Ticking a box flips the UI immediately and fires one POST. Nothing used to
 * retry that POST, so any write that failed to land was simply gone: the tab
 * closed or backgrounded mid-flight (the browser aborts in-flight fetches on
 * dismissal), the phone dropped off the network, the request errored. When the
 * page was already gone the `.catch` that reverts the checkbox never even ran,
 * so no error was ever shown.
 *
 * It was worse than a plain lost write, because App.tsx's on-device snapshot is
 * written from the *optimistic* state: the next launch painted the task as done
 * and only un-ticked it once the server's own answer arrived. It looked saved,
 * then silently wasn't -- which is exactly the "sometimes my progress doesn't
 * save" report.
 *
 * So every intent is written here BEFORE its request goes out, and removed only
 * once the server has confirmed it. Anything still present on the next launch,
 * or the next time the device comes back online, gets replayed.
 *
 * Keyed by user+task+day, so repeatedly toggling one box collapses to its
 * latest intent rather than queueing a stack of contradictory writes -- the
 * server's completions table is a set, so last-write-wins is the correct model.
 */

export type OutboxEntry = {
  userId: number;
  taskId: number;
  day: string;
  done: boolean;
  /** When the user actually tapped, used only to replay in the original order. */
  ts: number;
};

const KEY = "75hard.outbox.v1";

/**
 * A ceiling so a device that is offline for a long stretch cannot grow this
 * without bound and blow the localStorage quota -- which would take the
 * snapshot down with it, since they share the same storage.
 */
const MAX_ENTRIES = 200;

const idOf = (e: { userId: number; taskId: number; day: string }) =>
  `${e.userId}:${e.taskId}:${e.day}`;

const isEntry = (v: unknown): v is OutboxEntry => {
  const e = v as OutboxEntry | null;
  return (
    !!e &&
    typeof e.userId === "number" &&
    typeof e.taskId === "number" &&
    typeof e.day === "string" &&
    typeof e.done === "boolean" &&
    typeof e.ts === "number"
  );
};

const read = (): Record<string, OutboxEntry> => {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    // Drop anything malformed rather than letting one bad row poison replay.
    const out: Record<string, OutboxEntry> = {};
    for (const [k, v] of Object.entries(parsed)) if (isEntry(v)) out[k] = v;
    return out;
  } catch {
    return {};
  }
};

const write = (map: Record<string, OutboxEntry>) => {
  try {
    const entries = Object.entries(map);
    const trimmed =
      entries.length <= MAX_ENTRIES
        ? entries
        : entries.sort((a, b) => b[1].ts - a[1].ts).slice(0, MAX_ENTRIES);
    localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(trimmed)));
  } catch {
    // Quota or blocked storage. The outbox is a safety net, not the source of
    // truth -- losing it costs the retry, not the tick the server already has.
  }
};

/** Record an intent before its request goes out. */
export function remember(entry: OutboxEntry): void {
  const map = read();
  map[idOf(entry)] = entry;
  write(map);
}

/** Drop an intent -- the server has confirmed it, or it can never succeed. */
export function forget(entry: { userId: number; taskId: number; day: string }): void {
  const map = read();
  delete map[idOf(entry)];
  write(map);
}

/** Everything still unconfirmed, oldest tap first. */
export function pending(): OutboxEntry[] {
  return Object.values(read()).sort((a, b) => a.ts - b.ts);
}

/**
 * Resend everything outstanding. Returns how many the server accepted, so the
 * caller knows whether it is worth repainting from the server.
 *
 * `skip` keeps replay from racing a write this session is already making --
 * the live request is newer than anything parked here, and two writes for one
 * task disagreeing is the exact fault this whole path exists to avoid.
 */
export async function replay(
  send: (entry: OutboxEntry) => Promise<unknown>,
  opts: {
    today: string;
    skip?: (entry: OutboxEntry) => boolean;
    isPermanentFailure?: (err: unknown) => boolean;
  }
): Promise<number> {
  let flushed = 0;

  for (const entry of pending()) {
    if (opts.skip?.(entry)) continue;

    // The server seals a day once it is over ("that day is locked"), so an
    // entry from an earlier day can never be accepted. Retrying it forever
    // would block every entry behind it -- drop it instead.
    if (entry.day !== opts.today) {
      forget(entry);
      continue;
    }

    try {
      await send(entry);
      forget(entry);
      flushed += 1;
    } catch (err) {
      if (opts.isPermanentFailure?.(err)) {
        // A rejection, not a delivery problem: it will fail identically
        // forever, so holding on to it only blocks the queue.
        forget(entry);
        continue;
      }
      // Almost certainly still offline. Stop rather than firing the rest into
      // the same failure; the next online event or launch picks up where this
      // left off.
      break;
    }
  }

  return flushed;
}
