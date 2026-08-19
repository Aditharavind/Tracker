export default function Platform({
  left,
  bottom,
  cleared,
  title,
}: {
  left: number;
  bottom: number;
  cleared: boolean;
  title: string;
}) {
  return (
    <div
      className={`platform${cleared ? " cleared" : ""}`}
      style={{ left: `${left}%`, bottom: `${bottom}%` }}
      title={title}
    >
      <div className="platform-moss" />
      <div className="platform-stone" />
    </div>
  );
}
