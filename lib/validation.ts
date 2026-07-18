import { z } from "zod";

export const assessmentSchema = z.object({
  question: z.string().trim().min(20, "Add enough detail for students to respond meaningfully."),
  expectedReasoning: z.string().trim().min(20, "Describe the key ideas you expect to see."),
  responseCount: z.number().int().min(1, "Add at least one response."),
});
