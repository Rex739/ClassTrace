import { ClassTraceError } from "@/lib/ai/errors";
import { MAX_IMAGE_BYTES, SUPPORTED_IMAGE_TYPES } from "@/lib/ai/schemas";

export interface ValidatedImage {
  mimeType: (typeof SUPPORTED_IMAGE_TYPES)[number];
  dataUrl: string;
}

export async function validateImageFile(file: File): Promise<ValidatedImage> {
  if (!SUPPORTED_IMAGE_TYPES.includes(file.type as (typeof SUPPORTED_IMAGE_TYPES)[number])) {
    throw new ClassTraceError("UNSUPPORTED_IMAGE", "Student-work images must be PNG, JPEG, or WebP.", false, 415);
  }
  if (file.size > MAX_IMAGE_BYTES) throw new ClassTraceError("IMAGE_TOO_LARGE", "Each student-work image must be 5 MB or smaller.", false, 413);
  if (file.size === 0) throw new ClassTraceError("INVALID_INPUT", "The uploaded image is empty.", false, 400);
  const bytes = Buffer.from(await file.arrayBuffer());
  return { mimeType: file.type as ValidatedImage["mimeType"], dataUrl: `data:${file.type};base64,${bytes.toString("base64")}` };
}
