/**
 * The guardian plant at the start of the level (skill §11) -- one only, never
 * scattered. Art is cropped straight from the reference environment. It bobs,
 * and a pixel speech bubble taunts the player on a loop.
 */
export default function ZombiePlant({ left, bottom }: { left: number; bottom: number }) {
  return (
    <div className="zombie-plant" style={{ left: `${left}%`, bottom: `${bottom}%` }} aria-hidden="true">
      <div className="plant-bubble">
        <span className="plant-bubble-text pixel-font">DON'T START — I'LL EAT U</span>
      </div>
      <img className="plant-sprite" src="/assets/zombie-plant.webp" alt="" />
    </div>
  );
}
