import Link from "next/link";
import { ArrowUpRight, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import type { MisconceptionCluster } from "@/lib/types";

export function ClusterCard({ cluster }: { cluster: MisconceptionCluster }) {
  const tone = cluster.severity === "attention" ? "red" : cluster.severity === "uncertain" ? "amber" : "blue";
  return (
    <Card className="cluster-card">
      <div className="cluster-card-top"><Badge tone={tone}>{cluster.severity}</Badge><span><Users size={15} /> {cluster.responseIds.length} learners</span></div>
      <h3>{cluster.name}</h3>
      <p>{cluster.description}</p>
      <div className="cluster-need"><span>Learning need</span>{cluster.learningNeed}</div>
      <Link href={`/analyses/demo/clusters/${cluster.id}`}>Inspect reasoning <ArrowUpRight size={16} /></Link>
    </Card>
  );
}
