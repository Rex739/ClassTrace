import Link from "next/link";
import { BarChart3, FilePlus2, Home, Menu } from "lucide-react";
import type { ReactNode } from "react";
import { Logo } from "@/components/logo";

export function AppShell({ children, active = "analysis" }: { children: ReactNode; active?: "home" | "new" | "analysis" }) {
  return (
    <div className="app-frame">
      <header className="app-header">
        <Link href="/" aria-label="ClassTrace home"><Logo /></Link>
        <nav aria-label="Primary navigation" className="desktop-nav">
          <Link className={active === "home" ? "active" : ""} href="/"><Home size={16} /> Home</Link>
          <Link className={active === "new" ? "active" : ""} href="/assessments/new"><FilePlus2 size={16} /> New assessment</Link>
          <Link className={active === "analysis" ? "active" : ""} href="/analyses/demo"><BarChart3 size={16} /> Demo analysis</Link>
        </nav>
        <details className="mobile-menu">
          <summary aria-label="Open navigation"><Menu size={20} /></summary>
          <nav aria-label="Mobile navigation">
            <Link href="/">Home</Link>
            <Link href="/assessments/new">New assessment</Link>
            <Link href="/analyses/demo">Demo analysis</Link>
          </nav>
        </details>
      </header>
      <main>{children}</main>
      <footer className="app-footer"><Logo compact /><span>See how your class is thinking.</span><span>Phase 1 · deterministic demo</span></footer>
    </div>
  );
}
