# CLAUDE.md — 75 Day Hard Challenge: Panda Forest Game Specification

## 0. Purpose

Build a **fully functional 75 Day Hard Challenge gamification experience** based on the supplied visual reference.

The product is a habit/challenge game in which a **single baby chibi panda** travels upward through a dark, atmospheric pixel-art forest. Every day contains a user-selected number of tasks. Each task maps to one floating grassy stone/platform on that day's path.

The panda starts at the beginning of the path and **runs initially, then hops/jumps from platform to platform as tasks are completed**.

The system must be deterministic, persistent, recoverable, and fail-safe. The visual experience can be playful, but the underlying progress/life logic must never create impossible, duplicated, or contradictory states.

---

# 1. Non-Negotiable Product Rules

These rules have priority over visual polish.

1. The challenge is exactly **75 days**.
2. There is exactly **one active panda character** in the gameplay scene.
3. Do NOT render two pandas simultaneously as active player characters.
4. The panda begins at the starting point on Day 1 / reset state.
5. The panda initially has a short **running animation**, then transitions to hopping/jumping between floating grassy stones.
6. The number of task platforms for a day equals the number of tasks selected for that day.
7. Each task can be completed only once per day.
8. Completing a task advances the panda by exactly one task step.
9. The panda may never advance farther than the number of completed tasks.
10. The panda may never move backward merely because the UI re-rendered.
11. Refreshing, reopening the application, navigating away, or closing the browser must not lose committed progress.
12. Every mutation must be persisted before the UI treats it as permanently committed.
13. Duplicate clicks/taps must not complete a task twice.
14. The same day must not be counted twice.
15. A missed day/task must never accidentally count as completed.
16. A failed task/day must correctly affect lives according to the life rules below.
17. When all lives are lost, the challenge resets to the beginning.
18. Resetting must clear challenge progress and restore the panda to the first stage/start point.
19. The progress bar must be inside the upper task/dialog card directly below the `DAY XX` heading.
20. Do not place a second panda in the main path as decoration.
21. Coins must use a panda imprint/icon and must be visually collectible/earned, but must never become a source of truth for challenge completion.
22. Never use animation state as application state.
23. Never infer completion from panda position alone.
24. Never infer lives from visual heart count alone.
25. The source of truth is the persisted challenge state.

---

# 2. Visual Direction

Use the supplied screenshot as the **visual reference**, not as a literal UI screenshot to copy pixel-for-pixel.

The desired visual language is:

- dark enchanted forest
- pixel-art / retro game aesthetic
- deep green-black background
- mossy floating stone platforms
- glowing golden coins
- tiny flags
- warm cream/gold typography
- bright green completed-task indicators
- red hearts for lives
- chibi baby panda
- subtle fireflies/glowing particles
- old-school game HUD
- cozy but challenging atmosphere
- high contrast for important interactive elements
- responsive layout for desktop and mobile

The screenshot shows:

- top navigation/menu
- `75 DAY HARD CHALLENGE`
- hearts/lives
- `DAY XX`
- today's tasks
- progress indicator
- forest gameplay area
- panda on a platform
- ascending platforms
- golden panda coins
- flag at the endpoint
- missed-task explanation
- bottom navigation

Preserve this information hierarchy while making the implementation cleaner and functional.

### Important visual correction

The reference image contains two panda figures because one is shown in the gameplay area and another appears in the explanatory section.

For the actual application gameplay:

**Render only one panda player.**

If an explanatory/help section is retained, use a static miniature icon or illustration that is clearly not another active player, or omit the explanatory panda entirely.

---

# 3. Six-Stage Implementation Plan

Implement the product in these six stages.

---

## STAGE 1 — Foundation, Onboarding, and Challenge Setup

### Goal

Create the challenge shell and define the user's 75-day challenge.

### Required features

The user must be able to:

- start a new 75-day challenge
- choose the number of daily tasks
- create task names
- edit task names before starting
- optionally choose whether the same tasks repeat every day
- optionally create different tasks for individual days if the product supports it
- see the selected number of tasks
- see the initial life count
- start the challenge

### Default configuration

Use:

```text
challengeDays = 75
initialLives = 3
minimumTasksPerDay = 1
maximumTasksPerDay = 12
```

If the product needs a different maximum later, make it configurable rather than hard-coding it into rendering logic.

### Example

If the user chooses:

```text
1. Go to gym
2. Read 20 pages
3. Drink 2L water
4. Meditate 10 min
```

then Day 1 has exactly four task steps.

The path must contain four task platforms/steps plus the start/end visual treatment.

### Setup validation

Do not allow challenge creation when:

- there are zero tasks
- a task has an empty name
- duplicate task IDs exist
- the number of tasks exceeds the configured maximum
- challenge duration is not 75 days
- persisted state cannot be initialized safely

Display human-readable validation messages.

### Fail-safe rule

If initialization fails, do not create a partially initialized challenge.

Use:

```text
validate → construct state → persist → verify → enter gameplay
```

not:

```text
enter gameplay → try to save later
```

---

# STAGE 2 — Daily Task System and Panda Movement

## Goal

Turn tasks into physical movement through the forest.

### Core game mapping

