import { describe, expect, it } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TransferDifficultyDetail } from "@/components/transfer-difficulty-detail";
import { transferComparisonDisplay } from "@/lib/outcome-display";

describe("transfer outcome before-and-after wording", () => {
  it.each([
    ["resolved", { count: 0, label: "misconceptions remaining", bar: "0%" }],
    ["partially_resolved", { count: 1, label: "partially resolved", bar: "100%" }],
    ["unresolved", { count: 1, label: "still unresolved", bar: "100%" }],
    ["uncertain", { count: 1, label: "requires further evidence", bar: "100%" }],
  ] as const)("uses accurate comparison wording for %s", (status, expected) => {
    expect(transferComparisonDisplay(status)).toEqual(expected);
  });
});

describe("transfer outcome difficulty wording", () => {
  it("labels resolved follow-on content as an optional extension", () => {
    const markup = renderToStaticMarkup(createElement(TransferDifficultyDetail, {
      status: "resolved",
      remainingDifficulty: "Try generalising the relationship for any scale factor.",
    }));
    expect(markup).toContain("Optional extension");
    expect(markup).not.toContain("Remaining difficulty");
  });

  it.each(["partially_resolved", "unresolved", "uncertain"] as const)(
    "preserves remaining-difficulty wording for %s outcomes",
    (status) => {
      const markup = renderToStaticMarkup(createElement(TransferDifficultyDetail, {
        status,
        remainingDifficulty: "The learner still needs to connect the two radius factors.",
      }));
      expect(markup).toContain("Remaining difficulty");
      expect(markup).not.toContain("Optional extension");
    },
  );

  it("renders no difficulty section when the value is null", () => {
    expect(renderToStaticMarkup(createElement(TransferDifficultyDetail, {
      status: "resolved",
      remainingDifficulty: null,
    }))).toBe("");
  });
});
