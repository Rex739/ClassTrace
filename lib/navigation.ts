export type NavigationGroup = "home" | "assessment" | "demo" | "live";

function isWithin(pathname: string, root: string): boolean {
  return pathname === root || pathname.startsWith(`${root}/`);
}

export function navigationGroupForPath(pathname: string): NavigationGroup | null {
  if (pathname === "/") return "home";
  if (isWithin(pathname, "/assessments")) return "assessment";
  if (
    isWithin(pathname, "/analyses/demo")
    || isWithin(pathname, "/interventions/demo")
    || isWithin(pathname, "/learn/demo")
  ) return "demo";
  if (
    isWithin(pathname, "/analyses/live")
    || isWithin(pathname, "/interventions/live")
    || isWithin(pathname, "/learn/live")
  ) return "live";
  return null;
}
