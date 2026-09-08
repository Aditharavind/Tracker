import { CHARACTER_SPRITE, type CharacterId } from "./characters";
import { CRUMBLE_DELAY, HERO_H, HERO_W, STORY_H, STORY_W, storyCoins, trapPhase, type StoryLevel, type StoryState } from "./storyEngine";

export function loadStoryArt(character: CharacterId) {
  const hero = new Image(); hero.src = CHARACTER_SPRITE[character];
  const forest = new Image(); forest.src = "/assets/forest-bg-1.webp";
  return { hero, forest };
}
export function drawStory(ctx: CanvasRenderingContext2D, s: StoryState, level: StoryLevel, art: ReturnType<typeof loadStoryArt>, reducedMotion: boolean, viewWidth = STORY_W) {
  const camera = Math.max(0, Math.min(level.length - viewWidth, s.x - viewWidth * 0.3));
  ctx.clearRect(0, 0, viewWidth, STORY_H);
  const sky = ctx.createLinearGradient(0, 0, 0, STORY_H);
  sky.addColorStop(0, "#080e1b"); sky.addColorStop(1, "#1c352b");
  ctx.fillStyle = sky; ctx.fillRect(0, 0, viewWidth, STORY_H);
  if (art.forest.complete && art.forest.naturalWidth) {
    ctx.globalAlpha = 0.4;
    const w = STORY_H * art.forest.naturalWidth / art.forest.naturalHeight;
    for (let x = -(camera * 0.2) % w; x < viewWidth; x += w) ctx.drawImage(art.forest, x, 0, w, STORY_H);
    ctx.globalAlpha = 1;
  }
  ctx.fillStyle = level.color; ctx.globalAlpha = 0.14;
  ctx.beginPath(); ctx.arc(viewWidth * 0.8, 80, 48, 0, Math.PI * 2); ctx.fill(); ctx.globalAlpha = 1;
  for (let i = 0; i < 20; i++) {
    ctx.fillStyle = i % 2 ? "#ffe8a2" : level.color;
    const bob = reducedMotion ? 0 : Math.sin(s.t + i) * 7;
    ctx.fillRect((i * 137 + 30 - camera * 0.08 + viewWidth) % viewWidth, 40 + (i * 53) % 230 + bob, 2, 2);
  }
  ctx.save(); ctx.translate(-camera, 0);
  level.platforms.forEach((p, i) => {
    const age = s.crumbling[i] === undefined ? 0 : s.t - s.crumbling[i];
    if (age > CRUMBLE_DELAY) return;
    const shake = age && !reducedMotion ? Math.sin(s.t * 70) * 2 : 0;
    ctx.fillStyle = p.crumble ? "#756047" : "#3d493d";
    ctx.fillRect(p.x + shake, p.y, p.w, 35);
    ctx.fillStyle = age ? "#e5ac66" : level.color; ctx.fillRect(p.x + shake, p.y, p.w, 7);
    ctx.fillStyle = "#222c29";
    for (let x = p.x + 15; x < p.x + p.w; x += 42) ctx.fillRect(x, p.y + 19, 20, 3);
    if (p.crumble) {
      ctx.strokeStyle = "#30261f"; ctx.lineWidth = 3; ctx.beginPath();
      ctx.moveTo(p.x + p.w * 0.4, p.y + 6); ctx.lineTo(p.x + p.w * 0.5, p.y + 17); ctx.lineTo(p.x + p.w * 0.43, p.y + 34); ctx.stroke();
    }
  });
  const lantern = (x: number, y: number, color: string, label: string) => {
    ctx.fillStyle = "#b9b0a0"; ctx.fillRect(x, y - 76, 4, 76);
    ctx.fillStyle = color; ctx.fillRect(x - 10, y - 80, 24, 25);
    ctx.fillStyle = "#fff6cc"; ctx.fillRect(x - 4, y - 74, 12, 13);
    ctx.font = "12px monospace"; ctx.fillStyle = color; ctx.fillText(label, x - 35, y - 94);
  };
  const cpFloor = level.platforms.find(p => level.checkpoint >= p.x && level.checkpoint < p.x + p.w)?.y ?? 350;
  lantern(level.checkpoint + 20, cpFloor, s.checkpoint ? "#a5f2ec" : "#69bce3", s.checkpoint ? "SAVED" : "CHECKPOINT");
  lantern(level.length - 95, 350, s.shard ? "#ffe39a" : "#88918f", s.shard ? "BEACON" : "NEEDS ★");
  for (const trap of level.traps) {
    const floor = level.platforms.find(p => trap.x >= p.x && trap.x < p.x + p.w)?.y ?? 350;
    const phase = trapPhase(trap, s.t);
    ctx.fillStyle = phase === "warning" ? "#ffd578" : phase === "active" ? "#e98993" : "#81bda1";
    ctx.fillRect(trap.x, floor - 4, trap.w, 4);
    if (phase === "active") {
      for (let x = trap.x; x < trap.x + trap.w; x += 13) {
        ctx.beginPath(); ctx.moveTo(x, floor); ctx.lineTo(x + 6, floor - 26); ctx.lineTo(x + 13, floor); ctx.fill();
      }
    } else if (phase === "warning") {
      ctx.font = "bold 20px monospace"; ctx.fillText("!", trap.x + trap.w / 2 - 5, floor - 13);
    }
  }
  storyCoins(level).forEach((coin, i) => {
    if (s.coins.includes(i)) return;
    ctx.fillStyle = "#edc66b"; ctx.beginPath(); ctx.arc(coin.x, coin.y, 8, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = "#8b6429"; ctx.fillRect(coin.x - 1, coin.y - 4, 2, 8);
  });
  if (!s.shard) {
    const { x, y } = level.shard;
    ctx.save(); ctx.translate(x, y + (reducedMotion ? 0 : Math.sin(s.t * 2) * 4));
    ctx.fillStyle = "#fff0a0"; ctx.shadowColor = "#ffe186"; ctx.shadowBlur = 18;
    ctx.beginPath();
    for (let i = 0; i < 10; i++) {
      const a = -Math.PI / 2 + i * Math.PI / 5; const r = i % 2 ? 8 : 18;
      if (!i) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r); else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    ctx.closePath(); ctx.fill(); ctx.restore();
  }
  ctx.save(); ctx.translate(s.x + HERO_W / 2, s.y + HERO_H / 2); ctx.scale(s.facing, 1);
  ctx.imageSmoothingEnabled = false;
  if (art.hero.complete && art.hero.naturalWidth) ctx.drawImage(art.hero, -25, -29, 50, 56);
  else { ctx.fillStyle = "#f3eddf"; ctx.fillRect(-HERO_W / 2, -HERO_H / 2, HERO_W, HERO_H); }
  ctx.restore();
  ctx.fillStyle = "#a1eee2"; ctx.beginPath(); ctx.arc(s.x - s.facing * 14, s.y - 14 + (reducedMotion ? 0 : Math.sin(s.t * 3) * 4), 5, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}
