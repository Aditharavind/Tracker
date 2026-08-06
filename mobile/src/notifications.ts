import * as Notifications from "expo-notifications";

import { api } from "./api";
import type { AlarmStage, Schedule } from "./types";

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

// Escalating, non-shaming copy: the T-10 nudge is more direct than T-30, but
// never guilt-trips -- see the design doc's feasibility section on why an
// over-notifying coach gets its notifications silenced.
const COPY: Record<AlarmStage, (title: string) => string> = {
  t30: (title) => `In 30 minutes: ${title}. Plenty of time to wrap up what you're doing.`,
  t10: (title) => `10 minutes to ${title} -- worth starting to wind down now.`,
};

function timeMinusMinutes(hhmm: string, minutes: number): { hour: number; minute: number } {
  const [h, m] = hhmm.split(":").map(Number);
  const total = (((h * 60 + m - minutes) % 1440) + 1440) % 1440;
  return { hour: Math.floor(total / 60), minute: total % 60 };
}

export async function requestNotificationPermission(): Promise<boolean> {
  const { status } = await Notifications.requestPermissionsAsync();
  return status === "granted";
}

/** Schedules T-30 and T-10 local notifications for every block in today's
 * schedule. These fire from the device itself -- no server push needed --
 * so alarms still go off even if the backend or network is unreachable at
 * that moment. Re-run this after every replan (including a partial one). */
export async function scheduleBlockAlarms(schedule: Schedule, coachUserId: number): Promise<void> {
  await Notifications.cancelAllScheduledNotificationsAsync();

  for (const block of schedule.blocks) {
    if (block.status !== "pending") continue;
    for (const stage of ["t30", "t10"] as const) {
      const { hour, minute } = timeMinusMinutes(block.start_time, stage === "t30" ? 30 : 10);
      await Notifications.scheduleNotificationAsync({
        content: {
          title: block.title,
          body: COPY[stage](block.title),
          data: { blockId: block.id, coachUserId, stage },
        },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DAILY,
          hour,
          minute,
        },
      });
    }
  }
}

/** Reports an "ack" event the moment the user taps a block's notification.
 *
 * Detecting the *other* outcome -- an alarm the user let sit unopened -- is
 * NOT implemented here. Reliably knowing "10 minutes passed with no tap"
 * needs a background task (e.g. expo-background-task) that keeps running
 * with the app killed; that's the fast-follow flagged in the design doc,
 * not built in this scaffold pass. Returns an unsubscribe function. */
export function registerNotificationHandlers(): () => void {
  const sub = Notifications.addNotificationResponseReceivedListener((response) => {
    const data = response.notification.request.content.data as {
      blockId?: number;
      coachUserId?: number;
      stage?: AlarmStage;
    };
    if (data.blockId && data.coachUserId && data.stage) {
      api.logEvent(data.coachUserId, data.blockId, "ack", data.stage).catch(() => {});
    }
  });
  return () => sub.remove();
}
