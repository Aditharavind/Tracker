/**
 * The reward for hitting snooze. Inline SVG in the same spirit as Sprite and
 * the ThemePicker icons -- no image asset, so it costs nothing to ship and
 * stays sharp at any size.
 *
 * Draw order matters twice over: the ears sit behind the head so they read as
 * ears rather than lumps, and the waving arm sits *in front* of it, because at
 * the bottom of its swing an arm drawn behind the head disappears into it. The
 * swing range in .panda-arm is tuned to keep the paw clear of the cheek at one
 * end and inside the viewBox at the other -- both checked by rendering the
 * extremes, not by eye.
 */
export default function SnoozePanda({ minutes }: { minutes: number }) {
  return (
    <div className="snooze-panda" role="status">
      <div className="snooze-card">
        <svg viewBox="0 0 124 124" width="136" height="136" aria-hidden="true">
          {/* bamboo -- gives the white body something to sit against */}
          <g className="panda-bamboo">
            <path d="M14 124V64" stroke="#7cc36a" strokeWidth="7" strokeLinecap="round" />
            <path d="M14 104h0M14 84h0" stroke="#5da34c" strokeWidth="7" strokeLinecap="round" />
            <path d="M106 124V72" stroke="#7cc36a" strokeWidth="7" strokeLinecap="round" />
            <path d="M106 106h0M106 88h0" stroke="#5da34c" strokeWidth="7" strokeLinecap="round" />
          </g>

          {/* legs */}
          <ellipse cx="43" cy="116" rx="10.5" ry="8" fill="#2b2b33" />
          <ellipse cx="77" cy="116" rx="10.5" ry="8" fill="#2b2b33" />

          {/* body */}
          <ellipse cx="60" cy="96" rx="23" ry="20" fill="#fff" stroke="#dcdce4" strokeWidth="1.5" />

          {/* resting arm */}
          <ellipse cx="32" cy="90" rx="8.5" ry="11" fill="#2b2b33" transform="rotate(-20 32 90)" />

          {/* ears */}
          <circle cx="34" cy="21" r="12.5" fill="#2b2b33" />
          <circle cx="86" cy="21" r="12.5" fill="#2b2b33" />
          <circle cx="34" cy="20" r="5.5" fill="#4a4a55" />
          <circle cx="86" cy="20" r="5.5" fill="#4a4a55" />

          {/* head */}
          <circle cx="60" cy="50" r="31" fill="#fff" stroke="#dcdce4" strokeWidth="1.5" />

          {/* the wave -- rotates about the shoulder */}
          <g className="panda-arm">
            <ellipse cx="99" cy="57" rx="8.5" ry="12" fill="#2b2b33" transform="rotate(34 99 57)" />
          </g>

          {/* eye patches */}
          <ellipse cx="47" cy="48" rx="10.5" ry="12.5" fill="#2b2b33" transform="rotate(-14 47 48)" />
          <ellipse cx="73" cy="48" rx="10.5" ry="12.5" fill="#2b2b33" transform="rotate(14 73 48)" />

          {/* eyes */}
          <circle cx="48" cy="48" r="4.6" fill="#fff" />
          <circle cx="72" cy="48" r="4.6" fill="#fff" />
          <circle cx="49.4" cy="46.8" r="1.6" fill="#2b2b33" />
          <circle cx="73.4" cy="46.8" r="1.6" fill="#2b2b33" />

          {/* blush */}
          <ellipse cx="35" cy="60" rx="6" ry="4" fill="#ff9db1" opacity="0.55" />
          <ellipse cx="85" cy="60" rx="6" ry="4" fill="#ff9db1" opacity="0.55" />

          {/* nose + mouth */}
          <ellipse cx="60" cy="60" rx="4.2" ry="3.2" fill="#2b2b33" />
          <path
            d="M60 63.5q-4.5 5-8.5 1.5M60 63.5q4.5 5 8.5 1.5"
            stroke="#2b2b33"
            strokeWidth="2"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
        <p className="snooze-line">See you in {minutes} minutes</p>
      </div>
    </div>
  );
}
