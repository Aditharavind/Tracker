import type { DayCell } from "../types";
import { prettyDate } from "../api";

export default function Calendar75({
  cells,
  onPick,
}: {
  cells: DayCell[];
  onPick: (iso: string) => void;
}) {
  const done = cells.filter((c) => c.status === "done").length;

  return (
    <div className="card">
      <div className="card-head">
        <h2>The 75</h2>
        <span className="count num">{done} banked</span>
      </div>

      <div className="grid75">
        {cells.map((c) => (
          <button
            key={c.index}
            className={`cell ${c.status}`}
            onClick={() => c.status !== "future" && onPick(c.day)}
            title={`Day ${c.index} - ${prettyDate(c.day)} - ${c.done}/${c.total}`}
            aria-label={`day ${c.index}, ${c.status}`}
          />
        ))}
      </div>

      <div className="legend">
        <span>
          <i className="swatch" style={{ background: "var(--accent)" }} /> perfect
        </span>
        <span>
          <i
            className="swatch"
            style={{ background: "color-mix(in srgb, var(--bad) 45%, var(--line-soft))" }}
          />{" "}
          partial
        </span>
        <span>
          <i
            className="swatch"
            style={{ background: "color-mix(in srgb, var(--bad) 26%, var(--line-soft))" }}
          />{" "}
          missed
        </span>
        <span>
          <i
            className="swatch"
            style={{ background: "var(--raised)", boxShadow: "inset 0 0 0 1px var(--accent)" }}
          />{" "}
          today
        </span>
      </div>
    </div>
  );
}
