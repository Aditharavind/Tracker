---
name: platformer-interface
description: Design and implementation rules for the 75 Day Hard Challenge gameplay UI — a retro pixel-art, horizontally-scrolling Mario-style platformer, not a habit-tracker dashboard. Load this before touching ForestScene, Panda, Platform, Coin, task-HUD, lives/hearts, progress-bar, character-select, or any other visual/layout code for the panda game. assets/reference-environment.png and assets/reference-characters.png are the visual bible — when this spec's text and those images disagree on a visual detail, the images win.
---

# 75 Day Hard Challenge — Pixel Platformer Interface

## Reference images are the bible

Two canonical references live in this skill folder — look at both before making any layout, color, sprite, or composition decision:

- **`assets/reference-environment.png`** — the full scene composition: HUD layout, task panel, forest/platformer world, start sign, guardian plant, coin/block placement, character-select strip. This is the primary layout reference.
- **`assets/reference-characters.png`** — clean isolated sprite sheet of the three chibi characters (panda, koala, red panda), uncluttered by scene elements. Use this as the authority for character proportions, palette, and pixel density specifically — it's clearer than picking the sprites out of the environment shot.

This document explains *why* those images look the way they do and encodes rules images can't fully convey (responsive behavior, animation timing, the do-not-do list, and where to deliberately diverge — see the `?`-block note in §7). Where this document and an image conflict on a purely visual question (palette, proportions, composition), the image is authoritative — treat this file as the annotated commentary track, not a replacement.

If either file is missing when you load this skill, say so explicitly before proceeding with visual work, since you'd otherwise be designing from memory of this text alone.

## Purpose

Build the interface as a playable 2D side-scrolling platformer, not a conventional habit-tracker dashboard. Completing daily tasks moves the character forward through a world. Preserve this game-first visual hierarchy even though the underlying product is a productivity/habit tracker.

## 0. Character selection happens before the game loads

```
APP OPENS
   ↓
CHOOSE YOUR CHARACTER
   ↓
[PANDA]   [KOALA]   [RED PANDA]
   ↓
USER SELECTS ONE
   ↓
CHARACTER IS CONFIRMED
   ↓
MAIN GAME INTERFACE LOADS
```

The first screen the app shows is a game character-select screen — not a settings page, not a form.

```
┌───────────────────────────────────────┐
│        CHOOSE YOUR CHARACTER          │
│                                       │
│     PANDA    KOALA    RED PANDA       │
│       ●        ●          ●           │
│                                       │
│        [ SELECT / START ]             │
└───────────────────────────────────────┘
```

Requirements:

- Large pixel-art previews of all three characters, same sprite proportions/pixel density as their in-game versions.
- The hovered/selected character gets a clear pixel-art highlight, plus a small animation (idle bounce/breathe) on the selected one.
- The user must explicitly choose before entering the game — do not silently default to Panda and skip the step. This is part of onboarding, not a settings default.
- After selection, transition into the main game with a short pixel-art loading/entry animation.
- The selected character becomes the only active player character in the world.

This selection screen is separate from, and prior to, the in-HUD character switcher described in §2 and §9 — §0 is the mandatory first-run gate, §9's HUD entry point is how the user changes their mind later.

## 1. Core visual direction

- Retro 8-bit / 16-bit pixel-art aesthetic, side-scrolling platformer composition, dark forest/woodland atmosphere.
- Pixelated edges on sprites, UI borders, icons, platforms, coins, clouds, plants, environmental objects.
- Visual depth via foreground platforms, midground gameplay objects, distant forest silhouettes, trees, hills/mountains, clouds, subtle atmospheric particles.
- Avoid modern SaaS-dashboard styling: no excessive rounded cards, gradients, glassmorphism, or generic productivity-app visuals. The UI belongs *inside* the game world.

**Palette:** deep forest green (background) · near-black green (panels) · moss/grass green (platforms) · warm brown (soil, wood) · cream/off-white (primary type) · gold/yellow (coins, rewards, progression) · red (danger, lost lives, failure) · bright green (completed tasks, positive actions) · muted blue (sky/cloud when scenes brighten).

## 2. Main game screen — top HUD

- **Left:** exactly three heart slots (filled = remaining life, empty/dark = lost). Pixel-art hearts, never emoji.
- **Character indicator:** a compact representation of the currently selected character, placed between the lives area and the main title (or wherever balances best on narrow viewports). Uses the real pixel-art character sprite, never emoji. It is interactive — tapping/clicking it opens the character-selection interface from §9.
- **Center:** large pixel-art title `75 DAY HARD CHALLENGE`, with `DAY 01` (or current day) beneath it.
- **Right:** pixel-art coin counter, e.g. `🪙 ×00` rendered as an actual coin sprite, not an emoji glyph.

