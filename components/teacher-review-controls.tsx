"use client";

import { useState } from "react";
import { Check, MoveRight, Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { clusters } from "@/lib/demo-data";

export function TeacherReviewControls({ currentClusterName, studentLabel }: { currentClusterName: string; studentLabel: string }) {
  const [approved, setApproved] = useState(false);
  const [name, setName] = useState(currentClusterName);
  const [editing, setEditing] = useState(false);
  const [moving, setMoving] = useState(false);

  return (
    <section className="review-controls" aria-labelledby="review-title">
      <div><span className="eyebrow">Teacher decision</span><h2 id="review-title">Review this interpretation</h2><p>Your judgement remains the final word for {studentLabel}.</p></div>
      {approved && <div className="approved-notice" role="status"><Check size={17} /> Interpretation approved for this demo session.</div>}
      {editing && <label className="field">Cluster name<input value={name} onChange={(event) => setName(event.target.value)} /><Button type="button" variant="secondary" onClick={() => setEditing(false)}>Save name</Button></label>}
      {moving && <label className="field">Move response to<select defaultValue=""><option value="" disabled>Choose a cluster</option>{clusters.map((cluster) => <option key={cluster.id} value={cluster.id}>{cluster.name}</option>)}<option value="secure">Secure understanding</option></select><Button type="button" variant="secondary" onClick={() => { setMoving(false); setApproved(false); }}>Confirm move</Button></label>}
      <div className="review-buttons"><Button type="button" onClick={() => setApproved(true)}><Check size={16} /> Approve</Button><Button type="button" variant="secondary" onClick={() => setEditing((value) => !value)}><Pencil size={16} /> Rename</Button><Button type="button" variant="secondary" onClick={() => setMoving((value) => !value)}><MoveRight size={16} /> Move response</Button></div>
    </section>
  );
}
