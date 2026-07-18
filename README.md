# ClassTrace

**See how your class is thinking.**

ClassTrace is misconception intelligence for teachers. It reconstructs reasoning across a class set, groups shared learning needs, supports teacher review, generates targeted intervention activities, and records evidence of transfer.

This repository contains the Phase 1 Build Week frontend. It uses deterministic synthetic data and makes no external API calls.

## Quick start

Requirements: Node.js 20.9 or newer and npm.

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Quality checks

```bash
npm run lint
npm test
npm run build
```

The Playwright structure is ready for local browser testing:

```bash
npx playwright install chromium
npm run test:e2e
```

## Demo journey

- `/` — product overview and Trace Map preview
- `/assessments/new` — validated assessment setup and prepared-demo loader
- `/analyses/demo` — full deterministic class analysis
- `/analyses/demo/clusters/[clusterId]` — response-level reasoning review
- `/interventions/demo` — intervention preview and approval
- `/learn/demo` — distraction-free student activity
- `/analyses/demo/outcomes` — transfer evidence and before/after summary

The fixtures model 12 anonymous synthetic learners across linear-scaling, circumference/area confusion, substitution errors, arithmetic slips, and secure understanding. No real names or student data are included.

## Implementation status

Phase 1 includes the responsive App Router frontend, typed fixtures, teacher review interactions, a live circle-area explorer, outcome transformations, Vitest unit tests, error states, and Playwright-ready navigation tests. OpenAI integration is intentionally deferred.

Phase 2 will replace deterministic diagnosis and intervention generation with structured GPT-5.6 workflows, schema-validated outputs, evidence citations, streaming analysis progress, privacy controls, retry/error handling, and persisted teacher edits.
