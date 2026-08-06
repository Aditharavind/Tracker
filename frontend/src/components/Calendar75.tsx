import type { DayCell } from "../types";
import { prettyDate } from "../api";

export default function Calendar75({
  cells,
  onPick,
}: {
  cells: DayCell[];
  onPick: (iso: string) => void;
}) {
  const done = cells.filter((c) => c.status === "done").length;

  return (
    <div className="card">
      <div className="card-head">
        <h2>The 75</h2>
        <span className="count num">{done} banked</span>
      </div>

      <div className="grid75">
        {cells.map((c) => {
          const fill = c.total ? c.done / c.total : 0;
          const glow = c.status === "future" ? 0 : Math.min(1, c.index / 75);
          return (
            <button
              key={c.index}
              className={`cell ${c.status}`}
              style={{ ["--fill" as string]: fill, ["--glow" as string]: glow }}
              onClick={() => c.status !== "future" && onPick(c.day)}
              title={`Day ${c.index} - ${prettyDate(c.day)} - ${c.done}/${c.total}`}
              aria-label={`day ${c.index}, ${c.status}, ${c.done} of ${c.total} done`}
            />
          );
        })}
      </div>

      <div className="legend">
        <span>
          <i className="swatch" style={{ boxShadow: "inset 0 0 0 1.5px var(--accent)" }} /> outline = pass/fail
        </span>
        <span>
          <i className="swatch" style={{ background: "var(--accent)" }} /> fill = how much of the day landed
        </span>
        <span>
          <i
            className="swatch"
            style={{ background: "var(--raised)", boxShadow: "inset 0 0 0 1px var(--accent)" }}
          />{" "}
          today
        </span>
      </div>
    </div>
  );
}
