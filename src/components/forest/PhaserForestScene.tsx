import { useEffect, useRef } from "react";
import { createForestGame, destroyForestGame } from "../../game/PhaserGame";
import { forestBridge, type ForestGameEvent } from "../../game/bridge";
import type { CharacterId } from "../../game/characters";
import type { DayDetail } from "../../types";

/**
 * The Phaser-runtime version of the Forest Entrance environment -- gated
 * behind `?engine=phaser` in App.tsx while it's still the only environment
 * migrated (see src/game/'s migration plan). React still owns and persists
 * every bit of challenge state exactly as ForestScene.tsx's callers already
 * do; this component's only job is pushing the current day's state into
 * Phaser through forestBridge and surfacing the events Phaser reports back.
 * It never imports a Scene or touches a Phaser GameObject itself -- that's
 * the whole point of the bridge.
 */
export default function PhaserForestScene({
  detail,
  dayNumber,
  seed,
  character,
  onGoalReached,
}: {
  detail: DayDetail;
  dayNumber: number;
  seed: string;
  character: CharacterId;
  onGoalReached?: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const total = detail.tasks.length;
  const done = detail.tasks.filter((t) => t.done).length;

  // One Phaser.Game per mount. Recreated only when the character or the
  // day's own identity changes -- a task tick flows through the state effect
  // below instead of tearing the whole instance down and back up.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    forestBridge.setState({ dayNumber, seed, character, totalTasks: total, doneTasks: done, resets: 0 });
    createForestGame(el, character);
    return () => destroyForestGame();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [character, dayNumber, seed]);

  useEffect(() => {
    forestBridge.setState({ dayNumber, seed, character, totalTasks: total, doneTasks: done, resets: 0 });
  }, [dayNumber, seed, character, total, done]);

  useEffect(() => {
    const handler = (event: ForestGameEvent) => {
      if (event.type === "goalReached") onGoalReached?.();
    };
    forestBridge.on("event", handler);
    return () => {
      forestBridge.off("event", handler);
    };
  }, [onGoalReached]);

  return <div ref={containerRef} className="phaser-forest-container" role="img" aria-label="Forest Entrance" />;
}
