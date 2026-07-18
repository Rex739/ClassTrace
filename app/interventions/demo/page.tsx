import Link from "next/link";
import { ArrowLeft, ArrowRight, Eye, MessageCircleQuestion, PencilLine, Repeat2 } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { CircleExplorer } from "@/components/circle-explorer";
import { InterventionApproval } from "@/components/intervention-approval";
import { Badge } from "@/components/ui/badge";
import { intervention } from "@/lib/demo-data";

export const metadata = { title: "Intervention preview" };
const activitySteps = [{ label: "Predict", copy: intervention.predictionPrompt, icon: MessageCircleQuestion }, { label: "Explore", copy: "Move the radius and compare the area scale factor in real time.", icon: Eye }, { label: "Explain", copy: intervention.explanationPrompt, icon: PencilLine }, { label: "Reflect", copy: intervention.reflectionPrompt, icon: Repeat2 }];

export default function InterventionPage() {
  return <AppShell active="analysis"><div className="page-width page-stack"><Link href="/analyses/demo" className="back-link"><ArrowLeft size={16} /> Back to analysis</Link><header className="intervention-header"><div><div className="cluster-header-meta"><Badge tone="blue">Draft activity</Badge><span>8–10 minutes</span></div><h1>{intervention.title}</h1><p>{intervention.objective}</p></div><div className="intervention-target"><span>Targets</span><strong>7 learners</strong><small>3 connected reasoning needs</small></div></header><div className="intervention-layout"><main><section className="activity-sequence"><div className="section-heading-row"><div><span className="eyebrow">Activity sequence</span><h2>Make the relationship visible</h2></div><span className="annotation">prediction before explanation</span></div><ol>{activitySteps.map(({ label, copy, icon: Icon }, index) => <li key={label}><span className="sequence-number">{index + 1}</span><span className="sequence-icon"><Icon size={18} /></span><div><h3>{label}</h3><p>{copy}</p></div></li>)}</ol></section><CircleExplorer /><section className="transfer-card"><span className="eyebrow"><ArrowRight size={15} /> Transfer check</span><h2>{intervention.transferQuestion}</h2><p>A new scale factor reveals whether the learner can transfer the square relationship, not just repeat the example.</p></section></main><InterventionApproval /></div></div></AppShell>;
}
