import { ButtonLink } from "@/components/ui/button";

export default function NotFound() {
  return <main className="error-state"><span>404 · Untraced path</span><h1>This page isn’t part of the class map.</h1><p>Return to the prepared analysis to keep exploring.</p><ButtonLink href="/analyses/demo">Back to demo analysis</ButtonLink></main>;
}
