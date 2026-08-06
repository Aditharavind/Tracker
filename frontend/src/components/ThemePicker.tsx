export const THEMES = [
  { id: "dark", label: "Dark" },
  { id: "light", label: "Light" },
  { id: "terminal", label: "Terminal" },
  { id: "retro", label: "Retro" },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

const ICONS: Record<ThemeId, JSX.Element> = {
  dark: (
    <path
      d="M12.5 8.6A5 5 0 0 1 5.4 3.5a5 5 0 1 0 7.1 5.1Z"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinejoin="round"
    />
  ),
  light: (
    <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <circle cx="8" cy="8" r="3" />
      <path d="M8 1.5v1.6M8 12.9v1.6M1.5 8h1.6M12.9 8h1.6M3.4 3.4l1.1 1.1M11.5 11.5l1.1 1.1M12.6 3.4l-1.1 1.1M4.5 11.5l-1.1 1.1" />
    </g>
  ),
  terminal: (
    <g fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round">
      <rect x="1.8" y="2.5" width="12.4" height="11" rx="1.6" strokeLinejoin="round" />
      <path d="M4.6 6.2 6.6 8l-2 1.8M8.6 10.2h3" />
    </g>
  ),
  retro: (
    <g fill="none" stroke="currentColor" strokeLinejoin="round">
      <path d="M5.4 4.4h7.4v7.4H5.4z" strokeWidth="1.5" />
      <path d="M3.2 2.2h7.4v7.4H3.2z" strokeWidth="1.5" fill="var(--panel)" />
    </g>
  ),
};

export default function ThemePicker({
  theme,
  onPick,
}: {
  theme: ThemeId;
  onPick: (t: ThemeId) => void;
}) {
  return (
    <div className="themes" role="group" aria-label="Colour theme">
      {THEMES.map((t) => (
        <button
          key={t.id}
          className={`theme-btn${t.id === theme ? " on" : ""}`}
          onClick={() => onPick(t.id)}
          title={t.label}
          aria-label={`${t.label} theme`}
          aria-pressed={t.id === theme}
        >
          <svg width="16" height="16" viewBox="0 0 16 16">
            {ICONS[t.id]}
          </svg>
        </button>
      ))}
    </div>
  );
}
