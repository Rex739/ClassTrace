import { Suspense } from "react";
import { LiveInterventionStudio } from "@/components/live-intervention-studio";

export const metadata = { title: "Live intervention" };
export default function LiveInterventionPage() { return <Suspense fallback={<div className="route-loading"><span /><p>Opening intervention studio…</p></div>}><LiveInterventionStudio /></Suspense>; }
