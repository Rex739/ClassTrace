import Link from "next/link";
import { ArrowRight, CheckCircle2, GitFork, MessageSquareText } from "lucide-react";
import { clusters } from "@/lib/demo-data";

export function TraceMap({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`trace-map ${compact ? "trace-map-compact" : ""}`}>
      <div className="trace-map-header">
        <div><span className="eyebrow"><GitFork size={15} /> Reasoning topology</span><h2>{compact ? "One answer. Different thinking." : "Trace Map"}</h2></div>
        <p>{compact ? "ClassTrace follows the path, not just the final answer." : "Final answers can match while the underlying reasoning diverges."}</p>
      </div>
      <div className="trace-canvas">
        <div className="trace-origin">
          <span className="trace-origin-icon"><MessageSquareText size={18} /></span>
          <strong>12 responses</strong><small>one shared prompt</small>
        </div>
        <div className="trace-branches" aria-label="Reasoning clusters">
          {clusters.map((cluster) => (
            <Link key={cluster.id} href={`/analyses/demo/clusters/${cluster.id}`} className={`trace-node trace-${cluster.severity}`}>
              <span className="node-count">{cluster.responseIds.length}</span>
              <span><strong>{cluster.shortName}</strong><small>{cluster.commonFinalAnswers[0]}</small></span>
              <ArrowRight size={15} />
            </Link>
          ))}
          <Link href="/analyses/demo/outcomes" className="trace-node trace-secure">
            <span className="node-count"><CheckCircle2 size={18} /></span><span><strong>Secure model</strong><small>3 learners · 4×</small></span><ArrowRight size={15} />
          </Link>
        </div>
        {!compact && (
          <div className="trace-collision" aria-label="Same answers, different reasoning">
            <span className="annotation">same answer ≠ same reasoning</span>
            <div><b>12π cm²</b><span>formula confusion</span><span>substitution error</span></div>
            <div><b>18π cm²</b><span>linear scaling</span><span>substitution error</span></div>
          </div>
        )}
      </div>
    </div>
  );
}