For a day with `N` tasks:

```text
Start → Platform 1 → Platform 2 → ... → Platform N → Day Flag
```

Each task corresponds to one progression step.

### Panda movement

At the beginning of a day:

```text
panda.positionIndex = 0
```

When task `i` becomes completed:

```text
panda.positionIndex = i
```

where:

```text
0 <= i <= N
```

Do not allow:

```text
positionIndex > completedTaskCount
```

### Animation sequence

When the user completes a task:

1. task checkbox/button changes to completed
2. persist the new state
3. start panda movement animation
4. panda runs briefly toward the next jump point
5. panda jumps/hops to the next grassy floating stone
6. panda lands
7. coin glows/animates
8. progress UI updates
9. if all tasks are complete, panda reaches the endpoint/flag

The visual animation must not determine whether the task was completed.

The state update happens first; animation follows state.

### Animation failure safety

If an animation is interrupted:

- progress remains correct
- task remains completed
- panda can snap to the correct state-derived position
- restarting the animation must never duplicate a reward
- route rendering must be reproducible from state

### Reduced motion

Respect:

```css
@media (prefers-reduced-motion: reduce)
```

In reduced-motion mode:

- remove long running animations
- use short fades or direct position transitions
- preserve all game logic

---

# STAGE 3 — Lives, Failure, Reset, and Progress Rules

## Goal

Make failure meaningful without allowing ambiguous states.

## Lives

Default:

```text
3 lives
```

Represent visually as:

```text
❤️ ❤️ ♡
```

or equivalent pixel-art heart sprites.

### Life meaning

A life represents the user's allowed failure buffer.

A task that remains incomplete at the day's finalization/deadline causes a failure event according to the configured daily failure policy.

Do not remove a life immediately merely because the user has not completed a task yet during an active day.

### Important distinction

These states are different:

```text
pending
completed
failed
```

Do not use:

```text
false = failed
```

because an active task may simply still be pending.

### Recommended daily state

```text
ACTIVE
COMPLETED
FAILED
```

A day becomes `FAILED` only when its deadline/failure condition is reached and required tasks remain incomplete.

### What happens after failure

When a day fails:

1. mark the day as failed
2. decrement lives exactly once
3. persist the mutation
4. show a failure animation/message
5. move the panda backward according to the reset policy
6. continue the challenge if lives remain
7. reset the failed day's active movement state

### Do not double-charge a life

Every failed day must have a stable unique event/id.

Example:

```text
failureEventId = `${challengeId}:${dayNumber}:failure`
```

Before decrementing lives, check whether the failure has already been applied.

If already applied:

```text
do nothing
```

This protects against:

- refreshes
- double clicks
- multiple tabs
- repeated deadline checks
- race conditions
- React Strict Mode
- retry logic

---

# STAGE 4 — Six-Stage Panda Progression and Challenge Journey

The challenge must have **six visual progression stages** across the 75-day journey.

These are not six separate challenges. They are six chapters of the same 75-day challenge.

Use:

| Stage | Days | Theme | Panda Evolution |
|---|---:|---|---|
| Stage 1 | 1–12 | Forest Entrance | Baby Panda |
| Stage 2 | 13–25 | Mossy Trail | Growing Panda |
| Stage 3 | 26–38 | Moonlit Grove | Adventurer Panda |
| Stage 4 | 39–50 | Ancient Forest | Stronger Panda |
| Stage 5 | 51–63 | Golden Canopy | Veteran Panda |
| Stage 6 | 64–75 | Summit Sanctuary | Champion Panda |

These stage ranges must be constants, not scattered magic numbers.

### Stage transitions

The stage is derived from:

```text
dayNumber
```

and not manually stored as an independent mutable state.

Example:

```ts
function getStage(day: number): ChallengeStage {
  if (day <= 12) return "entrance";
  if (day <= 25) return "mossy-trail";
  if (day <= 38) return "moonlit-grove";
  if (day <= 50) return "ancient-forest";
  if (day <= 63) return "golden-canopy";
  return "summit-sanctuary";
}
```

### Stage failure behavior

If all three lives are lost:

```text
challengeStatus = RESET_REQUIRED
```

then:

- reset day to 1
- reset challenge progress to 0
- reset lives to 3
- reset daily task states
- reset panda to Stage 1 / starting platform
- clear stage-specific earned state that is explicitly challenge-scoped
- preserve user task templates unless the user explicitly chooses "delete challenge"
- show a clear reset message

Do not silently delete the user's configured tasks.

### Important interpretation of "first stage"

Losing all lives means the **challenge journey** returns to Stage 1.

The user does not lose their account, settings, task templates, or application data.

---

# STAGE 5 — Persistence, Progress Calculation, Recovery, and Edge Cases

## Goal

Make the game safe against refreshes, crashes, duplicate actions, and inconsistent local state.

## Source of truth

Use a single normalized challenge state.

Recommended TypeScript model:

