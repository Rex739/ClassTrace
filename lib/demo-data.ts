import type {
  Assessment,
  Diagnosis,
  Intervention,
  MisconceptionCluster,
  Student,
  StudentResponse,
  TransferOutcome,
} from "@/lib/types";

export const assessment: Assessment = {
  id: "demo",
  title: "Circle area scaling",
  subject: "Mathematics · Geometry",
  question:
    "A circle has a radius of 3 cm. What happens to its area when the radius is doubled? Explain your reasoning.",
  expectedReasoning: [
    "Area is A = πr².",
    "Doubling r multiplies r² by 2².",
    "The area becomes four times as large: from 9π cm² to 36π cm².",
  ],
  createdLabel: "Prepared demo · 12 responses",
};

export const students: Student[] = Array.from({ length: 12 }, (_, index) => ({
  id: `student-${String(index + 1).padStart(2, "0")}`,
  label: `Learner ${String(index + 1).padStart(2, "0")}`,
}));

export const responses: StudentResponse[] = [
  { id: "r01", studentId: "student-01", finalAnswer: "18π cm²", submittedLabel: "09:02", answer: "The area doubles because the radius doubles. It was 9π, so it becomes 18π cm²." },
  { id: "r02", studentId: "student-02", finalAnswer: "56.5 cm²", submittedLabel: "09:03", answer: "The original area is about 28.3. Double the radius means double the area, so about 56.5 cm²." },
  { id: "r03", studentId: "student-03", finalAnswer: "2× larger", submittedLabel: "09:03", answer: "Radius and area increase together. A radius of 6 is twice 3, therefore the area is twice as large." },
  { id: "r04", studentId: "student-04", finalAnswer: "12π cm²", submittedLabel: "09:04", answer: "Use 2πr. With the new radius 6, the area is 2 × π × 6 = 12π cm²." },
  { id: "r05", studentId: "student-05", finalAnswer: "37.7 cm²", submittedLabel: "09:05", answer: "At radius 6, I calculate 2π(6), which is about 37.7 cm² for the area." },
  { id: "r06", studentId: "student-06", finalAnswer: "12π cm²", submittedLabel: "09:05", answer: "A = πr². I replaced r with 6 and did π × 6 × 2, giving 12π cm²." },
  { id: "r07", studentId: "student-07", finalAnswer: "18π cm²", submittedLabel: "09:06", answer: "The formula is πr². Doubling gives π × 6 × 3 because there are two radii, so 18π cm²." },
  { id: "r08", studentId: "student-08", finalAnswer: "112.8 cm²", submittedLabel: "09:06", answer: "The area should quadruple: 9π × 4. Using 3.14, I got 112.8 cm²." },
  { id: "r09", studentId: "student-09", finalAnswer: "108 cm²", submittedLabel: "09:07", answer: "New area = π(6²) = 36π. I estimated π as 3, so the area is 108 cm² and four times the original estimate." },
  { id: "r10", studentId: "student-10", finalAnswer: "36π cm²", submittedLabel: "09:07", answer: "A = πr². Changing r from 3 to 6 changes r² from 9 to 36, so the area is four times larger: 36π cm²." },
  { id: "r11", studentId: "student-11", finalAnswer: "4× larger", submittedLabel: "09:08", answer: "When radius is multiplied by 2, area is multiplied by 2². It grows from 9π to 36π cm², a factor of four." },
  { id: "r12", studentId: "student-12", finalAnswer: "≈113.1 cm²", submittedLabel: "09:09", answer: "The new radius is 6 cm, so A = π(6)² = 36π ≈ 113.1 cm². That is four times the old area." },
];

export const clusters: MisconceptionCluster[] = [
  { id: "linear-scaling", name: "Area scales linearly with radius", shortName: "Linear scaling", description: "Treats radius and area as directly proportional, missing the squared relationship.", learningNeed: "Connect the visual growth of a circle to the r² term.", responseIds: ["r01", "r02", "r03"], severity: "attention", commonFinalAnswers: ["18π cm²", "56.5 cm²", "2× larger"] },
  { id: "circumference-confusion", name: "Circumference substituted for area", shortName: "Formula confusion", description: "Uses 2πr while labelling the result as area.", learningNeed: "Distinguish what circumference and area measure, including their units.", responseIds: ["r04", "r05"], severity: "attention", commonFinalAnswers: ["12π cm²", "37.7 cm²"] },
  { id: "substitution-errors", name: "Radius substituted inconsistently", shortName: "Substitution", description: "Recalls A = πr² but does not preserve the exponent during substitution.", learningNeed: "Make substitution explicit before evaluating the exponent.", responseIds: ["r06", "r07"], severity: "uncertain", commonFinalAnswers: ["12π cm²", "18π cm²"] },
  { id: "arithmetic-slips", name: "Sound model, imprecise calculation", shortName: "Arithmetic slip", description: "Understands the fourfold relationship but introduces a numerical or approximation slip.", learningNeed: "Separate conceptual understanding from calculation accuracy.", responseIds: ["r08", "r09"], severity: "monitor", commonFinalAnswers: ["112.8 cm²", "108 cm²"] },
];

