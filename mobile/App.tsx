import { useEffect, useState } from "react";
import { Pressable, SafeAreaView, Text, View } from "react-native";
import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  registerNotificationHandlers,
  requestNotificationPermission,
  scheduleBlockAlarms,
} from "./src/notifications";
import OnboardingScreen from "./src/screens/OnboardingScreen";
import TodayScreen from "./src/screens/TodayScreen";
import type { Schedule } from "./src/types";
import { hardApi } from "./src/hard/api";
import HardOnboardScreen from "./src/hard/screens/HardOnboardScreen";
import ForestScreen from "./src/hard/screens/ForestScreen";

const HARD_USER_KEY = "75hard.user";
type HardSession = { id: number; pin: string };
type Mode = "coach" | "hard";

export default function App() {
  const [mode, setMode] = useState<Mode>("coach");

  const [coachUserId, setCoachUserId] = useState<number | null>(null);
  const [schedule, setSchedule] = useState<Schedule | null>(null);

  const [hardSession, setHardSession] = useState<HardSession | null | undefined>(undefined);

  useEffect(() => {
    requestNotificationPermission();
    return registerNotificationHandlers();
  }, []);

  useEffect(() => {
    if (coachUserId && schedule) {
      scheduleBlockAlarms(schedule, coachUserId).catch(() => {});
    }
  }, [coachUserId, schedule]);

  // Restore the locally-remembered 75 Hard user, same convention as the web
  // app's localStorage key -- but only trust it once the backend confirms
  // the user still exists (an isolated dev DB reset would otherwise strand
  // this screen on a permanently-loading forest).
  useEffect(() => {
    (async () => {
      const raw = await AsyncStorage.getItem(HARD_USER_KEY);
      if (!raw) {
        setHardSession(null);
        return;
      }
      try {
        const session: HardSession = JSON.parse(raw);
        await hardApi.users(session.id);
        setHardSession(session);
      } catch {
        await AsyncStorage.removeItem(HARD_USER_KEY);
        setHardSession(null);
      }
    })();
  }, []);

  return (
    <SafeAreaView style={{ flex: 1 }}>
      <StatusBar style="auto" />
      <View style={{ flexDirection: "row", borderBottomWidth: 1, borderBottomColor: "#eee" }}>
        <Pressable
          onPress={() => setMode("coach")}
          style={{ flex: 1, padding: 12, alignItems: "center", backgroundColor: mode === "coach" ? "#f2f2f2" : "#fff" }}
        >
          <Text style={{ fontWeight: mode === "coach" ? "700" : "400" }}>Coach</Text>
        </Pressable>
        <Pressable
          onPress={() => setMode("hard")}
          style={{ flex: 1, padding: 12, alignItems: "center", backgroundColor: mode === "hard" ? "#f2f2f2" : "#fff" }}
        >
          <Text style={{ fontWeight: mode === "hard" ? "700" : "400" }}>75 Hard</Text>
        </Pressable>
      </View>

      {mode === "coach" ? (
        coachUserId && schedule ? (
          <TodayScreen coachUserId={coachUserId} schedule={schedule} onScheduleChange={setSchedule} />
        ) : (
          <OnboardingScreen
            onDone={(result) => {
              setCoachUserId(result.coach_user_id);
              setSchedule(result.schedule);
            }}
          />
        )
      ) : hardSession === undefined ? null : hardSession ? (
        <ForestScreen userId={hardSession.id} pin={hardSession.pin} />
      ) : (
        <HardOnboardScreen
          onDone={async (user, pin) => {
            const session = { id: user.id, pin };
            await AsyncStorage.setItem(HARD_USER_KEY, JSON.stringify(session));
            setHardSession(session);
          }}
        />
      )}
    </SafeAreaView>
  );
}
