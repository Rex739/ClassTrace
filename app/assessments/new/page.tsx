import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { NewAssessmentForm } from "@/components/new-assessment-form";

export const metadata = { title: "Create an assessment" };

export default function NewAssessmentPage() {
  return <AppShell active="new"><div className="page-width page-stack"><Link href="/" className="back-link"><ArrowLeft size={16} /> Back to overview</Link><header className="page-title"><span className="eyebrow">New analysis</span><h1>What did your class make of it?</h1><p>Set up one question and bring together the responses you want to understand.</p></header><NewAssessmentForm /></div></AppShell>;
}
