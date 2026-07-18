# ClassTrace

**See how your class is thinking.**

ClassTrace is misconception intelligence for teachers. It reconstructs observable reasoning across responses to one question, discovers shared possible misconceptions, supports teacher review, configures targeted interventions, and evaluates whether the reasoning transfers to a new problem.

The main experience is a teacher-facing reasoning instrument—not a chatbot.

## Architecture

```mermaid
flowchart TD
    A[Assessment question and rubric] --> B[Typed responses or de-identified images]
    B --> C[GPT-5.6 structured individual analysis]
    C --> D[Application evidence validation]
    D --> E[GPT-5.6 cohort clustering]
    E --> F[Deterministic membership normalization]
    F --> G[Existing Trace Map and teacher review]
    G --> H[GPT-5.6 intervention configuration]
    H --> I[Trusted React activity components]
    I --> J[Student answer and explanation]
    J --> K[GPT-5.6 transfer evaluation]
    K --> L[Before-and-after evidence]
```

OpenAI requests run only from Node.js API routes. The browser stores validated structured results and teacher edits in `localStorage`; uploaded image bytes are never persisted.

The live class workflow uses four bounded requests:

1. One class-wide request reconstructs observable reasoning for up to 12 responses.
2. One request clusters the validated individual analyses by shared reasoning evidence.
3. One request configures an intervention after the teacher chooses a cluster.
4. One request evaluates a submitted transfer answer and explanation.

All requests use the Responses API, `model: "gpt-5.6"`, `store: false`, Zod schemas, `zodTextFormat`, `responses.parse`, timeouts, and limited SDK retries.

## Phase 1 and Phase 2

Phase 1 established the premium responsive interface, deterministic synthetic class, signature Trace Map, teacher workbench, circle explorer, student activity, and prepared outcomes.

Phase 2 adds:

- server-only GPT-5.6 Responses API integration;
- structured multimodal analysis for typed work and PNG, JPEG, or WebP images;
- real application-stage NDJSON progress;
- verbatim evidence verification and confidence thresholds;
- deterministic cluster-membership normalization;
- visible live/prepared provenance;
- locally persisted approval, rename, move, review, merge, and restore controls;
- validated intervention configuration rendered by trusted components;
- live transfer evaluation based on answer and explanation;
- safe, copyable JSON evidence export;
- offline tests and an optional live evaluation harness.

The prepared demonstration remains available without an API key and never silently replaces a failed live run.

## Setup

Requirements: Node.js 20.9 or newer and npm.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

Environment variables:

