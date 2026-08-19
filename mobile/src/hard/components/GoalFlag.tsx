import { View } from "react-native";

export default function GoalFlag({ reached }: { reached: boolean }) {
  return (
    <View style={{ alignItems: "flex-start" }}>
      <View style={{ width: 2, height: 46, backgroundColor: "#f3e6c8", opacity: 0.85 }} />
      <View
        style={{
          position: "absolute",
          top: 0,
          left: 2,
          width: 16,
          height: 11,
          backgroundColor: reached ? "#f0c04a" : "#b8493f",
          opacity: reached ? 1 : 0.55,
        }}
      />
    </View>
  );
}
