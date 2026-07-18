import { Logo } from "@/components/logo";
import { StudentActivity } from "@/components/student-activity";

export const metadata = { title: "Circle area lab" };
export default function LearnPage() { return <div className="learn-shell"><nav aria-label="Activity"><Logo /><span>Focused activity · no score</span></nav><StudentActivity /></div>; }
