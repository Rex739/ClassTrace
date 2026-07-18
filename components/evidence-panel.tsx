import { Quote } from "lucide-react";

export function EvidencePanel({ evidence, alternative }: { evidence: string[]; alternative: string }) {
  return (
    <div className="evidence-grid">
      <section className="evidence-panel" aria-labelledby="evidence-title">
        <h3 id="evidence-title"><Quote size={16} /> Evidence in the response</h3>
        <ul>{evidence.map((item) => <li key={item}>{item}</li>)}</ul>
      </section>
      <section className="alternative-panel" aria-labelledby="alternative-title">
        <h3 id="alternative-title">Alternative hypothesis</h3>
        <p>{alternative}</p>
      </section>
    </div>
  );
}
