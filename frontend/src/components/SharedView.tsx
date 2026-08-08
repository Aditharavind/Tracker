import { useEffect, useState } from "react";
import { api } from "../api";
import type { Progress } from "../types";
import { LevelRing } from "../App";
import Calendar75 from "./Calendar75";
import Badges from "./Badges";

export default function SharedView({ token }: { token: string }) {
  const [p, setP] = useState<Progress | "error" | null>(null);

  useEffect(() => {
    api
      .sharedProgress(token)
      .then(setP)
      .catch(() => setP("error"));
  }, [token]);

  if (p === null) return <div className="shell muted">loading...</div>;
  if (p === "error") return <div className="shell muted">This link is invalid or has expired.</div>;

  return (
    <div className="shell" style={{ ["--u" as string]: p.color }}>
      <header className="topbar">
        <div className="wordmark">
          <b>75</b>
          <span>hard</span>
        </div>
        <span className="muted">{p.name}'s progress -- read only</span>
      </header>

      <section className="hero">
        <div>
          <div className="counter">
            <span className="big num">{String(p.day_number).padStart(2, "0")}</span>
            <span className="of">/ 75</span>
          </div>
          <div className="hero-sub">
            <span className="streakchip">{p.streak} day streak</span>
            <span className="sep">|</span>
            <span>
              best <b className="num">{p.best_streak}</b>
            </span>
            <span className="sep">|</span>
            <span>
              <b className="num">{p.perfect_days_ever}</b> perfect day{p.perfect_days_ever === 1 ? "" : "s"}
            </span>
          </div>
        </div>
        <LevelRing p={p} />
      </section>

      <div className="cols">
        <div>
          <Calendar75 cells={p.calendar} onPick={() => {}} />
        </div>
        <div>
          <Badges p={p} />
        </div>
      </div>
    </div>
  );
}
