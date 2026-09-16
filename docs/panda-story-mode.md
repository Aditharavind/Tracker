# Panda: Find the path again

Open the **STORY** signpost in the main forest game (top-right of the
gameplay area) -- it is a chapter of the same 75-day run, not a separate
minigame, so it lives outside the Minigames picker (Forest Dash only there
now). The young panda returns to an abandoned trail, learning movement and
emotional resilience together. The campaign now has six worlds, each with 15
sequential levels. Clearing level 15 completes that world and unlocks the next
world.

Story progress is no longer opened by a per-world day floor. The save gate is
strictly sequential, and the habit `dayNumber` is only used for the penalty:
one failed story attempt locks Story Mode until seven habit days later. See
`LEVELS_PER_WORLD` / `STORY_WORLD_COUNT` in `src/game/adventure/content.ts`,
and `recordFailure` / `canPlay` in `src/game/adventure/save.ts`.

| World | Boss | Reward |
| --- | --- | --- |
| Laziness | The Lazy Giant | Burst Dash |
| Self-doubt | The Doubt | Second Chance (double jump) |
| Distraction | The Distractor | Focus |
| Fear | The Beast of Fear | Courage Shield |
| Inconsistency | The Quitter | Momentum |
| Frustration | Chaos | Inner Strength |

Panda starts with walking, running, variable-height jumping, crouching, and
Smash. Bosses expose telegraphed recovery windows that can be punished with
Smash; none requires its own reward. The first boss also has a sleeping phase
and an environmental bell. Returning with new powers reveals optional memories.
Collecting 2, 4, 6, and 8 unique memories
unlocks Extended Dash, Air Dash, Reflect, and Wall Jump respectively.

## Implementation

- `src/components/forest/Adventure.tsx`: world map, scene flow, HUD, lifecycle,
  checkpoint persistence, and the fixed-step loop.
- `src/game/adventure/content.ts`: worlds, dialogue, powers, and 90 campaign
  levels. Levels combine authored platform and hazard sections.
- `src/game/adventure/engine.ts`: 120 Hz physics, buffered/coyote jumps, collisions,
  combat, enemies, boss phases, checkpoints, projectiles, and reusable particles.
- `src/game/adventure/render.ts`: original Panda sprite animation, world grading,
  parallax, environmental details, boss tells, particles, and camera smoothing.
- `src/game/adventure/audio.ts`: original procedural world melodies and effects,
  boss/low-health/peaceful arrangements, and Focus filtering. Global mute applies.
- `src/game/adventure/controls.ts`: keyboard, touch, standard gamepad inputs,
  and gradual automatic graphics scaling. Start pauses/resumes on a gamepad.
- `src/game/adventure/save.ts`: versioned validation and immutable progress updates.
- `src/adventure.css`: responsive menus, portrait fallback, landscape layout,
  safe-area spacing, touch controls, and reduced-motion presentation.

Graphics settings include Auto, Low, Medium, High, Ultra, and battery/performance
mode. Auto reduces render resolution and visual detail after sustained slow
frames, then restores detail gradually. Simulation timing stays fixed. The app
manifest allows either orientation. The story bundle and forest art load on
demand and enter a service-worker runtime cache after a visit.

## Save behavior

The key is `75hard.panda.adventure.v3:<player-id>` (`guest` when no player is
selected). Saves cover lantern index, current attempt time and collectibles,
defeated enemies, cleared obstacles, cutscene page, cumulative unique coins and
memories, level/boss completion, powers, upgrades, best times, and settings.

Checkpoints and collection changes save within 250ms; elapsed time saves every
two seconds. Pause, visibility changes, page exit, scene changes, and boss defeat
also save. Resume restores a stable lantern, heals Panda, resets transient
hazards, and waits for the player to continue. It does not restore an unsafe
midair position. Replays merge unique collectible IDs and retain the best time.
Invalid or locked progress is rejected; storage failures show an alert.

Saves are local to the browser, without cloud synchronization. The previous
three-chapter campaign's save remains separate; its completion does not unlock
the redesigned campaign. Tracker progress and Forest Dash scores are independent.

## Reflection sources

The quiet moments label brief translation excerpts separately from original
Panda reflections. Translation attribution is Swami Mukundananda; each moment
links directly to its full verse. Source pages used:

