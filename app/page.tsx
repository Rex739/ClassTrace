import { ArrowRight, BrainCircuit, CheckCircle2, GitBranch, MousePointer2, ScanSearch, Sparkles } from "lucide-react";
import { AppShell } from "@/components/app-shell";
import { TraceMap } from "@/components/trace-map";
import { ButtonLink } from "@/components/ui/button";

const workflow = [
  { number: "01", title: "Collect reasoning", copy: "Bring together responses to one carefully chosen question.", icon: ScanSearch },
  { number: "02", title: "Trace thinking", copy: "Reconstruct the steps behind each answer and surface the precise break.", icon: GitBranch },
  { number: "03", title: "Respond with purpose", copy: "Group by learning need, intervene, then verify the change.", icon: CheckCircle2 },
];

export default function Home() {
  return (
    <AppShell active="home">
      <section className="hero page-width">
        <div className="hero-copy">
          <div className="hero-kicker"><Sparkles size={15} /> Built for the moments after students answer</div>
          <h1>See how your class is <em>thinking.</em></h1>
          <p>ClassTrace reveals the reasoning behind student answers, groups shared misconceptions, and helps you choose the next move that matters.</p>
          <div className="hero-actions"><ButtonLink href="/analyses/demo">Analyse a sample class <ArrowRight size={17} /></ButtonLink><ButtonLink href="/assessments/new" variant="secondary">Create an assessment</ButtonLink></div>
          <div className="hero-proof"><span><CheckCircle2 size={15} /> Reasoning, not answer matching</span><span><CheckCircle2 size={15} /> Teacher judgement stays central</span></div>
        </div>
        <div className="hero-note"><MousePointer2 size={16} /><span>Follow a response from answer<br />to reasoning to action.</span></div>
      </section>
      <section className="preview-wrap page-width" aria-label="Trace Map preview"><TraceMap compact /></section>
      <section className="why-section page-width">
        <div className="section-heading"><span className="eyebrow"><BrainCircuit size={15} /> From answer data to learning insight</span><h2>A wrong answer tells you where a learner landed. The path tells you what to do next.</h2></div>
        <div className="workflow-grid">{workflow.map(({ number, title, copy, icon: Icon }) => <article key={number}><div><span>{number}</span><Icon size={20} /></div><h3>{title}</h3><p>{copy}</p></article>)}</div>
      </section>
      <section className="landing-cta"><div><span className="eyebrow">A prepared class is waiting</span><h2>Trace twelve different ways of thinking.</h2><p>Explore a complete, deterministic demonstration using synthetic student responses.</p></div><ButtonLink href="/analyses/demo">Open the class trace <ArrowRight size={17} /></ButtonLink></section>
    </AppShell>
  );
}
