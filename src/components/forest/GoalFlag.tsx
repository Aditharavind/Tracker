export default function GoalFlag({
  left,
  bottom,
  reached,
  dayNumber,
}: {
  left: number;
  bottom: number;
  reached: boolean;
  dayNumber: number;
}) {
  return (
    <div className={`goal-flag${reached ? " reached" : ""}`} style={{ left: `${left}%`, bottom: `${bottom}%` }}>
      <div className="goal-mast">
        <div className="goal-pole" />
        <div className="goal-cloth" />
      </div>
      <div className="goal-board" aria-hidden="true">
        <span className="goal-board-day">DAY {String(dayNumber).padStart(2, "0")}</span>
        <span className="goal-board-state">{reached ? "VICTORY!" : "GOAL"}</span>
      </div>
    </div>
  );
}
