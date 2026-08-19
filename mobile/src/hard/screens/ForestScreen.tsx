import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, RefreshControl, ScrollView, Text, View } from "react-native";
import Svg, { Polyline } from "react-native-svg";

import { hardApi, todayISO } from "../api";
import type { DayDetail, Progress, TaskItem } from "../types";
import { generatePlatforms, goalPoint, startPoint } from "../game/platformGenerator";
import { pandaPlatformIndex } from "../game/progress";
import DayCard from "../components/DayCard";
import Platform from "../components/Platform";
import GoalFlag from "../components/GoalFlag";
import Panda from "../components/Panda";
import LivesHUD from "../components/LivesHUD";

const SCENE_HEIGHT = 260;

export default function ForestScreen({ userId, pin }: { userId: number; pin: string }) {
  const [progress, setProgress] = useState<Progress | null>(null);
  const [detail, setDetail] = useState<DayDetail | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const bounce = useRef(new Animated.Value(0)).current;
  const prevDone = useRef<number | null>(null);

  const load = useCallback(async () => {
    const [board, day] = await Promise.all([hardApi.board(userId), hardApi.day(userId, todayISO())]);
    const mine = board.find((p) => p.user_id === userId) ?? null;
    setProgress(mine);
    setDetail(day);
  }, [userId]);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  const toggle = async (t: TaskItem) => {
    if (!detail) return;
    const optimistic = { ...detail, tasks: detail.tasks.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)) };
    setDetail(optimistic);
    const res = await hardApi.toggle(userId, t.id, todayISO(), !t.done, pin);
    setDetail(res.day);
    setProgress(res.progress);
  };

  const doneCount = detail ? detail.tasks.filter((t) => t.done).length : 0;
  const total = detail ? detail.tasks.length : 0;

  useEffect(() => {
    if (prevDone.current !== null && doneCount > prevDone.current) {
      Animated.sequence([
        Animated.timing(bounce, { toValue: 1, duration: 260, useNativeDriver: true }),
        Animated.timing(bounce, { toValue: 0, duration: 260, useNativeDriver: true }),
      ]).start();
    }
    prevDone.current = doneCount;
  }, [doneCount, bounce]);

  if (!progress || !detail) {
    return (
      <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
        <Text>loading...</Text>
      </View>
    );
  }

  const seed = `${userId}`;
  const platforms = generatePlatforms(progress.day_number, total, seed);
  const pandaIndex = pandaPlatformIndex(doneCount, total);
  const start = startPoint();
  const pandaPoint = pandaIndex === 0 ? start : platforms[pandaIndex - 1];
  const goal = goalPoint(total);
  const reachedGoal = total > 0 && doneCount === total;
  const trailPoints = [start, ...platforms, goal];

  return (
    <ScrollView
      contentContainerStyle={{ padding: 16, gap: 14 }}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
    >
      <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center" }}>
        <Text style={{ fontSize: 12, fontWeight: "700", letterSpacing: 2, color: "#888" }}>75 DAY HARD CHALLENGE</Text>
        <LivesHUD resets={progress.resets} />
      </View>

      <DayCard detail={detail} dayNumber={progress.day_number} onToggle={toggle} />

      {total > 0 && (
        <View
          style={{
            height: SCENE_HEIGHT,
            borderRadius: 14,
            overflow: "hidden",
            backgroundColor: "#0c1710",
            borderWidth: 1,
            borderColor: "#1e1e23",
          }}
        >
          <Svg
            style={{ position: "absolute", width: "100%", height: "100%" }}
            viewBox="0 0 100 100"
            preserveAspectRatio="none"
          >
            <Polyline
              points={trailPoints.map((p) => `${p.x * 100},${(1 - p.y) * 100}`).join(" ")}
              fill="none"
              stroke="#f3e6c8"
              strokeWidth={0.6}
              strokeDasharray="2,2.4"
              opacity={0.45}
            />
          </Svg>

          {platforms.map((p, i) => (
            <View
              key={p.id}
              style={{
                position: "absolute",
                left: `${p.x * 100}%`,
                bottom: `${p.y * 100}%`,
                transform: [{ translateX: -25 }, { translateY: 10 }],
              }}
            >
              <Platform cleared={detail.tasks[i]?.done ?? false} />
            </View>
          ))}

          <View
            style={{
              position: "absolute",
              left: `${goal.x * 100}%`,
              bottom: `${goal.y * 100}%`,
              transform: [{ translateX: -8 }],
            }}
          >
            <GoalFlag reached={reachedGoal} />
          </View>

          <View
            style={{
              position: "absolute",
              left: `${pandaPoint.x * 100}%`,
              bottom: `${pandaPoint.y * 100}%`,
              transform: [{ translateX: -17 }],
            }}
          >
            <Panda anim={reachedGoal ? "celebrating" : "idle"} bounce={bounce} />
          </View>
        </View>
      )}

      <Text style={{ textAlign: "center", color: "#888", fontSize: 12 }}>
        Day {progress.day_number} / 75 &middot; {progress.streak} day streak
      </Text>
    </ScrollView>
  );
}