const diagnosis = (
  responseId: string,
  clusterId: string | null,
  summary: string,
  reasoning: Diagnosis["reasoning"],
  evidence: string[],
  confidence: Diagnosis["confidence"],
  alternativeHypothesis: string,
  needsTeacherReview = false,
): Diagnosis => ({ responseId, clusterId, summary, reasoning, evidence, confidence, alternativeHypothesis, needsTeacherReview });

export const diagnoses: Diagnosis[] = [
  diagnosis("r01", "linear-scaling", "Applies a ×2 scale factor directly to area.", [{ label: "Recall", detail: "Identifies the original area as 9π.", status: "sound" }, { label: "Scale", detail: "Transfers the radius scale factor directly to area.", status: "break" }, { label: "Conclude", detail: "Reports 18π cm².", status: "uncertain" }], ["“The area doubles because the radius doubles.”", "Correctly establishes the original area as 9π."], "high", "The learner may be using an intuitive visual estimate rather than a stable proportional rule."),
  diagnosis("r02", "linear-scaling", "Correct calculation of the original area, followed by linear scaling.", [{ label: "Calculate", detail: "Finds the original area as approximately 28.3.", status: "sound" }, { label: "Scale", detail: "Doubles that value when radius doubles.", status: "break" }], ["“Double the radius means double the area.”", "The answer 56.5 is approximately 2 × 28.3."], "high", "A calculator workflow may have hidden the formula structure."),
  diagnosis("r03", "linear-scaling", "Uses direct proportion without calculating an area.", [{ label: "Compare", detail: "Recognises 6 is twice 3.", status: "sound" }, { label: "Generalise", detail: "Assumes area changes by the same factor.", status: "break" }], ["“Radius and area increase together.”", "No area formula appears in the response."], "medium", "The response is brief enough that the learner may know the formula but omit it.", true),
  diagnosis("r04", "circumference-confusion", "Uses the circumference formula as an area formula.", [{ label: "Choose formula", detail: "Selects 2πr.", status: "break" }, { label: "Substitute", detail: "Correctly substitutes r = 6 into the chosen formula.", status: "sound" }], ["“Use 2πr.”", "The numeric work is internally consistent for circumference."], "high", "The learner may have mislabelled circumference rather than confused the measures."),
  diagnosis("r05", "circumference-confusion", "Calculates the new circumference and labels it area.", [{ label: "Substitute", detail: "Evaluates 2π(6).", status: "sound" }, { label: "Interpret", detail: "Names a length result as area.", status: "break" }], ["“2π(6) ... for the area.”", "37.7 matches the circumference of radius 6."], "high", "The formula may have been retrieved from memory without attention to units."),
  diagnosis("r06", "substitution-errors", "Loses the square while evaluating the area formula.", [{ label: "Recall", detail: "States A = πr².", status: "sound" }, { label: "Substitute", detail: "Changes r² into 6 × 2.", status: "break" }], ["“A = πr².”", "“π × 6 × 2” treats the exponent as multiplication."], "high", "This may be exponent-notation confusion rather than substitution alone."),
  diagnosis("r07", "substitution-errors", "Mixes the original and doubled radii inside the product.", [{ label: "Recall", detail: "States the correct formula.", status: "sound" }, { label: "Substitute", detail: "Uses both 6 and 3 for r².", status: "break" }], ["“π × 6 × 3 because there are two radii.”", "The product combines the new and original radius."], "medium", "The learner may be comparing old and new areas in a compressed explanation.", true),
  diagnosis("r08", "arithmetic-slips", "Conceptual scaling is secure; decimal product is slightly inaccurate.", [{ label: "Scale", detail: "Identifies the area must quadruple.", status: "sound" }, { label: "Calculate", detail: "Computes 9π × 4 with a small slip.", status: "break" }], ["“The area should quadruple.”", "112.8 is close to 36π ≈ 113.1."], "high", "The discrepancy could come from rounding an earlier value."),
  diagnosis("r09", "arithmetic-slips", "Correct symbolic result with a coarse approximation of π.", [{ label: "Substitute", detail: "Finds π(6²) = 36π.", status: "sound" }, { label: "Approximate", detail: "Uses π ≈ 3 without stating precision limits.", status: "uncertain" }], ["“New area = π(6²) = 36π.”", "The fourfold relationship is explicitly preserved."], "medium", "Using π = 3 may be intentional estimation, not an arithmetic error.", true),
  diagnosis("r10", null, "Complete and correct squared-scaling reasoning.", [{ label: "Model", detail: "Uses A = πr².", status: "sound" }, { label: "Compare", detail: "Connects 9 to 36 and concludes ×4.", status: "sound" }], ["“r² from 9 to 36.”"], "high", "No material alternative hypothesis."),
  diagnosis("r11", null, "Generalises the scale factor using 2².", [{ label: "Generalise", detail: "Maps a radius factor k to area factor k².", status: "sound" }, { label: "Verify", detail: "Checks 9π against 36π.", status: "sound" }], ["“Area is multiplied by 2².”"], "high", "No material alternative hypothesis."),
  diagnosis("r12", null, "Correct substitution, calculation and comparison.", [{ label: "Substitute", detail: "Evaluates π(6)².", status: "sound" }, { label: "Interpret", detail: "States the result is four times the original.", status: "sound" }], ["“36π ≈ 113.1 cm².”"], "high", "No material alternative hypothesis."),
];

