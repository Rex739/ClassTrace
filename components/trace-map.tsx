import Link from "next/link";
import { ArrowRight, CheckCircle2, GitFork, MessageSquareText } from "lucide-react";
import { clusters } from "@/lib/demo-data";
import type { ClassAnalysis } from "@/lib/ai/schemas";

export function TraceMap({ compact = false, analysis, basePath = "/analyses/demo/clusters" }: { compact?: boolean; analysis?: ClassAnalysis; basePath?: string }) {
  const nodes = analysis?.clusters.map((cluster) => ({
    id: cluster.id,
    shortName: cluster.title,
    responseIds: cluster.responseIds,
    severity: cluster.confidence < 0.8 ? "uncertain" : "monitor",
    detail: `${Math.round(cluster.confidence * 100)}% confidence`,
  })) ?? clusters.map((cluster) => ({ id: cluster.id, shortName: cluster.shortName, responseIds: cluster.responseIds, severity: cluster.severity, detail: cluster.commonFinalAnswers[0] }));
  const responseCount = analysis?.classSummary.totalResponses ?? 12;
  const secureCount = analysis?.demonstratedUnderstandingResponseIds.length ?? 3;
  const attentionCount = analysis?.teacherAttentionResponseIds.length ?? 0;
  return (
    <div className={`trace-map ${compact ? "trace-map-compact" : ""}`}>
      <div className="trace-map-header">
        <div><span className="eyebrow"><GitFork size={15} /> Reasoning topology</span><h2>{compact ? "One answer. Different thinking." : "Trace Map"}</h2></div>
        <p>{compact ? "ClassTrace follows the path, not just the final answer." : "Final answers can match while the underlying reasoning diverges."}</p>
      </div>
      <div className="trace-canvas">
        <div className="trace-origin">
          <span className="trace-origin-icon"><MessageSquareText size={18} /></span>
          <strong>{responseCount} responses</strong><small>one shared prompt</small>
        </div>
        <div className="trace-branches" aria-label="Reasoning clusters">
          {nodes.map((cluster) => (
            <Link key={cluster.id} href={`${basePath}/${cluster.id}`} className={`trace-node trace-${cluster.severity}`}>
              <span className="node-count">{cluster.responseIds.length}</span>
              <span><strong>{cluster.shortName}</strong><small>{cluster.detail}</small></span>
              <ArrowRight size={15} />
            </Link>
          ))}
          {attentionCount > 0 && <Link href="/analyses/live" className="trace-node trace-attention"><span className="node-count">{attentionCount}</span><span><strong>Teacher review required</strong><small>insufficient or uncertain evidence</small></span><ArrowRight size={15} /></Link>}
          <Link href={analysis ? "/analyses/live/outcomes" : "/analyses/demo/outcomes"} className="trace-node trace-secure">
            <span className="node-count"><CheckCircle2 size={18} /></span><span><strong>Demonstrated understanding</strong><small>{secureCount} learners</small></span><ArrowRight size={15} />
          </Link>
        </div>
        {!compact && !analysis && (
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