```bash
OPENAI_API_KEY=
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

`OPENAI_API_KEY` is read only by server modules. The build and prepared demonstration do not require it.

## Live and prepared modes

- **Live analysis · GPT-5.6:** sends the supplied assessment and de-identified responses to the OpenAI Responses API and renders validated results in the existing Trace Map.
- **Prepared demonstration · deterministic data:** uses the bundled 12-learner synthetic fixture and makes no model call.

From `/assessments/new`, choose **Load sample inputs** followed by **Analyse with GPT-5.6** to run the synthetic class live. Choose **Open prepared demonstration** for the offline story.

## Demo flow

- `/` — product overview and Trace Map preview
- `/assessments/new` — assessment, rubric, typed responses, image uploads, live progress and recoverable errors
- `/analyses/demo` — deterministic analysis
- `/analyses/live` — current validated live run
- `/analyses/live/clusters/[clusterId]` — evidence and teacher adjustments
- `/interventions/live` — GPT-5.6 configuration and teacher approval
- `/learn/live` — trusted student activity and live transfer submission
- `/analyses/live/outcomes` — transfer evidence and teacher recommendation

The strongest quick demo is documented at the end of this README.

## Privacy and product boundaries

- Use synthetic or de-identified student work for this demonstration.
- Fixtures use aliases such as `Learner 01`; they contain no real student data.
- Images are validated in memory, sent directly for analysis, and not persisted by ClassTrace.
- Raw image contents, prompts, API keys, and raw OpenAI responses are not logged or returned to the browser.
- Student work is treated as untrusted content and is isolated with explicit prompt boundaries.
- Exact evidence excerpts must occur verbatim in the supplied work or the run is rejected.
- Low-confidence and unreadable work requires teacher review.
- ClassTrace suggests possible reasoning patterns. Teachers remain responsible for instructional decisions.
- The product never diagnoses intelligence, medical, psychological, behavioural, or neurodevelopmental conditions.

## Structured outputs

The server validates:

- individual submission analyses, including readability, observable reasoning, verbatim evidence, alternatives, confidence, and review status;
- cohort clusters, demonstrated understanding, teacher attention, intervention recommendation, and calculated summary counts;
- a discriminated intervention union for circle explorer, comparison activity, worked example, or teacher review;
- transfer status: `resolved`, `partially_resolved`, `unresolved`, or `uncertain`.

Intervention output is configuration data only. ClassTrace rejects executable code, scripts, HTML, CSS, JSX, event handlers, and JavaScript URLs.

## Quality checks and evaluation

```bash
npm run lint
npm test
npm run build
npm run eval:classtrace
```

The default test suite is offline and does not require an API key. `npm run eval:classtrace` always runs structural checks against the synthetic class. When `OPENAI_API_KEY` is present, it additionally runs the two-stage sample analysis with GPT-5.6.

The evaluation verifies representation of all 12 responses, duplicate membership, evidence presence, review thresholds, major prepared reasoning patterns, schema validity, and non-executable intervention output. It is a small hackathon evaluation, not a claim of general pedagogical validity; broader subjects, handwriting conditions, languages, and ambiguous work require further evaluation with educators.

Playwright-ready navigation tests are available with:

```bash
npx playwright install chromium
npm run test:e2e
```

## Vercel deployment

1. Push this repository to a Git provider.
2. Import the repository into Vercel as a Next.js project.
3. Set `OPENAI_API_KEY` as a protected server environment variable for Production and Preview.
4. Set `NEXT_PUBLIC_APP_URL` to the deployed HTTPS origin.
5. Deploy using the standard Next.js build command, `npm run build`.
6. Verify `/analyses/demo` without an API key and then run a de-identified live analysis with the configured key.

No Cloudflare Workers or Sites adapter is used.

## Current limitations

- One current live class run, intervention, and transfer evaluation are stored per browser.
- There is no authentication, database, class roster, or cross-device persistence.
- The MVP accepts at most 12 responses and 5 MB per image.
- Only the circle-area intervention is deeply interactive; other intervention types render structured teacher-reviewed cards.
- A live transfer outcome represents the completed learner submission on this device rather than an entire class re-assessment batch.
- Image quality and handwriting legibility still affect evidence quality; unreadable work is routed to teacher attention.
- The optional live evaluation depends on account access to the `gpt-5.6` alias and consumes API usage.

## How Codex and GPT-5.6 contributed

Codex helped implement:

- application architecture;
- typed schemas;
- OpenAI integration;
- streaming orchestration;
- UI components;
- tests;
- accessibility;
- error handling;
- evaluation tooling.

The builder personally defined:

- the teacher-first product direction;
- misconception-evidence requirements;
- human-review boundaries;
- visual direction;
- supported concept scope;
- intervention workflow;
- submission story.

GPT-5.6 performs at runtime:

- multimodal student-work interpretation;
- observable reasoning reconstruction;
- possible misconception hypotheses;
- cohort pattern discovery;
- intervention configuration;
- transfer evaluation.

Codex /feedback session ID: **[add before submission]**

## Build Week evidence

The repository contains the complete product implementation, explicit model alias, structured schemas, server-only request modules, streaming endpoint, deterministic fallback, teacher-edit store, intervention renderer, transfer evaluator, tests, evaluation command, and this implementation record. Git history and the Codex `/feedback` session can be included as supporting submission evidence.

## Strongest 60-second demo

1. Open `/assessments/new` and select **Load sample inputs**.
2. Select **Analyse with GPT-5.6** and narrate the seven real application stages.
3. On `/analyses/live`, point to the provenance badge and Trace Map: same task, distinct evidence-grounded reasoning routes.
4. Open a cluster, show a verbatim excerpt and alternative hypothesis, then approve or move one response.
5. Generate and approve the circle-area intervention.
6. In the student view, change the radius, submit a transfer answer plus explanation, and open live outcomes.
7. Close on the transfer status, confidence, teacher recommendation, and copyable JSON evidence record.
