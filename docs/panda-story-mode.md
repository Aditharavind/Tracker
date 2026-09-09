# Panda: Find the path again

Open the **STORY** signpost in the main forest game (top-right of the
gameplay area) -- it is a chapter of the same 75-day run, not a separate
minigame, so it lives outside the Minigames picker (Forest Dash only there
now). The young panda returns to an abandoned trail, learning movement and
emotional resilience together. Every world has two traversal levels and a
boss encounter; completing a boss unlocks the next world.

Each world also carries its own day-number floor, tied to the habit
challenge's own progress rather than the story's: World 1 opens on Day 1,
then a new world unlocks every 7 days (Day 8, 15, 22, 29, 36, 43, 50 for
Worlds 2-8). A world still additionally requires the previous world's boss
defeated -- the day floor is a ceiling on top of that, not a replacement for
it, so a level's route never assumes a power the player couldn't have earned
yet. See `storyWorldUnlockDay` / `STORY_WORLD_UNLOCK_DAYS` in
`src/game/adventure/content.ts`, and `canPlay`'s `dayNumber` parameter in
`src/game/adventure/save.ts`.

| World | Boss | Reward |
| --- | --- | --- |
| Laziness | The Lazy Giant | Burst Dash |
| Self-doubt | The Doubt | Second Chance (double jump) |
| Distraction | The Distractor | Focus |
| Fear | The Beast of Fear | Courage Shield |
| Inconsistency | The Quitter | Momentum |
| Frustration | Chaos | Inner Strength |
| Discipline | The Old Habit | Hope Awakening |
| Hope | The Old Panda | Ending and mastery trails |

Panda starts with walking, running, variable-height jumping, crouching, and
Smash. Bosses expose telegraphed recovery windows that can be punished with
Smash; none requires its own reward. The first boss also has a sleeping phase
and an environmental bell. The final boss has five phases. Returning with new
powers reveals optional memories. Collecting 2, 4, 6, and 8 unique memories
unlocks Extended Dash, Air Dash, Reflect, and Wall Jump respectively.

## Implementation

- `src/components/forest/Adventure.tsx`: world map, scene flow, HUD, lifecycle,
  checkpoint persistence, and the fixed-step loop.
- `src/game/adventure/content.ts`: worlds, dialogue, powers, 24 campaign levels,
  and three mastery variants. Levels combine authored platform and hazard sections.
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

The key is `75hard.panda.adventure.v2:<player-id>` (`guest` when no player is
selected). Saves cover lantern index, current attempt time and collectibles,
defeated enemies, cleared obstacles, cutscene page, cumulative unique coins and
memories, level/boss completion, powers, upgrades, best times, and settings.

Checkpoints and collection changes save immediately; elapsed time saves every
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

The map, gameplay, and cutscenes use the same existing Panda sprite as Forest
Dash. Movement uses sprite bobbing, tilting, squash, and the shared eye-blink
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

## Distinct boss sprites and combat effects

The first seven bosses now use different animated creatures from Craftpix's
free packs, downloaded through the publisher's official itch.io listings:

| World | Creature |
| --- | --- |
| Laziness | Battle Turtle: broad shell and heavy ground attacks |
| Self-doubt | Medusa: serpent silhouette and mirrored movement |
| Distraction | Jinn: floating spirit, ghost copies, and teleport effects |
| Fear | Dragon: wings, claws, and falling-stone attacks |
| Inconsistency | Lizard: spear thrusts and charging attacks |
| Frustration | Centipede: segmented body and mixed attack patterns |
| Discipline | Demon: horned warrior and weapon attacks |
| Hope | Original Panda sprite, darkened as the Old Panda |

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
checked against decoded WebP dimensions. Chrome checks loaded all eight boss
appearances, advanced attack frames, switched world artwork in the real story
component, and reloaded during a boss defeat to verify immediate completion and
power persistence. Portrait rendering was also checked. The victory check used
a near-defeat fixture in an isolated browser harness; the normal-input boss
simulations remain covered by the game tests. Real-device playtesting remains.
