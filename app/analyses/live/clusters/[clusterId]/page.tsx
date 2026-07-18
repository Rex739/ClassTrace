import { LiveClusterWorkbench } from "@/components/live-cluster-workbench";

export default async function LiveClusterPage({ params }: { params: Promise<{ clusterId: string }> }) {
  const { clusterId } = await params;
  return <LiveClusterWorkbench clusterId={clusterId} />;
}
