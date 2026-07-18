"use client";

import { useId, useState } from "react";
import { MoveHorizontal } from "lucide-react";

export function CircleExplorer({ initialRadius = 3, studentMode = false }: { initialRadius?: number; studentMode?: boolean }) {
  const [radius, setRadius] = useState(initialRadius);
  const id = useId();
  const baseArea = Math.PI * 3 ** 2;
  const area = Math.PI * radius ** 2;
  const scale = area / baseArea;
  const diameter = Math.max(64, radius * 24);

  return (
    <section className={`circle-explorer ${studentMode ? "student-explorer" : ""}`} aria-labelledby={`${id}-title`}>
      <div className="explorer-copy">
        <span className="eyebrow"><MoveHorizontal size={15} /> Interactive model</span>
        <h2 id={`${id}-title`}>Change the radius. Watch the area.</h2>
        <p>Move from the original 3 cm radius and compare both the picture and the numbers.</p>
        <label htmlFor={`${id}-radius`}>Radius <strong>{radius.toFixed(1)} cm</strong></label>
        <input id={`${id}-radius`} type="range" min="1" max="9" step="0.5" value={radius} onChange={(event) => setRadius(Number(event.target.value))} />
        <div className="quick-radii" aria-label="Set radius">
          {[3, 6, 9].map((value) => <button key={value} type="button" aria-pressed={radius === value} onClick={() => setRadius(value)}>{value} cm</button>)}
        </div>
      </div>
      <div className="circle-stage" aria-live="polite">
        <div className="circle-visual" style={{ width: diameter, height: diameter }}>
          <span className="radius-line" /><span className="radius-label">r = {radius.toFixed(1)}</span>
        </div>
        <div className="area-readout">
          <div><span>Area</span><strong>{area.toFixed(1)} cm²</strong><small>π × {radius.toFixed(1)}²</small></div>
          <div><span>Compared with r = 3</span><strong>{scale.toFixed(2)}×</strong><small>area scale factor</small></div>
        </div>
      </div>
    </section>
  );
}
