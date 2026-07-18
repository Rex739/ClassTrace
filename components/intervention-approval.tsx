"use client";

import { useState } from "react";
import { Check, Copy, ExternalLink } from "lucide-react";
import { Button, ButtonLink } from "@/components/ui/button";

export function InterventionApproval() {
  const [approved, setApproved] = useState(false);
  const [copied, setCopied] = useState(false);
  return (
    <aside className="approval-panel">
      <span className="eyebrow">Teacher approval</span><h2>{approved ? "Activity approved" : "Review before sharing"}</h2><p>{approved ? "The student activity is ready to preview and share." : "Check the prompts, model and transfer question against your classroom goals."}</p>
      <div className="approval-checks"><span><Check size={15} /> Grounded in response evidence</span><span><Check size={15} /> Targets the shared reasoning break</span><span><Check size={15} /> Includes a transfer check</span></div>
      {!approved ? <Button type="button" onClick={() => setApproved(true)}><Check size={16} /> Approve activity</Button> : <><ButtonLink href="/learn/demo">Open student view <ExternalLink size={16} /></ButtonLink><Button type="button" variant="secondary" onClick={() => { navigator.clipboard?.writeText(`${location.origin}/learn/demo`); setCopied(true); }}><Copy size={16} /> {copied ? "Link copied" : "Copy demo link"}</Button></>}
    </aside>
  );
}
