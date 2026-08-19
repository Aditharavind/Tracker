import { Animated } from "react-native";
import Svg, { Circle, Ellipse, Path } from "react-native-svg";

export type PandaAnim = "idle" | "running" | "jumping" | "landing" | "celebrating" | "falling";

// Same chibi-panda shape as the web Panda.tsx (SVG, no raster assets) --
// draw order matters: body/head first, ears/patches on top so they aren't
// painted over by the larger head ellipse.
export default function Panda({ anim, bounce }: { anim: PandaAnim; bounce: Animated.Value }) {
  const translateY = bounce.interpolate({ inputRange: [0, 1], outputRange: [0, -14] });
  const scale = anim === "landing" ? 0.92 : 1;

  return (
    <Animated.View style={{ transform: [{ translateY }, { scale }] }}>
      <Svg width={34} height={34} viewBox="0 0 30 30">
        <Ellipse cx={10.5} cy={28} rx={3.4} ry={2.4} fill="#fbf6e8" />
        <Ellipse cx={19.5} cy={28} rx={3.4} ry={2.4} fill="#fbf6e8" />
        <Ellipse cx={6} cy={20} rx={2.6} ry={4} fill="#fbf6e8" />
        <Ellipse cx={24} cy={20} rx={2.6} ry={4} fill="#fbf6e8" />
        <Ellipse cx={15} cy={19} rx={11.5} ry={10} fill="#fbf6e8" />
        <Ellipse cx={15} cy={12.5} rx={10.5} ry={8.6} fill="#fbf6e8" />
        <Ellipse cx={8} cy={5.6} rx={4.6} ry={4.6} fill="#1c1c1c" />
        <Ellipse cx={22} cy={5.6} rx={4.6} ry={4.6} fill="#1c1c1c" />
        <Ellipse cx={10} cy={13} rx={3.6} ry={4.4} fill="#1c1c1c" />
        <Ellipse cx={20} cy={13} rx={3.6} ry={4.4} fill="#1c1c1c" />
        <Circle cx={10} cy={13} r={1.5} fill="#fbf6e8" />
        <Circle cx={20} cy={13} r={1.5} fill="#fbf6e8" />
        <Circle cx={9.4} cy={12.3} r={0.6} fill="#fff" />
        <Circle cx={19.4} cy={12.3} r={0.6} fill="#fff" />
        <Ellipse cx={8.4} cy={16.4} rx={1.7} ry={1.1} fill="#f3b8a8" opacity={0.8} />
        <Ellipse cx={21.6} cy={16.4} rx={1.7} ry={1.1} fill="#f3b8a8" opacity={0.8} />
        <Path d="M13.4 16.6q1.6 1.4 3.2 0" stroke="#3a332a" strokeWidth={0.6} fill="none" strokeLinecap="round" />
        <Ellipse cx={15} cy={15.4} rx={1.1} ry={0.8} fill="#3a332a" />
      </Svg>
    </Animated.View>
  );
}
