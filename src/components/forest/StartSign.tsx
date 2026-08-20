export default function StartSign({ left, bottom }: { left: number; bottom: number }) {
  return (
    <div className="start-sign" style={{ left: `${left}%`, bottom: `${bottom}%` }} aria-hidden="true">
      <div className="start-sign-post" />
      <div className="start-sign-board">START</div>
      <div className="start-ground" />
    </div>
  );
}
