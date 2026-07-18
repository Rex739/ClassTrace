import { analyseClassLive } from "@/lib/ai/analyse-class";
import { parseAnalysisPayload } from "@/lib/ai/api-input";
import { createPreparedAnalysisRun } from "@/lib/ai/prepared";
import { safeErrorPayload } from "@/lib/ai/errors";
import { validateImageFile, type ValidatedImage } from "@/lib/ai/files";
import { hasOpenAIKey } from "@/lib/ai/openai";

export const runtime = "nodejs";
export const maxDuration = 180;

export async function GET() {
  return Response.json({ liveAvailable: hasOpenAIKey(), model: "gpt-5.6", maxResponses: 12, supportedImages: ["image/png", "image/jpeg", "image/webp"] });
}

async function readRequest(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("multipart/form-data")) {
    const formData = await request.formData();
    const payloadValue = formData.get("payload");
    if (typeof payloadValue !== "string") throw new Error("Missing analysis payload.");
    const payload = parseAnalysisPayload(JSON.parse(payloadValue));
    const files = formData.getAll("images").filter((value): value is File => value instanceof File);
    const images: ValidatedImage[] = [];
    for (const file of files) images.push(await validateImageFile(file));
    return { payload, images };
  }
  return { payload: parseAnalysisPayload(await request.json()), images: [] as ValidatedImage[] };
}

export async function POST(request: Request) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (event: unknown) => controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
      void (async () => {
        try {
          send({ type: "stage", stage: "preparing", message: "Preparing responses" });
          const { payload, images } = await readRequest(request);
          if (payload.mode === "prepared_demo") {
            send({ type: "stage", stage: "validating", message: "Loading validated prepared evidence" });
            const result = createPreparedAnalysisRun();
            send({ type: "stage", stage: "complete", message: "Prepared demonstration ready" });
            send({ type: "result", data: result });
          } else {
            const result = await analyseClassLive(payload, images, (stage, message) => send({ type: "stage", stage, message }));
            send({ type: "result", data: result });
          }
        } catch (error) {
          send({ type: "error", error: safeErrorPayload(error) });
        } finally {
          controller.close();
        }
      })();
    },
  });
  return new Response(stream, { headers: { "Content-Type": "application/x-ndjson; charset=utf-8", "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
}
