import { Pressable, Text, View } from "react-native";
import type { DayDetail, TaskItem } from "../types";
import { getStage } from "../game/stageSystem";
import { dayProgressPercent } from "../game/progress";

export default function DayCard({
  detail,
  dayNumber,
  onToggle,
}: {
  detail: DayDetail;
  dayNumber: number;
  onToggle: (t: TaskItem) => void;
}) {
  const stage = getStage(dayNumber);
  const doneAll = detail.tasks.filter((t) => t.done).length;
  const totalAll = detail.tasks.length;
  const allDone = totalAll > 0 && doneAll === totalAll;
  const pct = dayProgressPercent(doneAll, totalAll);

  return (
    <View style={{ borderWidth: 1, borderColor: "#26262c", borderRadius: 14, padding: 16, backgroundColor: "#131316" }}>
      <Text style={{ fontSize: 24, fontWeight: "700", color: "#ececef" }}>DAY {String(dayNumber).padStart(2, "0")}</Text>
      <Text style={{ fontSize: 11, fontWeight: "700", letterSpacing: 2, color: "#e8734a", marginTop: 2 }}>
        {stage.name.toUpperCase()}
      </Text>
      <Text style={{ fontSize: 13, color: "#85858f", marginTop: 6 }}>
        {allDone ? "All tasks completed! Great work today." : "Complete your tasks to climb higher!"}
      </Text>

      <Text style={{ fontSize: 11, fontWeight: "600", letterSpacing: 2, color: "#85858f", marginTop: 16, marginBottom: 6 }}>
        TODAY'S TASKS
      </Text>
      <View style={{ gap: 8 }}>
        {detail.tasks.map((t) => (
          <Pressable
            key={t.id}
            onPress={() => onToggle(t)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: t.done }}
            accessibilityLabel={t.done ? `uncheck ${t.title}` : `check ${t.title}`}
            style={{ flexDirection: "row", alignItems: "center", gap: 10 }}
          >
            <View
              style={{
                width: 20,
                height: 20,
                borderRadius: 5,
                borderWidth: 1.5,
                borderColor: t.done ? "#4ea87a" : "#26262c",
                backgroundColor: t.done ? "#4ea87a" : "transparent",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {t.done && <Text style={{ color: "#0b0b0c", fontSize: 12, fontWeight: "700" }}>{"✓"}</Text>}
            </View>
            <Text style={{ fontSize: 15, color: t.done ? "#5c5c66" : "#ececef", textDecorationLine: t.done ? "line-through" : "none" }}>
              {t.emoji} {t.title}
            </Text>
          </Pressable>
        ))}
      </View>

      <Text style={{ fontSize: 11, fontWeight: "600", letterSpacing: 2, color: "#85858f", marginTop: 16, marginBottom: 8 }}>
        YOUR PROGRESS
      </Text>
      <View
        accessibilityRole="progressbar"
        accessibilityValue={{ min: 0, max: 100, now: pct }}
        accessibilityLabel={`Today's progress: ${doneAll} of ${totalAll} tasks completed`}
        style={{ height: 12, borderRadius: 3, borderWidth: 1.5, borderColor: "#26262c", backgroundColor: "#1e1e23", overflow: "hidden" }}
      >
        <View style={{ width: `${pct}%`, height: "100%", backgroundColor: "#4ea87a" }} />
      </View>
      <Text style={{ fontSize: 12, color: "#5c5c66", marginTop: 6 }}>
        {doneAll} / {totalAll} TASKS
      </Text>
    </View>
  );
}