```ts
type TaskStatus = "pending" | "completed";

type DailyTask = {
  id: string;
  title: string;
  status: TaskStatus;
  completedAt?: string;
};

type DayRecord = {
  dayNumber: number;
  dateKey: string;
  tasks: DailyTask[];
  status: "active" | "completed" | "failed";
  completedCount: number;
  totalCount: number;
  progressPercent: number;
  failureApplied: boolean;
  startedAt: string;
  completedAt?: string;
  failedAt?: string;
};

type ChallengeState = {
  schemaVersion: number;
  challengeId: string;
  status: "setup" | "active" | "completed" | "reset";
  totalDays: 75;
  currentDay: number;
  lives: number;
  initialLives: number;
  currentStage: number;
  tasksPerDay: number;
  taskTemplates: {
    id: string;
    title: string;
  }[];
  days: DayRecord[];
  totalCompletedTasks: number;
  totalTaskOpportunities: number;
  overallProgressPercent: number;
  coins: number;
  createdAt: string;
  updatedAt: string;
};
```

### Derived state

Prefer deriving these values instead of storing duplicates:

```text
currentStage
pandaPosition
currentDayProgress
dailyCompletedCount
```

The persisted state may cache values for performance, but the application must be able to recompute them.

### Progress calculation

There are two different progress values and they must not be confused.

#### A. Current-day progress

```text
currentDayProgress =
completedTasksToday / totalTasksToday
```

Example:

```text
3 completed out of 4
= 75%
```

The progress bar inside the Day card should show this current-day progress.

#### B. Overall challenge progress

Use a task-weighted calculation:

```text
overallProgress =
totalCompletedTasks / totalTaskOpportunities
```

For 75 days with four tasks per day:

```text
300 total task opportunities
```

If 120 are completed:

```text
120 / 300 = 40%
```

This is more stable than averaging days with different task counts.

### Handling "no progress"

If a day has:

```text
completedCount = 0
```

then:

```text
currentDayProgress = 0%
```

Do not carry yesterday's visual position into today's task path.

The panda begins the new day's route at:

```text
positionIndex = 0
```

### Handling partial progress

If the user completes:

```text
2 / 4 tasks
```

then:

```text
currentDayProgress = 50%
```

and the panda sits at the second task platform.

Do not visually place the panda halfway between platform 2 and 3 unless the animation is currently transitioning.

### End-of-day behavior

At the configured day boundary:

- if all tasks are complete → day succeeds
- if required tasks are incomplete → day fails according to the challenge policy
- do not automatically fail a day while it is still active

### Midnight and timezone safety

Store:

```text
dateKey
timezone
timestamps
```

Use the user's configured/local timezone consistently.

Do not compare UTC calendar dates directly against local calendar dates without conversion.

If timezone support is not implemented initially, clearly centralize the date calculation in one utility so it can be upgraded later.

### Refresh recovery

On app startup:

1. load persisted state
2. validate schema
3. migrate old schema if necessary
4. validate invariants
5. repair only safe derived values
6. reject unrecoverable corrupted state
7. show recovery UI rather than silently inventing progress

### Schema versioning

Always include:

```ts
schemaVersion
```

Example:

```text
1
```

When changing persisted structures, write migrations.

Never assume old local storage is already in the newest format.

### Corrupt-state recovery

If persisted data is invalid:

1. preserve the raw corrupted record if possible
2. do not overwrite it immediately
3. show:
   `We found damaged challenge data.`
4. offer:
   - Restore last valid backup
   - Start a new challenge
5. never fabricate completed tasks

Maintain a lightweight backup:

```text
challengeState.backup
```

or equivalent.

---

# STAGE 6 — Polish, UX, Accessibility, Testing, and Production Hardening

## Goal

Make the result feel like a real game rather than a static mockup.

---

# 4. Main Screen Layout

Build the screen around this hierarchy.

```text
┌──────────────────────────────────────┐
│ ☰     75 DAY HARD CHALLENGE   ❤️❤️❤️ │
│                                      │
│ ┌──────────────────────────────┐     │
│ │ DAY 12                       │     │
│ │ Complete your tasks          │     │
│ │ to climb higher!             │     │
│ │                              │     │
│ │ TODAY'S TASKS                │     │
│ │ ☑ Go to gym                  │     │
│ │ ☑ Read 20 pages              │     │
│ │ ☑ Drink 2L water             │     │
│ │ ☐ Meditate 10 min            │     │
│ │                              │     │
│ │ YOUR PROGRESS                │     │
│ │ ███████████░░░░              │     │
│ │ 3 / 4 TASKS                  │     │
│ └──────────────────────────────┘     │
│                                      │
│          🌲 FOREST GAME AREA 🌲      │
│                                      │
│                 🪙                  🚩 │
│             ━━━━━━━                  │
│          🐼                            │
│        ━━━━━                            │
│           ━━━━━  🪙                   │
│              ━━━━━                    │
│                                      │
│                                      │
├──────────────────────────────────────┤
│ HOME      STATS      HABITS   PROFILE │
└──────────────────────────────────────┘
```

The actual UI should use assets/CSS/SVG rather than emoji where possible.

---

# 5. Task Card

The top task card must contain:

1. `DAY XX`
2. stage indicator
3. motivational subtitle
4. today's task list
5. current-day progress bar
6. numeric task progress

Example:

