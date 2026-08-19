import Svg, { Circle, Ellipse } from "react-native-svg";

// Panda-face imprint, same design as the web Coin.tsx. Coin state is a pure
// readout of task.done -- it never toggles the task.
export default function Coin({ collected }: { collected: boolean }) {
  if (collected) return null;
  return (
    <Svg width={17} height={17} viewBox="0 0 17 17">
      <Circle cx={8.5} cy={8.5} r={7.6} fill="#f0c04a" stroke="#8a5a17" strokeWidth={1} />
      <Circle cx={8.5} cy={8.5} r={6} fill="none" stroke="#c98f2e" strokeWidth={0.6} />
      <Ellipse cx={5.6} cy={6.2} rx={1.3} ry={1.3} fill="#8a5a17" />
      <Ellipse cx={11.4} cy={6.2} rx={1.3} ry={1.3} fill="#8a5a17" />
      <Ellipse cx={8.5} cy={8.4} rx={3.6} ry={3.2} fill="#fff3c9" />
      <Ellipse cx={6.7} cy={8.1} rx={1} ry={1.3} fill="#8a5a17" />
      <Ellipse cx={10.3} cy={8.1} rx={1} ry={1.3} fill="#8a5a17" />
      <Ellipse cx={8.5} cy={9.6} rx={0.6} ry={0.4} fill="#8a5a17" />
      <Circle cx={6} cy={5.4} r={1} fill="#fff8e2" opacity={0.7} />
    </Svg>
  );
}
