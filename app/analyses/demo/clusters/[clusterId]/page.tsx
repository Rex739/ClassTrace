import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Users } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { ClusterWorkbench } from "@/components/cluster-workbench";
import { AssessmentQuestionCard } from "@/components/question-card";
import { Badge } from "@/components/ui/badge";
import { assessment, clusters } from "@/lib/demo-data";

export function generateStaticParams() { return clusters.map((cluster) => ({ clusterId: cluster.id })); }

export default async function ClusterPage({ params }: { params: Promise<{ clusterId: string }> }) {
  const { clusterId } = await params;
  const cluster = clusters.find((item) => item.id === clusterId);
  if (!cluster) notFound();
  return <AppShell active="analysis"><div className="page-width page-stack"><Link href="/analyses/demo" className="back-link"><ArrowLeft size={16} /> Back to Trace Map</Link><header className="cluster-header"><div><div className="cluster-header-meta"><Badge tone={cluster.severity === "attention" ? "red" : cluster.severity === "uncertain" ? "amber" : "blue"}>{cluster.severity}</Badge><span><Users size={15} /> {cluster.responseIds.length} learners</span></div><h1>{cluster.name}</h1><p>{cluster.description}</p></div><div className="learning-need-card"><span>Shared learning need</span><p>{cluster.learningNeed}</p></div></header><AssessmentQuestionCard assessment={assessment} compact /><ClusterWorkbench cluster={cluster} /></div></AppShell>;
}
