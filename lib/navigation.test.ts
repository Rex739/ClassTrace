import { describe, expect, it } from "vitest";
import { navigationGroupForPath } from "@/lib/navigation";

describe("ClassTrace navigation route groups", () => {
  it.each([
    ["/", "home"],
    ["/assessments/new", "assessment"],
    ["/analyses/demo", "demo"],
    ["/analyses/demo/clusters/example", "demo"],
    ["/analyses/live", "live"],
    ["/analyses/live/clusters/cluster-01", "live"],
    ["/analyses/live/outcomes", "live"],
    ["/interventions/demo", "demo"],
    ["/interventions/live", "live"],
    ["/learn/demo", "demo"],
    ["/learn/live", "live"],
  ] as const)("maps %s exclusively to %s", (pathname, expected) => {
    expect(navigationGroupForPath(pathname)).toBe(expected);
  });

  it("does not classify unrelated analysis paths as demo routes", () => {
    expect(navigationGroupForPath("/analyses")).toBe(null);
    expect(navigationGroupForPath("/analyses/live")).not.toBe("demo");
  });
});
