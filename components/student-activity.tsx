"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, CheckCircle2 } from "lucide-react";
import { CircleExplorer } from "@/components/circle-explorer";
import { Button } from "@/components/ui/button";

const stages = ["Predict", "Explore", "Explain", "Transfer"];

export function StudentActivity() {
  const [stage, setStage] = useState(0);
  const [prediction, setPrediction] = useState("");
  const [explanation, setExplanation] = useState("");
  const [transfer, setTransfer] = useState("");
  const complete = stage === 4;
  const canContinue = stage === 0 ? prediction.length > 0 : stage === 2 ? explanation.trim().length >= 10 : stage === 3 ? transfer.trim().length >= 2 : true;

  if (complete) return <div className="completion-state"><span><CheckCircle2 size={42} /></span><p className="eyebrow">Activity complete</p><h1>You traced the square relationship.</h1><p>When the radius changes by a factor, the area changes by the square of that factor.</p><div className="completion-evidence"><span>Your transfer answer</span><strong>{transfer}</strong><small>Saved in this demo session</small></div><Link href="/analyses/demo/outcomes" className="button button-primary">View class outcomes <ArrowRight size={17} /></Link></div>;

  return (
    <div className="student-activity">
      <header><span>Circle area lab</span><ol>{stages.map((label, index) => <li key={label} className={index === stage ? "current" : index < stage ? "done" : ""}><span>{index + 1}</span>{label}</li>)}</ol></header>
      <main>
        {stage === 0 && <section className="activity-prompt"><span className="eyebrow">Start with your thinking</span><h1>If the radius doubles, what do you predict happens to area?</h1><div className="prediction-options">{["It doubles", "It triples", "It quadruples", "I’m not sure yet"].map((option) => <button type="button" key={option} className={prediction === option ? "selected" : ""} onClick={() => setPrediction(option)}>{option}</button>)}</div><p>Your first answer is a prediction, not a grade.</p></section>}
        {stage === 1 && <CircleExplorer studentMode />}
        {stage === 2 && <section className="activity-prompt"><span className="eyebrow">Explain what you noticed</span><h1>Why does the area change by that factor?</h1><p>Connect the picture to A = πr². You can use words, numbers, or both.</p><label className="field"><span className="sr-only">Your explanation</span><textarea rows={7} value={explanation} onChange={(event) => setExplanation(event.target.value)} placeholder="When the radius changes from 3 to 6…" /></label></section>}
        {stage === 3 && <section className="activity-prompt"><span className="eyebrow">Try a new case</span><h1>A circle’s radius changes from 5 cm to 15 cm. By what factor does its area change?</h1><p>Explain enough that someone else could follow your reasoning.</p><label className="field"><span className="sr-only">Transfer answer</span><textarea rows={7} value={transfer} onChange={(event) => setTransfer(event.target.value)} placeholder="The radius changes by a factor of…" /></label></section>}
      </main>
      <footer><button type="button" className="button button-ghost" disabled={stage === 0} onClick={() => setStage((value) => Math.max(0, value - 1))}>Back</button><Button type="button" disabled={!canContinue} onClick={() => setStage((value) => value + 1)}>{stage === 3 ? "Complete activity" : "Continue"} <ArrowRight size={17} /></Button></footer>
    </div>
  );
}
