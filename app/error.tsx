"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";

export default function ErrorPage({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => { console.error(error); }, [error]);
  return <main className="error-state"><span>We lost this reasoning path.</span><h1>The page could not be shown.</h1><p>Your demo data is safe. Try loading this view again.</p><Button type="button" onClick={reset}>Try again</Button></main>;
}
