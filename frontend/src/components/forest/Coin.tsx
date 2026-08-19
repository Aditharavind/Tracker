// Coin state is a pure readout of task.done -- it never toggles the task.
// See CLAUDE.md section 8: "coin count is never the source of truth."
// The panda-face imprint matches the reference art's coin design.
export default function Coin({ left, bottom, collected }: { left: number; bottom: number; collected: boolean }) {
  return (
    <div
      className={`coin${collected ? " collected" : ""}`}
      style={{ left: `${left}%`, bottom: `${bottom}%` }}
      aria-hidden="true"
    >
      <svg width="17" height="17" viewBox="0 0 17 17">
        <circle cx="8.5" cy="8.5" r="7.6" fill="#f0c04a" stroke="#8a5a17" strokeWidth="1" />
        <circle cx="8.5" cy="8.5" r="6" fill="none" stroke="#c98f2e" strokeWidth="0.6" />
        <ellipse cx="5.6" cy="6.2" rx="1.3" ry="1.3" fill="#8a5a17" />
        <ellipse cx="11.4" cy="6.2" rx="1.3" ry="1.3" fill="#8a5a17" />
        <ellipse cx="8.5" cy="8.4" rx="3.6" ry="3.2" fill="#fff3c9" />
        <ellipse cx="6.7" cy="8.1" rx="1" ry="1.3" fill="#8a5a17" />
        <ellipse cx="10.3" cy="8.1" rx="1" ry="1.3" fill="#8a5a17" />
        <ellipse cx="8.5" cy="9.6" rx="0.6" ry="0.4" fill="#8a5a17" />
        <circle cx="6" cy="5.4" r="1" fill="#fff8e2" opacity="0.7" />
      </svg>
    </div>
  );
}
