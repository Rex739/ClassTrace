import { generateIntervention } from "@/lib/ai/generate-intervention";
import { InterventionRequestSchema } from "@/lib/ai/schemas";
import { ClassTraceError, safeErrorPayload, toClassTraceError } from "@/lib/ai/errors";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const parsed = InterventionRequestSchema.safeParse(await request.json());
    if (!parsed.success) throw new ClassTraceError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "The intervention request is incomplete.", false, 400);
    const input = parsed.data;
    const intervention = await generateIntervention(input.run, input.clusterId);
    return Response.json({ intervention, model: "gpt-5.6" }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const safe = toClassTraceError(error);
    return Response.json({ error: safeErrorPayload(safe) }, { status: safe.status, headers: { "Cache-Control": "no-store" } });
  }
}
