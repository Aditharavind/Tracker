export default function ZombiePlant({ left, bottom }: { left: number; bottom: number }) {
  return (
    <div className="zombie-plant" style={{ left: `${left}%`, bottom: `${bottom}%` }} aria-hidden="true">
      <div className="plant-stem" />
      <div className="plant-leaf plant-leaf-l" />
      <div className="plant-leaf plant-leaf-r" />
      <div className="plant-head">
        <div className="plant-lip plant-lip-top" />
        <div className="plant-lip plant-lip-bottom" />
        <div className="plant-mouth" />
        <div className="plant-spots" />
      </div>
    </div>
  );
}