```text
DAY 12
FOREST ENTRANCE

Complete your tasks
to climb higher!

TODAY'S TASKS

☑ Go to gym
☑ Read 20 pages
☑ Drink 2L water
☐ Meditate 10 min

YOUR PROGRESS

██████████░░░░
3 / 4 TASKS
```

### Progress bar requirement

The progress bar MUST be:

- inside the upper dialog/card
- below the day/task information
- below `DAY XX`
- based on current-day completed tasks
- updated immediately after successful persistence
- accessible with an aria label

Example:

```text
aria-label="Today's progress: 3 of 4 tasks completed"
```

---

# 6. Forest Gameplay Area

The forest should occupy the majority of the screen.

### Background layers

Use layered visuals:

1. near-black/green background
2. distant forest silhouettes
3. mid-ground trees
4. foliage
5. fireflies/particles
6. floating platforms
7. panda
8. coins
9. flags
10. foreground grass

This creates depth without requiring a huge raster image.

### Pixel-art feel

Use:

- hard edges
- limited visual palette
- subtle dithering
- pixelated shadows
- small sprite-like decorations
- no excessive gradients
- no modern glossy 3D UI

If using CSS, prefer:

```text
box-shadow
border
background-image
radial gradients used sparingly
SVG patterns
pixel sprites
```

Do not make the interface look like a generic modern SaaS dashboard.

---

# 7. Platform Generation

The platform path must be generated from task count.

For:

```text
tasks = 4
```

generate:

```text
Start
 ↓
Platform 1 + Coin 1
 ↓
Platform 2 + Coin 2
 ↓
Platform 3 + Coin 3
 ↓
Platform 4 + Coin 4
 ↓
Goal Flag
```

### Platform constraints

Every platform must:

- be reachable visually
- have sufficient horizontal/vertical separation
- remain within the playable viewport
- avoid overlapping the task dialog
- avoid the bottom navigation
- have enough space for the panda sprite
- have a grass/moss top
- have a stone/earth underside
- have subtle shadowing

### Responsive generation

Do not hard-code desktop pixel coordinates only.

Use a normalized coordinate system:

```ts
type Point = {
  x: number; // 0..1
  y: number; // 0..1
};
```

Then convert normalized coordinates to viewport coordinates.

This allows the path to work on:

- desktop
- tablet
- mobile

### Path generation

Use deterministic seeded generation.

Example:

```text
seed = challengeId + dayNumber
```

This ensures that:

- the same day produces the same path
- refreshing does not randomly move platforms
- users do not see the path change every render

---

# 8. Coins

Each task platform can have one golden coin.

Coin appearance:

- gold outer ring
- glowing edge
- panda imprint
- small pixel highlight
- subtle floating/bobbing animation

### Coin rules

A coin may visually become "collected" when the corresponding task is completed.

But:

**coin count is never the source of truth for task completion.**

Task state controls coin state.

For task `i`:

```text
task.completed === true
→ coin i is collected
```

Never:

```text
coin clicked
→ task automatically completed
```

unless the product explicitly adds that mechanic later.

### Coin persistence

If coins are counted:

```text
coins += 1
```

must happen exactly once per task.

Use a stable reward ID:

```text
rewardId = `${challengeId}:${dayNumber}:task:${taskId}`
```

Maintain a reward ledger or equivalent idempotency mechanism.

---

# 9. Panda Character

The player character is a **single baby chibi panda**.

### Required animation states

```text
idle
running
jumping
landing
celebrating
falling
resetting
```

### Initial movement

When the gameplay screen opens:

```text
idle → short run → ready/idle
```

When the user completes a task:

```text
idle
→ run
→ jump
→ land
→ idle
```

### Position state

The panda's logical position is:

```ts
pandaPosition = completedTaskCount
```

The visual position is derived from the current day's generated platform coordinates.

### Critical invariant

Never store an arbitrary panda coordinate as the authoritative progress state.

Bad:

```ts
pandaX = 483
pandaY = 271
```

Good:

```ts
completedTaskCount = 3
```

Then calculate:

```text
panda coordinate = platformCoordinates[3]
```

---

# 10. Day Completion

When all tasks are completed:

```text
completedCount === totalCount
```

the day becomes complete.

Sequence:

1. complete final task
2. persist task completion
3. animate final jump
4. collect final coin
5. panda reaches flag
6. show celebration
7. update day status
8. persist day completion
9. update overall challenge progress
10. unlock next day

### Do not skip directly to the next day

Allow the player to see the completion state.

Example:

```text
DAY 12 COMPLETE!

🐼
     🏁

All tasks completed!
+1 day conquered
```

Then provide:

```text
CONTINUE TO DAY 13
```

or automatic transition after a short delay.

The user must always be able to understand what happened.

---

# 11. Day Transition

When starting a new day:

```text
currentDay += 1
```

only once.

Create the next day's task records.

Reset only:

```text
daily task completion
panda position
daily animation state
daily progress
```

Do NOT reset:

```text
lives
overall progress
challenge day count
earned challenge statistics
```

---

# 12. Failure / Missed Task UI

Use a clear but non-punitive message.

Example:

```text
💔 MISSED A TASK?

The panda falls back...

Complete your tasks
to keep climbing!
```

The failure screen should explain:

