export default function GoalFlag({ left, bottom, reached }: { left: number; bottom: number; reached: boolean }) {
  return (
    <div className={`goal-flag${reached ? " reached" : ""}`} style={{ left: `${left}%`, bottom: `${bottom}%` }}>
      <div className="goal-pole" />
      <div className="goal-cloth" />
      <div className="goal-board" aria-hidden="true">
        VICTORY
      </div>
    </div>
  );
}
