import { useEffect, useState } from "react";
import { SafeAreaView } from "react-native";
import { StatusBar } from "expo-status-bar";

import {
  registerNotificationHandlers,
  requestNotificationPermission,
  scheduleBlockAlarms,
} from "./src/notifications";
import OnboardingScreen from "./src/screens/OnboardingScreen";
import TodayScreen from "./src/screens/TodayScreen";
import type { Schedule } from "./src/types";

export default function App() {
  const [coachUserId, setCoachUserId] = useState<number | null>(null);
  const [schedule, setSchedule] = useState<Schedule | null>(null);

  useEffect(() => {
    requestNotificationPermission();
    return registerNotificationHandlers();
  }, []);

  useEffect(() => {
    if (coachUserId && schedule) {
      scheduleBlockAlarms(schedule, coachUserId).catch(() => {});
    }
  }, [coachUserId, schedule]);

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <StatusBar style="auto" />
      {coachUserId && schedule ? (
        <TodayScreen coachUserId={coachUserId} schedule={schedule} onScheduleChange={setSchedule} />
      ) : (
        <OnboardingScreen
          onDone={(result) => {
            setCoachUserId(result.coach_user_id);
            setSchedule(result.schedule);
          }}
        />
      )}
    </SafeAreaView>
  );
}