```
┌──────────────────────────────────────────────────────────┐
│ LIVES      [CHARACTER]      75 DAY HARD CHALLENGE   COINS │
│ ♥ ♥ ♡        PANDA                 DAY 12          ×12    │
└──────────────────────────────────────────────────────────┘
```

On mobile, the character indicator may shrink to a compact sprite/icon, but it must stay visible and discoverable — never hide it entirely after onboarding.

## 3. Today's Tasks panel

- Upper-left / left-side HUD, fixed/sticky while the world scrolls.
- Compact — the game world stays the dominant visual element, never a huge dashboard card.
- Pixel-art checkboxes; completed tasks show a checkmark state.
- Many tasks → collapse the list, scroll inside the panel, or show a compact `3/6 TASKS` indicator with an expandable panel. Never let the task UI obscure the platform path.

## 4. Progress bar placement

Lives inside the same HUD box as Day info and today's tasks — never a separate card lower on the page.

```
┌──────────────────────────┐
│ DAY 12                   │
│ Complete your tasks      │
│ to move forward!         │
│                          │
│ TODAY'S TASKS             │
│ ✓ Task 1                 │
│ ✓ Task 2                 │
│ ☐ Task 3                 │
│ ☐ Task 4                 │
│                          │
│ YOUR PROGRESS             │
│ ███████░░░░░ 12 / 75     │
└──────────────────────────┘
```

This bar shows overall 75-day progression (`12 / 75 DAYS`); today's task list shows today's completion. Don't conflate the two.

## 5. Most important gameplay rule: forward, not up

**Do not build a staircase.** Platforms must never form a continuous diagonal ascent.

Bad:
```
       █
     █
   █
 █
```

The mental model is Mario, not a stairwell: the player moves **left → right** through a long horizontal level. Platforms:

- move horizontally across the screen at varied heights (low/middle/high)
- sometimes gap, sometimes stack multiple at the same height
- occasionally dip or rise slightly
- form a forward path, continuing beyond the current viewport

```
──────────────────────────────────────────────>

       ─────             ─────
   ─────        ─────────
──────────                   ───────
              ───────
──────────────────────────────────────────────
```

## 6. Camera / world progression

Don't render all 75 days' platforms at once — use a horizontal scrolling world with parallax:

- character moves right, camera follows
- new platforms enter from the right, completed ones exit left
- background layers move at different speeds (parallax)
- the world reads as effectively endless: **current position → future → goal**, not "start → 75 stairs visible at once"

Day checkpoints (`DAY 01 ─── DAY 02 ─── ...`) are embedded naturally into the world geometry, not shown as a literal timeline widget.

## 7. Platform design

Mix terrain types — grass-topped dirt, floating brick, wooden, stone, pipes, small stepping platforms, question blocks, decorative ledges, occasional moving platforms. Thick pixel outlines, chunky textures, moss/grass edges, visible dirt/brick layers, subtle shadows. Vary platform appearance; don't repeat one asset everywhere.

**Deliberate divergence from `reference-environment.png`:** that reference scatters `?` blocks fairly densely, and their vertical arrangement (several rising in sequence across the frame) reads as a soft staircase if followed literally — the opposite of §5's core rule. Implementation should **reduce the `?`-block count** relative to the reference and place any that remain as occasional accent platforms along the horizontal path, never as the structure that carries the player upward. Grass/dirt/stone platforms should carry the main forward route; `?` blocks are seasoning, not the backbone.

## 8. Character

Single active player character: cute chibi panda. Small body, oversized head, expressive eyes, tiny limbs, pixel-art rendering, readable silhouette at small sizes. Exactly one panda instance in the world — never duplicate.

## 9. Character selection

Selection has two states:

1. **Initial selection** (§0) — shown before the main interface loads, mandatory, blocks entry.
2. **Persistent selection** — reopened later from the top HUD character indicator (§2).

Three playable characters share one visual language/proportions: **Panda** (default), **Chibi Koala**, **Chibi Red Panda**.

```
┌─────────┐ ┌─────────┐ ┌────────────┐
│  PANDA  │ │  KOALA  │ │  RED PANDA │
│   🐼    │ │   🐨    │ │    🦊      │
└─────────┘ └─────────┘ └────────────┘
```

Selected character gets a clear pixel-art selection indicator.

**Changing character is cosmetic, never a reset.** Switching Panda → Koala or Panda → Red Panda (from the HUD, mid-challenge) must:

- keep the current day, task completion, lives, coins, and 75-day progress exactly as they are
- replace only the active player sprite and its animations
- apply immediately in the game world
- never create a duplicate player character or leave the old sprite behind

## 10. Coins

Gold pixel-art coins with a panda imprint, bright outline, subtle sparkle, small collection animation. Placed along the forward path (never in a vertical staircase) to mark optional rewards, task-completion rewards, milestones, or exploration incentives.

