# maps/

Reserved for Tiled-authored level layouts.

The Forest Entrance scene doesn't use one yet -- its layout comes from the
existing `generatePlatforms()` (see `../platformGenerator.ts`), the same
deterministic function the DOM version already used, imported unchanged.

Bring in Tiled here only for a world whose layout genuinely needs hand
authoring (fixed platforming puzzles, Story Mode's levels, NPC placement) --
not as a blanket replacement for the procedural forest layout, which has no
editorial content to author.
