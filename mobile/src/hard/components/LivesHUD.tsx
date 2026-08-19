import { useEffect, useRef, useState } from "react";
import { Animated, Text, View } from "react-native";

// Same cosmetic-lives design as the web LivesHUD.tsx: this app's failure
// rule is an instant reset, not a 3-life buffer, so there is no partial-life
// state to show. Hearts render full while the run is alive and play a
// break/refill flourish the moment `resets` goes up.
export default function LivesHUD({ resets }: { resets: number }) {
  const prevResets = useRef(resets);
  const [broken, setBroken] = useState(false);
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (resets > prevResets.current) {
      setBroken(true);
      anim.setValue(0);
      Animated.sequence([
        Animated.timing(anim, { toValue: 1, duration: 220, useNativeDriver: true }),
        Animated.timing(anim, { toValue: 0, duration: 900, useNativeDriver: true }),
      ]).start(() => setBroken(false));
    }
    prevResets.current = resets;
  }, [resets, anim]);

  const scale = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 1.3] });
  const opacity = anim.interpolate({ inputRange: [0, 1], outputRange: [1, 0.3] });
  const full = !broken;

  return (
    <View style={{ alignItems: "center" }}>
      <View style={{ flexDirection: "row", gap: 3 }}>
        {[0, 1, 2].map((i) => (
          <Animated.Text
            key={i}
            style={{
              fontSize: 14,
              color: full ? "#b8493f" : "#3a3a3a",
              transform: broken ? [{ scale }] : undefined,
              opacity: broken ? opacity : 1,
            }}
          >
            {"♥"}
          </Animated.Text>
        ))}
      </View>
      <Text style={{ fontSize: 9, fontWeight: "700", letterSpacing: 1, color: "#888" }}>LIVES</Text>
    </View>
  );
}
