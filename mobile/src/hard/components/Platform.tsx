import { View } from "react-native";
import Coin from "./Coin";

export default function Platform({ cleared, width = 50 }: { cleared: boolean; width?: number }) {
  return (
    <View style={{ alignItems: "center" }}>
      <View style={{ marginBottom: 4 }}>
        <Coin collected={cleared} />
      </View>
      <View
        style={{
          width,
          height: 10,
          borderRadius: 3,
          backgroundColor: cleared ? "#4f8f52" : "#2a3a2e",
          borderWidth: 1.5,
          borderColor: cleared ? "#2f5f33" : "#f3e6c8",
        }}
      />
      <View style={{ width: width - 6, height: 4, backgroundColor: "#2a2f28", opacity: 0.8, borderRadius: 2 }} />
    </View>
  );
}
