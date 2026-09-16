# Level Trail Artwork

- Tool: built-in `image_gen` (not the API/CLI fallback).
- Reference: `public/assets/weekmap-bg.png`, for style and materials.
- Deployed asset: `public/assets/story/level-trail-v1.webp`.
- Original dimensions: 1024x1536; encoded with FFmpeg/libwebp at quality 90.
- Original PNG: `/home/adith/.codex/generated_images/01a0a6da-2a64-7451-84ff-dc5702f330c9/exec-01470bbb-eadd-458b-96aa-5db7e2a6b949.png`.
- The final image contains 15 stones. `src/game/adventure/trail.ts` anchors
  portals to the actual generated surfaces, not the requested approximate layout.

## Final Prompt

Use case: stylized-concept. Asset type: portrait bitmap background for a
scrollable pixel-art game level selection trail. The supplied image is a STYLE
AND MATERIAL reference: match its lush emerald woodland, moss-covered round
gray stone pedestals, sunlit earthen footpath, crisp detailed pixel-art, canopy,
roots, ferns, little flowers and mushrooms. Create a new taller portrait map at
1024x1536. Very important: EXACTLY FIFTEEN large flat round mossy stone platforms,
no other large stones, no portals, no characters, no text, no numbers, no UI,
no borders. Each platform is a clear flat oval gray disk supported by a short
thick rocky side, visibly rooted in the ground, roughly 16 percent of image
width. All fifteen are similar size, do not shrink with perspective. Layout is
a single zigzag trail ascending from bottom to top, with one platform at each
of fifteen staggered heights. Read this as exact platform centers as percentages
of image width and height, listed bottom to top: (35,93), (64,87), (37,81),
(65,75), (35,69), (64,63), (37,57), (65,51), (35,45), (64,39), (37,33),
(65,27), (35,21), (64,15), (50,8). Follow these center coordinates closely
and draw all 15 distinct platforms. Trail meanders through all the platforms,
trees and foliage frame the left and right edges. Uniform elevated isometric
view throughout, not a far-away perspective horizon. Leave each stone's surface
unobstructed and space just above it clear for a portal to be added by the game
UI. Warm gold light and clear green foliage, not dark or blurred. The top
fifteenth pedestal can be slightly larger as the boss destination, but no boss
artwork. Do not merge platforms or add small stone platforms that could be
mistaken for a level.
