import { evaluateTransfer } from "@/lib/ai/evaluate-transfer";
import { TransferRequestSchema } from "@/lib/ai/schemas";
import { ClassTraceError, safeErrorPayload, toClassTraceError } from "@/lib/ai/errors";

export const runtime = "nodejs";
export const maxDuration = 120;

export async function POST(request: Request) {
  try {
    const parsed = TransferRequestSchema.safeParse(await request.json());
    if (!parsed.success) throw new ClassTraceError("INVALID_INPUT", parsed.error.issues[0]?.message ?? "The transfer response is incomplete.", false, 400);
    const input = parsed.data;
    const evaluation = await evaluateTransfer(input);
    return Response.json({ evaluation, model: "gpt-5.6", createdAt: new Date().toISOString() }, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const safe = toClassTraceError(error);
    return Response.json({ error: safeErrorPayload(safe) }, { status: safe.status, headers: { "Cache-Control": "no-store" } });
  }
}