## 11. Start board & guardian plant

Wooden pixel-art `START` sign at the beginning of the horizontal level. One animated zombie/piranha-style plant sits beside it at the start area **only** — no eyes, large open mouth, stylized-dangerous, pixel-animated. It symbolizes failure/stagnation. Do not scatter it (or skulls, or any repeated "danger" decoration) throughout the level.

## 12. Failure mechanic

```
TASKS COMPLETE  → character moves forward →
TASK MISSED     → character falls backward ←
ALL 3 LIVES LOST → RESET → DAY 01
```

On failure: character stops progressing, falls backward, one heart is lost, world briefly shows a backward/fall animation. Feedback copy example: `NO PROGRESS` / `THE PLANT SENDS YOU BACK TO THE BEGINNING!`. Losing all three lives resets to Day 01 — visually dramatic but concise, not a wall of text.

## 13. Victory state

On completing the day's tasks: character reaches the goal/checkpoint, flag appears, coins/rewards animate, hearts stay visible, optional confetti/sparkles. Copy: `VICTORY!` / `DAY 12 COMPLETE`. This is a classic platformer level-clear composition — not a generic success modal.

## 14. Environment layering

```
Layer 1 — distant sky / mountains
Layer 2 — distant forest
Layer 3 — trees and foliage
Layer 4 — gameplay platforms
Layer 5 — character / enemies / coins
Layer 6 — HUD
```

Clouds drift horizontally; trees/distant scenery parallax; foreground moves faster than background.

## 15. Horizontal level composition

Every viewport is a slice of a larger world — platforms may bob up/down slightly but primarily communicate forward horizontal travel. Never a diagonal staircase.

## 16. Responsive behavior

- **Desktop:** wide platformer viewport, world dominates the screen, HUD overlays without covering the path.
- **Mobile:** vertical game viewport that still represents left→right progress; task HUD becomes a compact overlay/card. Preserve character/platform/heart/coin/task readability by cropping/scrolling the world intelligently — don't just shrink the whole desktop layout down.

## 17. Typography

Pixel-style fonts throughout.

- **Primary** (large block pixel font): `75 DAY`, `HARD CHALLENGE`, `VICTORY!`
- **Secondary** (pixel/monospace): `DAY 12`, `TODAY'S TASKS`, `12 / 75 DAYS`
- **Body**: readable pixel/retro font — avoid thin modern sans-serif.

## 18. Pixel-art consistency

Keep consistent pixel density, sprite scale, outline thickness, lighting direction, texture density, palette, shadow treatment, and UI border treatment across every element. Never mix in realistic images, smooth vector illustrations, modern 3D assets, photorealistic backgrounds, or emoji-style icons.

## 19. Animation rules

- **Character:** idle breathing, walking, jumping, falling backward, victory pose.
- **Coins:** spinning, sparkle on collection.
- **Clouds:** slow horizontal drift.
- **Plant:** idle bobbing, mouth movement, subtle attack animation on failure.
- **Platforms (optional):** moving platform, small bounce on landing.

Keep animations subtle enough that the UI stays usable. Per [CLAUDE.md](../../../CLAUDE.md), animation state must never become application state — state updates first, animation follows.

## 20. Information hierarchy

1. Where am I? (day number, character position)
2. What do I need to do today? (task list)
3. How am I doing? (lives, task completion, 75-day progress)
4. Where am I going? (horizontal platform path)
5. What happens if I fail? (plant / hearts / fallback)
6. What happens if I succeed? (goal / flag / victory / rewards)

## 21. Do not

- Turn the platform path into a staircase.
- Show dozens of platforms stacked vertically.
- Put the entire 75-day journey on one screen.
- Duplicate the player character.
- Scatter zombie plants (or skulls) throughout the level as repeated decoration.
- Let task cards cover the gameplay path.
- Move the progress bar into a separate bottom card.
- Replace pixel-art icons with emoji.
- Make the UI resemble a normal productivity SaaS dashboard.
- Sacrifice gameplay readability for decorative elements.
- Load the main game interface before the initial character-selection step (§0) is completed.
- Hide the selected character completely after onboarding — keep a compact indicator in the top HUD (§2).
- Reset challenge progress, lives, coins, or day count when the user changes character.
- Copy the reference's `?`-block density/arrangement literally — thin it out per the §7 note.

## 22. Design north star

> "My daily habits are the actions that control my character in a retro platformer."

Not: "I am checking boxes on a tracker." The loop is: complete tasks → move forward → collect coins → survive → reach checkpoint → unlock next day.

**The single most important spatial rule: progression is horizontal forward movement, not vertical stair-climbing.** Every visual decision should reinforce this.