export const intervention: Intervention = {
  id: "demo",
  title: "When the radius grows, what grows with it?",
  clusterIds: ["linear-scaling", "circumference-confusion", "substitution-errors"],
  objective: "See and explain why doubling radius makes the area four times as large.",
  predictionPrompt: "Before moving the radius, predict how the area will change when 3 cm becomes 6 cm.",
  explanationPrompt: "Use the diagram and the expression πr² to explain the scale factor.",
  reflectionPrompt: "What idea would you revise in your original response?",
  transferQuestion: "A circle’s radius changes from 5 cm to 15 cm. By what factor does its area change? Explain.",
};

export const transferOutcomes: TransferOutcome[] = [
  { studentId: "student-01", beforeClusterId: "linear-scaling", status: "resolved", transferAnswer: "9×", evidence: "Explains that tripling radius gives 3² = 9 times the area." },
  { studentId: "student-02", beforeClusterId: "linear-scaling", status: "resolved", transferAnswer: "9×", evidence: "Uses 25π and 225π to verify the factor." },
  { studentId: "student-03", beforeClusterId: "linear-scaling", status: "uncertain", transferAnswer: "9×", evidence: "Correct answer, but explanation only says ‘square it’." },
  { studentId: "student-04", beforeClusterId: "circumference-confusion", status: "resolved", transferAnswer: "9×", evidence: "Contrasts circumference ×3 with area ×9." },
  { studentId: "student-05", beforeClusterId: "circumference-confusion", status: "follow-up", transferAnswer: "3×", evidence: "Returns to 2πr in the transfer question." },
  { studentId: "student-06", beforeClusterId: "substitution-errors", status: "resolved", transferAnswer: "9×", evidence: "Writes π(15)² ÷ π(5)² = 9." },
  { studentId: "student-07", beforeClusterId: "substitution-errors", status: "uncertain", transferAnswer: "9×", evidence: "Correct factor with an incomplete substitution step." },
  { studentId: "student-08", beforeClusterId: "arithmetic-slips", status: "resolved", transferAnswer: "9×", evidence: "Leaves the ratio symbolic and avoids premature rounding." },
  { studentId: "student-09", beforeClusterId: "arithmetic-slips", status: "resolved", transferAnswer: "9×", evidence: "Uses exact π terms and states the factor clearly." },
  { studentId: "student-10", beforeClusterId: null, status: "resolved", transferAnswer: "9×", evidence: "Generalises with k²." },
  { studentId: "student-11", beforeClusterId: null, status: "resolved", transferAnswer: "9×", evidence: "Accurate visual and symbolic reasoning." },
  { studentId: "student-12", beforeClusterId: null, status: "resolved", transferAnswer: "9×", evidence: "Checks the result numerically." },
];

export const getResponse = (id: string) => responses.find((response) => response.id === id);
export const getDiagnosis = (responseId: string) => diagnoses.find((item) => item.responseId === responseId);
export const getStudent = (studentId: string) => students.find((student) => student.id === studentId);