- what was missed
- how many lives remain
- what happens next
- whether the challenge continues
- whether the panda has moved back

Avoid shaming language.

---

# 13. All Lives Lost

If:

```text
lives === 0
```

the user has failed the current 75-day run.

Show:

```text
CHALLENGE RESET

The forest journey starts again.

Your 75-day adventure
returns to Day 1.

Lives restored: ❤️ ❤️ ❤️
```

Actions:

```text
START AGAIN
VIEW STATS
```

### Reset transaction

The reset must be atomic.

Conceptually:

```ts
resetChallenge() {
  const newState = createInitialChallengeState(existingConfig);

  persist(newState);

  verify(newState);

  render(newState);
}
```

Do not mutate ten independent UI states and hope they all reset.

---

# 14. Stats

The Stats screen should show at least:

```text
DAY 12 / 75
OVERALL PROGRESS 37%

TASKS COMPLETED
42 / 112

CURRENT STREAK
8 DAYS

BEST STREAK
14 DAYS

LIVES
❤️ ❤️ ♡

COINS
42
```

Also show:

- completion rate
- missed tasks
- failed days
- completed days
- current stage
- average tasks completed per day

### Stats must be derived

Whenever possible calculate stats from `days[]`.

Do not maintain five independent counters that can drift apart.

---

# 15. Habits / Task Management

The Habits section should allow:

- viewing task templates
- editing task names
- enabling/disabling repeating tasks
- adding a task
- removing a task
- reordering tasks

Do not allow destructive editing of a historical task record.

If the user renames:

```text
Read 20 pages
```

to:

```text
Read 30 pages
```

historical completed records should retain the original historical label.

---

# 16. Profile / Settings

Include:

- challenge settings
- notifications/reminders if supported
- sound on/off
- music on/off
- reduced motion
- theme
- timezone
- export data
- import data
- reset challenge
- delete challenge data

### Destructive actions

Require confirmation for:

```text
Reset challenge
Delete challenge
Delete all data
```

Use explicit confirmation text.

---

# 17. Accessibility

The game must remain usable without animation.

Required:

- keyboard navigation
- visible focus state
- semantic buttons
- labels for checkboxes
- accessible progress bars
- sufficient contrast
- screen-reader text for visual-only state
- reduced-motion support

Example:

```html
<button
  aria-label="Complete task: Read 20 pages"
>
```

Do not make task completion depend solely on drag-and-drop or animation.

---

# 18. Data Integrity Invariants

Create a central validation function.

Example:

```ts
function validateChallengeState(state: ChallengeState): string[] {
  const errors: string[] = [];

  if (state.totalDays !== 75) {
    errors.push("Challenge must contain exactly 75 days.");
  }

  if (state.lives < 0 || state.lives > state.initialLives) {
    errors.push("Lives are outside the valid range.");
  }

  if (state.currentDay < 1 || state.currentDay > 75) {
    errors.push("Current day is invalid.");
  }

  for (const day of state.days) {
    if (day.completedCount < 0) {
      errors.push(`Day ${day.dayNumber} has invalid completed count.`);
    }

    if (day.completedCount > day.totalCount) {
      errors.push(`Day ${day.dayNumber} completed count exceeds total.`);
    }

    const actualCompleted = day.tasks.filter(
      task => task.status === "completed"
    ).length;

    if (actualCompleted !== day.completedCount) {
      errors.push(`Day ${day.dayNumber} count does not match task state.`);
    }
  }

  return errors;
}
```

Add additional invariants as implementation evolves.

---

# 19. Idempotency Rules

Every important user action must be safe to repeat.

## Complete task

```text
if task.status === completed:
    return existing state
```

Do not reward twice.

## Fail day

```text
if failureApplied === true:
    return existing state
```

Do not remove another life.

## Complete day

```text
if day.status === completed:
    return existing state
```

Do not increment the day twice.

## Reset challenge

If reset has already happened, repeated reset requests must not corrupt the new challenge.

---

# 20. Multi-Tab Safety

If using browser local storage:

- listen for `storage` events where appropriate
- revalidate state after external updates
- avoid blindly overwriting newer state with stale state
- use a version/revision number

Recommended:

```ts
stateRevision: number
```

Before writing:

```text
read latest
compare revision
apply mutation
increment revision
write
```

For more complex concurrent behavior, use IndexedDB with a transaction layer.

---

# 21. Persistence Strategy

If the app is a client-only prototype:

Use:

```text
localStorage
```

for the first implementation.

If the application stores substantial history or needs robust transactions:

Use:

```text
IndexedDB
```

or a backend.

Do not introduce a backend just for the sake of architecture.

### Storage keys

Namespace storage:

```text
75-hard-challenge:v1:state
75-hard-challenge:v1:backup
75-hard-challenge:v1:settings
```

Do not use generic keys such as:

```text
data
state
progress
```

---

# 22. Suggested Architecture

If the existing repository has a framework, follow it.

If no framework is present, prefer:

```text
React
TypeScript
CSS / CSS Modules
```

Suggested structure:

