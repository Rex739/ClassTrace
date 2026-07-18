export function getResponseRefusal(response: unknown): string | null {
  if (!response || typeof response !== "object" || !("output" in response) || !Array.isArray(response.output)) return null;
  for (const output of response.output) {
    if (!output || typeof output !== "object" || !("content" in output) || !Array.isArray(output.content)) continue;
    for (const item of output.content) if (item && typeof item === "object" && "type" in item && item.type === "refusal") return "refusal" in item && typeof item.refusal === "string" ? item.refusal : "The model declined the request.";
  }
  return null;
}
