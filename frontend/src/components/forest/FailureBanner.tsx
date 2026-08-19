export default function FailureBanner({ resets }: { resets: number }) {
  return (
    <div className="failure-banner" role="status">
      <p className="failure-title">
        <svg width="16" height="15" viewBox="0 0 16 15" aria-hidden="true" className="broken-heart">
          <path
            d="M8 14 C2 10, 0 7, 0 4.4 C0 2, 1.9 0, 4.3 0 C5.8 0, 7 0.8, 8 2.2 C9 0.8, 10.2 0, 11.7 0 C14.1 0, 16 2, 16 4.4 C16 7, 14 10, 8 14 Z"
            fill="var(--bad)"
          />
          <path d="M8 2.2 6.5 6 9 8 7 12" stroke="var(--panel)" strokeWidth="1.1" fill="none" strokeLinejoin="round" />
        </svg>
        MISSED A TASK?
      </p>
      <p>The panda falls back... {resets > 0 ? "you are climbing again from Day 1." : "complete all tasks to keep climbing."}</p>
      <p className="muted">Complete all tasks to keep climbing!</p>
    </div>
  );
}