```text
src/
  components/
    ChallengeHeader
    Lives
    DayCard
    TaskList
    TaskItem
    ProgressBar
    ForestScene
    Panda
    Platform
    Coin
    GoalFlag
    FailureBanner
    BottomNavigation

  game/
    platformGenerator
    stageSystem
    pandaMovement
    animationState

  state/
    challengeStore
    selectors
    mutations
    validators
    migrations

  persistence/
    storage
    backup
    migrations

  utils/
    date
    ids
    math

  types/
    challenge
```

Do not put all game logic inside the main page component.

---

# 23. State Mutation API

Centralize mutations.

Suggested API:

```ts
completeTask(dayNumber: number, taskId: string)

failDay(dayNumber: number)

completeDay(dayNumber: number)

advanceToNextDay()

loseLife(reason: string)

resetChallenge()

restartChallenge()

addTaskTemplate(task: TaskTemplate)

updateTaskTemplate(taskId: string, title: string)

removeTaskTemplate(taskId: string)
```

Each mutation should:

1. load current state
2. validate preconditions
3. calculate next state
4. validate next state
5. persist next state
6. update UI
7. trigger animation/event

---

# 24. Event-Based Animation

Separate state from animation.

Example:

```ts
type GameEvent =
  | {
      type: "TASK_COMPLETED";
      dayNumber: number;
      taskId: string;
      taskIndex: number;
    }
  | {
      type: "DAY_COMPLETED";
      dayNumber: number;
    }
  | {
      type: "DAY_FAILED";
      dayNumber: number;
    }
  | {
      type: "CHALLENGE_RESET";
    };
```

The animation system consumes events.

The state system does not depend on the animation system succeeding.

This is critical.

---

# 25. Platform State Mapping

For a day:

```ts
const completed = day.completedCount;

const pandaPlatformIndex = Math.min(
  completed,
  day.totalCount
);
```

The platform array must be generated from:

```text
dayNumber
taskCount
seed
viewport dimensions
```

The panda position must then be:

```ts
platforms[pandaPlatformIndex]
```

This makes the scene deterministic.

---

# 26. Path Generation Example

Use a deterministic seeded generator.

Pseudo-code:

```ts
function generatePlatforms(
  dayNumber: number,
  taskCount: number,
  seed: string
): Platform[] {
  const random = createSeededRandom(seed);

  return Array.from({ length: taskCount }, (_, index) => {
    return {
      id: `day-${dayNumber}-platform-${index}`,
      x: calculateSafeX(index, taskCount, random),
      y: calculateSafeY(index, taskCount, random),
      taskIndex: index,
    };
  });
}
```

Do not generate random positions directly inside React rendering.

Bad:

```ts
Math.random()
```

inside component rendering.

This causes platforms to move after re-renders.

---

# 27. Responsive Gameplay

On mobile:

- reduce platform spacing
- scale panda appropriately
- keep task card readable
- allow vertical scrolling only if necessary
- keep the active platform visible
- do not let the bottom nav cover the panda
- keep touch targets at least approximately 44px where possible

On desktop:

- use a larger forest viewport
- allow richer background detail
- keep task card readable and fixed/sticky where appropriate

---

# 28. Visual Layering

Use CSS/SVG layering approximately like:

```text
Forest Background
↓
Distant Trees
↓
Mid Trees
↓
Fireflies
↓
Platforms
↓
Coins
↓
Panda
↓
Foreground Grass
↓
HUD
```

The HUD must remain readable above the gameplay scene.

---

# 29. Sound

If sound is implemented:

Events:

```text
task complete → soft coin sound
jump → short hop sound
landing → soft impact
day complete → celebration sound
life lost → muted low tone
challenge reset → reset sound
```

Never autoplay audio without respecting browser policies.

Provide:

```text
Sound ON/OFF
```

and persist the setting.

---

# 30. Failure-Safe Interaction Rules

### Task click

```text
User clicks task
↓
Check day is active
↓
Check task exists
↓
Check task is pending
↓
Create next state
↓
Validate
↓
Persist
↓
Verify persistence
↓
Render completed task
↓
Emit TASK_COMPLETED event
↓
Animate panda
```

### Invalid click

If the task is already completed:

```text
No-op
```

If the day is locked:

```text
No-op + optional explanation
```

If the challenge has reset:

```text
No-op + show Day 1 state
```

Never throw an uncaught error for a normal repeated user action.

---

# 31. Prevent Common Bugs

Explicitly guard against:

- double task completion
- double life deduction
- double day advancement
- duplicate coins
- panda moving two platforms for one task
- panda moving before persistence
- progress bar exceeding 100%
- negative lives
- day 0
- day 76
- task count 0
- completed tasks > total tasks
- random platform movement after re-render
- duplicate panda rendering
- stale state overwriting newer state
- reset wiping user task templates accidentally
- failed day being failed multiple times
- refresh resetting animations incorrectly
- midnight causing two day transitions
- timezone causing a day to be skipped
- animation completing a task
- coin click bypassing task completion
- stage being manually inconsistent with day number

---

# 32. Testing Requirements

Write automated tests for the state engine.

At minimum:

### Challenge initialization

```text
new challenge
→ 75 days
→ 3 lives
→ day 1
→ 0 completed tasks
```

### Task completion

