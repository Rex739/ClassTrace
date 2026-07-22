"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, FilePlus2, History, Home, Menu, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Logo, LogoHomeLink } from "@/components/logo";
import { useAnalysisRun } from "@/lib/use-client-store";
import { navigationGroupForPath, type NavigationGroup } from "@/lib/navigation";

const navigationItems: Array<{ href: string; label: string; group: NavigationGroup; icon: LucideIcon }> = [
  { href: "/", label: "Home", group: "home", icon: Home },
  { href: "/assessments/new", label: "New assessment", group: "assessment", icon: FilePlus2 },
  { href: "/analyses/demo", label: "Demo analysis", group: "demo", icon: BarChart3 },
];

export function AppShell({ children }: { children: ReactNode; active?: "home" | "new" | "analysis" }) {
  const savedRun = useAnalysisRun();
  const activeGroup = navigationGroupForPath(usePathname());
  const items = savedRun?.metadata.mode === "live"
    ? [...navigationItems, { href: "/analyses/live", label: "Resume analysis", group: "live" as const, icon: History }]
    : navigationItems;
  return (
    <div className="app-frame">
      <header className="app-header">
        <LogoHomeLink />
        <nav aria-label="Primary navigation" className="desktop-nav">
          {items.map((item) => <NavigationLink key={item.group} item={item} activeGroup={activeGroup} showIcon />)}
        </nav>
        <details className="mobile-menu">
          <summary aria-label="Open navigation"><Menu size={20} /></summary>
          <nav aria-label="Mobile navigation">
            {items.map((item) => <NavigationLink key={item.group} item={item} activeGroup={activeGroup} />)}
          </nav>
        </details>
      </header>
      <main>{children}</main>
      <footer className="app-footer"><Logo compact /><span>See how your class is thinking.</span><span>Teacher-reviewed reasoning intelligence</span></footer>
    </div>
  );
}

function NavigationLink({ item, activeGroup, showIcon = false }: {
  item: (typeof navigationItems)[number];
  activeGroup: NavigationGroup | null;
  showIcon?: boolean;
}) {
  const isActive = item.group === activeGroup;
  const Icon = item.icon;
  return <Link href={item.href} className={isActive ? "active" : undefined} aria-current={isActive ? "page" : undefined}>{showIcon && <Icon size={16} />}{item.label}</Link>;
}
