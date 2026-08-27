export default function Platform({
  left,
  bottom,
  cleared,
  title,
  wide,
}: {
  left: number;
  bottom: number;
  cleared: boolean;
  title: string;
  wide?: boolean;
}) {
  return (
    <div
      className={`platform${cleared ? " cleared" : ""}${wide ? " platform-wide" : ""}`}
      style={{ left: `${left}%`, bottom: `${bottom}%` }}
      title={title}
    >
      <div className="platform-moss" />
      <div className="platform-stone" />
    </div>
  );
}
