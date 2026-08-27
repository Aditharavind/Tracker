export default function StartSign({ left, bottom }: { left: number; bottom: number }) {
  return (
    <div className="start-sign" style={{ left: `${left}%`, bottom: `${bottom}%` }} aria-hidden="true">
      <img className="start-sign-sprite" src="/assets/start-sign.webp" alt="" />
    </div>
  );
}
