import { useCallback, useState } from "react";
import { FlatList, Pressable, RefreshControl, Text, View } from "react-native";

import { api } from "../api";
import type { Block, Schedule } from "../types";

type Props = {
  coachUserId: number;
  schedule: Schedule;
  onScheduleChange: (schedule: Schedule) => void;
};

const STATUS_COLOR: Record<Block["status"], string> = {
  pending: "#999",
  acked: "#2d7a3e",
  ignored: "#c0392b",
  done: "#2d7a3e",
};

export default function TodayScreen({ coachUserId, schedule, onScheduleChange }: Props) {
  const [refreshing, setRefreshing] = useState(false);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    try {
      onScheduleChange(await api.today(coachUserId));
    } finally {
      setRefreshing(false);
    }
  }, [coachUserId, onScheduleChange]);

  const mark = async (block: Block, kind: "complete" | "ignore") => {
    await api.logEvent(coachUserId, block.id, kind);
    await refresh();
  };

  return (
    <FlatList
      contentContainerStyle={{ padding: 16, gap: 10 }}
      data={schedule.blocks}
      keyExtractor={(b) => String(b.id)}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
      ListHeaderComponent={
        <Text style={{ fontSize: 22, fontWeight: "700", marginBottom: 8 }}>Today</Text>
      }
      renderItem={({ item }) => (
        <View
          style={{
            borderWidth: 1,
            borderColor: "#eee",
            borderRadius: 10,
            padding: 12,
            gap: 6,
          }}
        >
          <Text style={{ fontSize: 12, color: "#888" }}>
            {item.start_time} - {item.end_time} - {item.kind}
          </Text>
          <Text style={{ fontSize: 16, fontWeight: "600" }}>{item.title}</Text>
          <Text style={{ fontSize: 12, color: STATUS_COLOR[item.status] }}>{item.status}</Text>
          {item.status === "pending" && (
            <View style={{ flexDirection: "row", gap: 8, marginTop: 4 }}>
              <Pressable
                onPress={() => mark(item, "complete")}
                style={{ backgroundColor: "#2d7a3e", paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 }}
              >
                <Text style={{ color: "#fff", fontSize: 13 }}>Mark done</Text>
              </Pressable>
              <Pressable
                onPress={() => mark(item, "ignore")}
                style={{ backgroundColor: "#eee", paddingVertical: 8, paddingHorizontal: 12, borderRadius: 8 }}
              >
                <Text style={{ fontSize: 13 }}>Skip</Text>
              </Pressable>
            </View>
          )}
        </View>
      )}
    />
  );
}