- [3.8: action](https://www.holy-bhagavad-gita.org/chapter/3/verse/8/)
- [2.47: effort and results](https://www.holy-bhagavad-gita.org/chapter/2/verse/47/)
- [6.26: returning attention](https://www.holy-bhagavad-gita.org/chapter/6/verse/26/)
- [2.48: equanimity](https://www.holy-bhagavad-gita.org/chapter/2/verse/48/)
- [3.19: consistent duty](https://www.holy-bhagavad-gita.org/chapter/3/verse/19/)
- [6.5: lifting oneself](https://www.holy-bhagavad-gita.org/chapter/6/verse/5/)
- [6.6: the mind as a friend](https://www.holy-bhagavad-gita.org/chapter/6/verse/6/)
- [6.40: hope](https://www.holy-bhagavad-gita.org/chapter/6/verse/40/)

Reflection pacing is player-controlled, so readers can continue or linger.

## Art and music

`public/assets/story/forest-journey.webp` is a new original forest background
generated using the built-in `image_gen` tool, then encoded as WebP for delivery.
The generation brief was a polished panoramic pixel-art forest, 3:2 landscape,
with moss, ferns, flowers, mushrooms, vines, a stream, warm morning rays, teal
atmospheric layers, and a clear dark lower gameplay area. No characters, text,
platforms, UI, or existing-game artwork; reusable under different world grading.
The generated PNG was saved as
`01a07fc6-d00d-7803-b608-67d952907690/exec-2da61385-9079-4bae-b477-781ef1349019.png`
under Codex's generated-images directory; the deployed copy is in this repository.

The map, gameplay, and cutscenes use the selected Panda, Koala, or Red Panda
from Forest Dash. Movement uses the shared run atlases, tilting, squash, and eye-blink
coordinates. The Old Panda is a darkened version of that same artwork. Worlds share the forest illustration and section
templates, with different palettes, weather, hazards, and boss patterns. Music
and effects are synthesized from original note sequences, with no sampled
commercial-game audio.

## Verification and remaining playtesting

Automated tests cover unlock order, save round trips, damaged saves, duplicate
rewards, cutscene positions, controls, movement, combat, powers, route geometry,
collapsing platforms, and graphics adaptation. Each boss is also defeated in a
simulation using normal input actions, five hearts, and only earlier powers.

Headless Chrome checks exercise the mode picker, map locks, cutscene reload,
keyboard inputs, pause/blur, settings, checkpoint reload with coins, phone-sized
portrait/landscape layouts, the final boss HUD, and return to Forest Dash.
Checkpoint and late-game browser coverage use fixtures built with production
save helpers. These checks do not represent a full manual campaign playthrough.

Real Android/iPhone hardware, Safari, physical gamepads, installed-PWA rotation,
long-session battery use, and subjective difficulty/audio balance still need
hands-on playtesting. Frame-rate adaptation is tested; sustained device-specific
frame-rate targets are not certified.

## PC and phone improvements

- Canvas resolution follows the actual gameplay viewport, capped at 2x device
  pixels (1x in battery mode), with automatic quality adjustment. Physics stays
  at 120 Hz with bounded catch-up after a slow frame.
- Touch controls appear on coarse-pointer devices and support simultaneous
  movement and actions. Each pointer/key owns its held inputs. Cancelling one
  input does not cancel another, and joystick motion avoids React rerenders.
- Levels wait for decoded artwork before simulation begins. Failed artwork
  downloads have a retry action. Loaded images are reused between scenes.
- All selected characters render in gameplay and cutscenes. The world picker
  shows an animated guardian, and opening a world prefers its latest saved
  attempt over older reflection screens.
- Regular shade, flying, and armored enemies reuse the shipped Craftpix spirit,
  dragon, and warrior atlases at enemy scale with walking, hurt, and death
  frames. Enemy selection rotates through the full chapter roster.
- Charge lanes and falling-stone landing zones are visible during boss windup.
  The camera frames the hero and boss together, with closer views on narrow
  screens and larger characters in wide landscape play.
- Later levels enter gameplay directly instead of repeating the world's intro.
  World openings and bosses retain their story scenes.
- Browser checks cover 1440x900 desktop, 390x844 and 320x568 phones, 844x390
  landscape, all six boss encounters, multi-touch movement/jumping, pause,
  settings, and failed-art retry. A short headless landscape sample measured
  16.7ms median and 95th-percentile frame intervals; this is not a phone benchmark.

## Distinct boss sprites and combat effects

The six campaign bosses use different animated creatures from Craftpix's
free packs, downloaded through the publisher's official itch.io listings:

| World | Creature |
| --- | --- |
| Laziness | Battle Turtle: broad shell and heavy ground attacks |
| Self-doubt | Medusa: serpent silhouette and mirrored movement |
| Distraction | Jinn: floating spirit, ghost copies, and teleport effects |
| Fear | Dragon: wings, claws, and falling-stone attacks |
| Inconsistency | Lizard: spear thrusts and charging attacks |
| Frustration | Centipede: segmented body and mixed attack patterns |

The new art includes idle, windup, attack, hurt, and death frames. Boss animation
clocks reset at combat transitions, so attacks play once during the damaging
window. The initial pattern also matches each world's mechanic. Warning marks,
projectile cores, and vulnerability labels remain visible; reduced motion keeps
static readable poses and suppresses animated impact effects.

Smash and boss hits use imported impact frames. Teleports, projectiles,
shockwaves, and power activations use a shared sheet of magic, poison, dust,
and burst effects. A short defeat animation plays after victory is already
saved, so leaving or reloading during the animation retains the unlock.

`src/game/adventure/sprites.ts` renders the animation clips described in
`sprite-manifest.json`. `scripts/pack-story-sprites.py ARCHIVE_DIR` rebuilds the
atlases from locally downloaded `swamp.zip`, `monsters.zip`, and `effects.zip`
with Pillow. Atlas filenames include content hashes; the runtime cache retains
up to 24 story resources. Only the current world's boss sheet loads for gameplay.

These are free-to-use assets under the **Craftpix Freebie Products license**,
not open-source or CC0 art. See the bundled
[asset notice](../public/assets/story/CRAFTPIX-LICENSE.txt) for attribution,
original pack URLs, license reference, and the exact resources used. Original
ZIPs and unused characters are excluded from the distributed project.

Verification for this update: 110 existing frontend/game tests plus three new
sprite-timing tests passed. Production build and lint passed. Atlas bounds were
checked against decoded WebP dimensions. Chrome checks loaded every boss
appearances, advanced attack frames, switched world artwork in the real story
component, and reloaded during a boss defeat to verify immediate completion and
power persistence. Portrait rendering was also checked. The victory check used
a near-defeat fixture in an isolated browser harness; the normal-input boss
simulations remain covered by the game tests. Real-device playtesting remains.
