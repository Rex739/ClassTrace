import { Logo } from "@/components/logo";
import { LiveStudentActivity } from "@/components/live-student-activity";

export const metadata = { title: "Live learning activity" };
export default function LiveLearnPage() { return <div className="learn-shell"><nav aria-label="Activity"><Logo /><span>Live transfer activity · no score</span></nav><LiveStudentActivity /></div>; }
