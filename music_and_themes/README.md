# Music & Themes — "The Panda's 75-Day Transformation"

All audio is synthesized from code (`tools/make_audio.py`, 16-bit chiptune style, 44.1 kHz stereo). No samples, no licensing issues.
The render reads from `public/audio/`; this folder is an organised copy for browsing/reuse.
Timestamps are video time (mm:ss.s). The cue list that triggers every sound lives in `src/Panda75Hard.tsx`.

## Full score
- `full_score_60s.wav` — the complete 60 s soundtrack. Plays under the whole video (fades in over the first 0.7 s, fades out over the last 2 s).

## Themes — what they are and where they are used
| File | Video time | Scene | What it is | What is on screen while it plays |
|---|---|---|---|---|
| `themes/01_melancholic_old_routine.wav` | 0:00–0:08 | 1. The Old Routine | Slow (~64 bpm), A minor. Sparse sleepy pad with a music-box arpeggio. Lonely, tired, "tomorrow" mood. | Panda in bed on his phone, alarm ignored, dusty dumbbells, phone at the desk, junk food, calendar filling with X marks. Captions "Tomorrow." / "Maybe next week." / "One more day." |
| `themes/02_reflective_realization.wav` | 0:08–0:15 | 2. The Realization | Music almost stops (quiet pad), then a warm rising hopeful motif builds. | Panda on the wooden deck, puts the phone down, sees his reflection in the puddle, light beam breaks through, he stands. Caption "Nothing changes if nothing changes." |
| `themes/03_hopeful_day_one.wav` | 0:15–0:22 | 3. Day One | C major, ~96 bpm. Gentle arpeggios, bass enters, ends on a riser. | Dashboard slides in, DAY 01, 7 tasks appear one by one, wooden START button, press, flash, panda runs into the forest. Caption "DAY 01 — THE JOURNEY BEGINS." |
| `themes/04_energetic_the_grind.wav` | 0:22–0:40 | 4. The Grind | 128 bpm. Driving bass, four-on-the-floor kick, snare, hats, catchy pulse-wave melody; layers added bar by bar, snare-roll bridge at the end. | Workout montage (push-ups, lifting), outdoor run, healthy meal + water, reading under a tree, 5 AM wake-up, dashboard/streak grid filling. Day counter 01→07→15→30→50→75. Captions "Discipline over motivation." etc. |
| `themes/05_struggle_rain_and_resolve.wav` | 0:40–0:48 | 5. The Struggle | Drops to sparse minor bells (rain mood), slowly rises again into a big build. | Heavy rain, desaturated forest, exhausted panda, determined close-up, last task completed. Caption "The hardest days build the strongest habits." |
| `themes/06_triumphant_day_75.wav` | 0:48–0:55 | 6. Day 75 | Full major-key fanfare: big kick and cymbal crash on 0:48.0, bright arpeggios, celebratory lead. | Sunrise summit, 75/75 counter, panda celebrating, completed dashboard, gold badge, fireworks. Caption "75 DAYS. 75 CHANCES TO BECOME BETTER." |
| `themes/07_resolution_final_message.wav` | 0:55–1:00 | 7. The Final Message | Calm, warm sustained major chords with a slow melody; final chord rings and fades to silence. | "ONE DAY, OR DAY ONE. YOU DECIDE.", 75 HARD title card, tagline "75 DAYS. NO EXCUSES. JUST YOU VS. YOU.", panda walks toward the sun, fade to black. |

## Sound effects — what they are and where they are used (`sound_effects/`)
| File | Length | Used for | Plays at (video time) |
|---|---|---|---|
| sfx_night.wav | 9.0 s | Night crickets ambience under the bedroom scene | 0:00 (fades out by ~0:09) |
| sfx_alarm.wav | 2.0 s | Digital alarm clock | 0:00.9 (ignored in bed); 0:34.3 (5 AM wake-up, quieter) |
| sfx_phone.wav | 0.65 s | Phone notification pings | 0:04.5, 0:05.3 (desk scene) |
| sfx_crunch.wav | 0.45 s | Junk-food crunch | 0:06.0, 0:06.5; 0:29.0, 0:29.4 (healthy meal) |
| sfx_page.wav | 0.3 s | Calendar page flips; book pages | 0:06.9, 0:07.4, 0:07.9 (calendar); 0:32.0, 0:33.0 (reading) |
| sfx_footstep.wav | 0.12 s | Soft grass steps | 0:03.1–0:03.7 (tired walk); 0:19.5–0:26.5 (run into forest); 0:25.5–0:28.3 (outdoor run); 0:48.1–0:50.1 (climbing to summit); 0:58.3–0:59.7 (walking into the sunrise) |
| sfx_thud.wav | 0.25 s | Phone landing on deck; push-up impacts | 0:10.1; 0:22.3, 0:22.8, 0:23.3 |
| sfx_drop.wav | 0.45 s | Puddle ripple droplet | 0:10.2, 0:11.5 |
| sfx_breath.wav | 1.6 s | Deep breath (realization; before getting back up in the rain) | 0:11.3; 0:42.3 |
| sfx_heartbeat.wav | 0.85 s | Two thumps during the determined close-up | 0:43.3, 0:44.1 |
| sfx_swoosh.wav | 0.4 s | Light beam / dashboard & UI panels sliding in | 0:11.7; 0:15.2; 0:18.1; 0:36.1; 0:51.3; 0:55.1 |
| sfx_click.wav | 0.15 s | Task rows appearing; wooden START press; summit counter | 0:15.7–0:17.0 (7 rows); 0:19.2 (START pressed); 0:50.3 |
| sfx_start.wav | 1.3 s | Game-start jingle; "level complete" sparkle | 0:19.2 (START); 0:38.6 (Day 75 flash in montage); 0:47.1 (last task in the rain) |
| sfx_whoosh_big.wav | 0.8 s | Cinematic transitions and montage cuts | 0:19.3; 0:25.2, 0:28.2, 0:31.2, 0:34.2, 0:35.9; 0:58.6 (title card) |
| sfx_coin.wav | 0.32 s | Coin pickups | ~0:21–0:26 (running into the forest); 0:26.3, 0:27.3; 0:52.2 (summit) |
| sfx_lift.wav | 0.3 s | Weight-lifting effort | 0:23.9, 0:24.5, 0:25.1 (barbell); 0:45.4, 0:45.8, 0:46.4 (curls in the rain) |
| sfx_gulp.wav | 0.55 s | Drinking water | 0:29.9, 0:30.4 |
| sfx_check.wav | 0.45 s | Task-completion ding | 0:23.1, 0:26.9, 0:29.3, 0:30.4, 0:32.5 (task toasts); 0:36.7–0:38.5 (dashboard checks, 7 in a row); 0:46.0, 0:46.6, 0:47.1 (last tasks in the rain) |
| sfx_rain.wav | 9.0 s | Rain ambience for the struggle scene | 0:40.0 (fades out by ~0:49) |
| sfx_firework.wav | 1.0 s | Pixel fireworks | 0:51.8, 0:52.3, 0:52.7, 0:53.4, 0:53.7, 0:54.2 |
| sfx_fanfare.wav | 2.6 s | Achievement fanfare as the panda reaches the top | 0:51.2 |