```text
4 tasks
complete task 1
→ progress = 25%
→ panda index = 1
```

### Multiple tasks

```text
4 tasks
complete 1, 2, 3
→ progress = 75%
→ panda index = 3
```

### Full completion

```text
4 / 4
→ day complete
→ progress = 100%
```

### Duplicate completion

```text
complete task 1
complete task 1 again
→ still 1 completed task
→ no duplicate coin
```

### Failure

```text
3 lives
fail day
→ 2 lives
```

### Duplicate failure

```text
fail same day twice
→ still 2 lives
```

### Full reset

```text
lives = 1
fail day
→ lives = 0
→ challenge reset
→ day = 1
→ lives = 3
→ progress = 0
→ panda = start
```

### Persistence

```text
complete 2 tasks
refresh
→ 2 tasks remain completed
→ panda remains at platform 2
```

### Corruption

```text
invalid stored state
→ recovery path
→ no fabricated progress
```

### Stage boundaries

Test:

```text
1  → Stage 1
12 → Stage 1
13 → Stage 2
25 → Stage 2
26 → Stage 3
38 → Stage 3
39 → Stage 4
50 → Stage 4
51 → Stage 5
63 → Stage 5
64 → Stage 6
75 → Stage 6
```

---

# 33. Visual Acceptance Checklist

The final screen should communicate immediately:

- this is a 75-day challenge
- what day the user is on
- how many lives remain
- what today's tasks are
- how much of today's work is complete
- where the panda is
- how far the panda has climbed
- what happens when a task is completed
- what happens if the user fails
- what stage the user is in

The screen should feel like:

> "I am playing a tiny forest adventure where my real habits move my panda forward."

Not:

> "I am using a normal checklist with a panda picture."

---

# 34. Exact Gameplay Example

Assume the user selected four daily tasks:

```text
Task 1 — Go to gym
Task 2 — Read 20 pages
Task 3 — Drink 2L water
Task 4 — Meditate 10 min
```

Initial state:

```text
Day: 12
Lives: ❤️ ❤️ ❤️
Completed: 0 / 4
Progress: 0%
Panda: Start
```

After Task 1:

```text
Completed: 1 / 4
Progress: 25%
Panda: Platform 1
Coin 1: collected
```

After Task 2:

```text
Completed: 2 / 4
Progress: 50%
Panda: Platform 2
Coin 2: collected
```

After Task 3:

```text
Completed: 3 / 4
Progress: 75%
Panda: Platform 3
Coin 3: collected
```

Task 4 remains pending.

At the day deadline, if the policy is to require all tasks:

```text
Day 12: FAILED
Lives: ❤️ ❤️ ♡
```

The panda falls back according to the failure animation and the next state is persisted.

If the user eventually loses the last life:

```text
Lives: ♡ ♡ ♡

→ RESET

Day: 1
Progress: 0%
Panda: Stage 1 starting platform
Lives: ❤️ ❤️ ❤️
```

---

# 35. Progress Bar Requirements

The progress bar inside the Day card must never exceed:

```text
0% <= progress <= 100%
```

Calculate:

```ts
const progress =
  totalTasks === 0
    ? 0
    : Math.round((completedTasks / totalTasks) * 100);
```

Then clamp defensively:

```ts
const safeProgress = Math.max(
  0,
  Math.min(100, progress)
);
```

The numeric display and visual bar must use the same computed value.

---

# 36. Panda Falling Back

When the user fails:

Animation:

```text
current platform
↓
panda reacts
↓
small fall/drop animation
↓
forest transition
↓
panda returns to the allowed reset platform
```

Do not literally move the panda to an arbitrary coordinate.

The destination must be derived from the new state.

Example:

```ts
const resetPosition = getPandaPositionFromState(nextState);
```

---

# 37. Stage Art Direction

## Stage 1 — Forest Entrance

Mood:

```text
fresh start
dark green forest
small plants
soft fireflies
baby panda
```

## Stage 2 — Mossy Trail

Mood:

```text
denser foliage
larger moss-covered stones
slightly more vertical path
```

## Stage 3 — Moonlit Grove

Mood:

```text
blue-green night tint
larger trees
moonlight
more glowing particles
```

## Stage 4 — Ancient Forest

Mood:

```text
giant tree silhouettes
ancient ruins
thicker roots
harder-looking path
```

## Stage 5 — Golden Canopy

Mood:

```text
golden leaves
more coins
warm lighting
higher platforms
```

## Stage 6 — Summit Sanctuary

Mood:

```text
bright clearing
large summit flag
golden glow
celebration atmosphere
```

Do not radically change the usability/layout between stages.

Only the visual theme should evolve.

---

# 38. End of Day 75

After completing all tasks on Day 75:

```text
challengeStatus = completed
```

Show a final celebration:

```text
75 DAYS COMPLETE!

🐼 🏆

You conquered the forest.

75 / 75 DAYS
ALL TASKS COMPLETED
```

Display:

- final statistics
- total tasks
- completion percentage
- coins
- best streak
- lives remaining
- stage completion

Provide:

```text
VIEW STATS
START ANOTHER CHALLENGE
```

Do not automatically reset after completion.

---

# 39. Design Constraints

