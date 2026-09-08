# Codex development notes

## Panda Story Mode — September 8, 2026

Implemented the expanded Panda adventure and corrected the character artwork.
Open **MINIGAME → Story Mode** to play.

### What changed

- The minigame picker offers **Forest Dash** and **Story Mode**.
- Story Mode follows Panda's journey to “Find the path again,” through eight
  worlds: Laziness, Self-doubt, Distraction, Fear, Inconsistency, Frustration,
  Discipline, and Hope.
- Added 24 campaign levels, eight boss encounters, and three postgame mastery
  trails, with replayable levels and best times.
- Added traps, enemies, moving/vanishing/collapsing platforms, breakable
  obstacles, checkpoint lanterns, coins, and optional memories.
- Added seven earned powers: Burst Dash, Second Chance, Focus, Courage Shield,
  Momentum, Inner Strength, and Hope Awakening. Bosses can be defeated using
  starting abilities and previously earned powers.
- Added animated cutscenes, power introductions, sourced Bhagavad Gita excerpts
  with separately labeled Panda reflections, and an ending on the original trail.
- Added original forest artwork, procedural music and sound effects, camera
  movement, and visual feedback for combat and abilities.
- Added keyboard/mouse, touch, and standard gamepad controls, including controller
  pause/resume, key remapping, adjustable touch controls, graphics settings,
  automatic graphics scaling, and reduced-motion options.
- Added portrait and landscape layouts and allowed both orientations in the PWA
  manifest. Story assets load on demand and are cached after a visit. A failed
  story download presents a route back to the minigame picker.

### Same Panda throughout

The initial Story Mode implementation drew a separate canvas Panda. Following
the requested correction, gameplay and cutscenes now use the **same original
`public/assets/panda-sprite.webp` artwork as Forest Dash and the story map**.

The sprite keeps movement feedback through bobbing, tilting, squash, and the
shared blink coordinates. The Old Panda and its shadow use a darkened version
of the same artwork. Cutscenes also redraw when the sprite loads, including
when reduced motion is enabled.

### Local saves

Progress saves per player in `localStorage` under
`75hard.panda.adventure.v2:<player-id>` (or `guest`). Saved data includes:

- Checkpoint lanterns, collected items, defeated enemies, and cleared obstacles.
- Cutscene pages, level and boss completion, powers, and memory upgrades.
- Unique coin/memory totals, best completion times, and settings.

Reloading resumes at the last lantern with restored health and a paused game.
Progress stays in this browser; clearing site data removes it. The earlier
three-chapter story save remains separate. Story progress does not affect habit
challenge tasks, XP, or lives.

### Verification

- Campaign implementation: **197 automated tests passed** (87 backend/API and
  110 frontend/game tests), including simulations defeating all eight bosses
  with normal inputs, five hearts, and only previously earned powers.
- Browser checks passed for progression locks, cutscene and checkpoint reloads,
  settings, pause/resume, touch layouts, ending scenes, and download failure
  recovery. Late-game and checkpoint checks used production save helpers to
  prepare fixtures.
- Latest Panda artwork correction: visually checked gameplay, jumping, and a
  cutscene in Chrome, with no runtime errors. Production build and lint passed.
- The build still reports the existing large 3D-viewer bundle warning.

Real-device performance, Safari, physical controllers, installed-PWA rotation,
and a full manual campaign playthrough still need hands-on testing. Worlds share
forest artwork and level-section templates with different themes and mechanics.

See [Panda Story Mode development notes](docs/panda-story-mode.md) for source
files, art provenance, reflection sources, and further implementation details.

## Boss artwork and combat animation update

- Replaced the seven repeated boss designs with Craftpix's Battle Turtle,
  Medusa, Jinn, Dragon, Lizard, Centipede, and Demon sprites.
- Kept the original Panda as the player and the dark Panda as the final boss.
- Connected idle, windup, attack, hurt, and death frames to combat state.
- Added imported impact, magic, poison, dust, and burst effects for attacks,
  projectiles, teleports, and powers.
- Saved victories before playing the brief defeat animation.
- Added compact WebP atlases, per-world boss loading, and animation metadata.
- Recorded the official pack sources and Craftpix Freebie Products license in
  `public/assets/story/CRAFTPIX-LICENSE.txt`. These assets are free to use in the
  game under that license; they are not open-source or CC0 assets.

See `docs/panda-story-mode.md` for the boss mapping and asset build instructions.

Verification for the boss update: 113 frontend/game tests passed, along with
build, lint, and atlas-bound checks. Browser checks verified eight distinct
appearances, attack-frame progression, correct world-specific artwork, portrait
layout, and saved victory/power restoration after reloading during defeat.
