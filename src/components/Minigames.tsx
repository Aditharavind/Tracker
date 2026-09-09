import { useEffect } from "react";
import type { CharacterId } from "../game/characters";
import PandaRunner from "./forest/PandaRunner";

export default function Minigames({ character, userId, onClose }: { character: CharacterId; userId: number | null; onClose: () => void }) {
  // PandaRunner is its own modal dialog (focus, Escape, aria-modal all handled
  // there) -- this wrapper only owns locking background scroll while it's open
  // and giving focus back to whatever launched it.
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = overflow; previous?.focus(); };
  }, []);
  return <PandaRunner character={character} userId={userId} onClose={onClose} />;
}