Avoid:

- excessive glassmorphism
- generic gradients
- giant modern cards covering the forest
- excessive white space
- duplicated pandas
- floating UI that hides platforms
- random platform placement
- unreadable pixel fonts for body text
- inaccessible tiny buttons
- progress values that contradict the task list
- animations that change data

Use pixel-style typography primarily for headings/numbers.

Use a highly readable font for task names and supporting text if necessary.

---

# 40. Implementation Priority

When tradeoffs are necessary, prioritize in this order:

```text
1. Data correctness
2. Task completion correctness
3. Life/reset correctness
4. Persistence
5. Responsive gameplay
6. Panda movement
7. Progress visualization
8. Accessibility
9. Visual polish
10. Extra effects
```

Never sacrifice state correctness for animation.

---

# 41. Definition of Done

The implementation is complete only when all of the following are true:

- [ ] User can create a 75-day challenge.
- [ ] User can select/configure tasks.
- [ ] Daily tasks render correctly.
- [ ] Number of path steps matches task count.
- [ ] Exactly one active panda exists.
- [ ] Panda starts at the starting platform.
- [ ] Panda initially runs.
- [ ] Panda hops between platforms after task completion.
- [ ] Each completed task advances exactly one step.
- [ ] Coins correspond to tasks.
- [ ] Coin rewards are idempotent.
- [ ] Progress bar is inside the Day card below the day/task content.
- [ ] Progress is calculated correctly.
- [ ] Partial progress is preserved.
- [ ] Zero progress displays 0%.
- [ ] Refresh preserves committed progress.
- [ ] Lives start at 3.
- [ ] Failed days reduce lives exactly once.
- [ ] Duplicate failure cannot remove multiple lives.
- [ ] Losing all lives resets the challenge.
- [ ] Reset returns the panda to Stage 1 / Day 1.
- [ ] Reset returns progress to 0.
- [ ] Reset restores 3 lives.
- [ ] User task templates are not accidentally deleted on challenge reset.
- [ ] Stage transitions are deterministic.
- [ ] Day 75 can be completed.
- [ ] Completion does not accidentally reset.
- [ ] Corrupted state does not fabricate progress.
- [ ] Reduced motion works.
- [ ] Keyboard accessibility works.
- [ ] Mobile layout works.
- [ ] Desktop layout works.
- [ ] Automated state tests pass.
- [ ] No console errors during normal gameplay.
- [ ] No duplicate React keys.
- [ ] No state mutation bugs.
- [ ] No random layout changes after re-render.

---

# 42. Claude Code Execution Instructions

Before changing code:

1. Inspect the existing repository.
2. Identify the framework/build system.
3. Identify existing routing/state/storage.
4. Identify whether a design system already exists.
5. Reuse the existing architecture where practical.
6. Do not replace working infrastructure without a reason.
7. Locate the supplied visual reference if it is available in the project.
8. Build the state engine before building complex animations.
9. Add tests for the state engine before relying on visual behavior.
10. Implement the gameplay scene after the state engine is reliable.

When making changes:

```text
inspect
→ plan
→ implement state model
→ implement persistence
→ implement task interactions
→ implement progression
→ implement lives/failure/reset
→ implement panda movement
→ implement visual stages
→ implement responsive UI
→ test
→ fix
→ final verification
```

After implementation, manually verify the complete user journey:

```text
new challenge
→ choose tasks
→ start Day 1
→ complete task 1
→ observe panda run/jump
→ complete remaining tasks
→ complete day
→ advance day
→ partially complete a day
→ refresh
→ verify persistence
→ fail a day
→ verify one life is lost
→ repeat failure condition
→ verify no double deduction
→ intentionally lose all lives
→ verify reset to Day 1
→ verify progress = 0
→ verify panda is back at Stage 1
→ complete through Day 75 using test/dev shortcuts if available
→ verify final completion screen
```

Do not mark the feature complete until these scenarios work.

---

# 43. Final Product Principle

The game loop is:

```text
REAL-LIFE TASK
      ↓
USER COMPLETES TASK
      ↓
TASK STATE PERSISTS
      ↓
PANDA RUNS
      ↓
PANDA HOPS TO NEXT STONE
      ↓
COIN IS COLLECTED
      ↓
PROGRESS INCREASES
      ↓
USER GETS CLOSER TO DAY GOAL
      ↓
DAY COMPLETES
      ↓
FOREST JOURNEY CONTINUES
```

Failure loop:

```text
TASKS REMAIN INCOMPLETE
      ↓
DAY REACHES FAILURE CONDITION
      ↓
DAY MARKED FAILED
      ↓
ONE LIFE LOST
      ↓
PANDA FALLS BACK
      ↓
IF LIVES > 0
      → CONTINUE
      ↓
IF LIVES = 0
      ↓
75-DAY RUN RESETS
      ↓
DAY 1
      ↓
STAGE 1
      ↓
0% PROGRESS
      ↓
3 LIVES
      ↓
BABY PANDA AT START
```

The central philosophy is:

> **The panda is a visual representation of real progress, never the source of truth for progress.**

Build the application so that the user can trust every task, every jump, every coin, every heart, every day, and every reset.
