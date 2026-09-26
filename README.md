# TeachingPlanMaker_2026

A local, teacher-led teaching-plan workspace built with Next.js App Router, TypeScript, Tailwind CSS, and localStorage. Nothing is deployed, and there is no external database.

## Run locally

Requires Node.js 20.9+ and npm.

```sh
npm install
npm run dev
```

Open http://127.0.0.1:3000. For a different port use `npm run dev -- --port 3216`.

Production mode:

```sh
npm run typecheck
npm run build
npm run start
```

Keep the same host and port to access the same saved plans. `localhost` and `127.0.0.1`, and different ports, have separate browser storage.

## Optional AI

Copy `.env.example` to `.env.local` in this app's root. Put your key in the `OPENAI_API_KEY` value and restart the local server. No real key is included. Do not use a `NEXT_PUBLIC_` variable for secrets.

`OPENAI_MODEL` defaults to `gpt-4.1-mini`; change it to a model available to your API account. The browser sends requests only to `/api/chat`. The server calls the OpenAI Responses API with `store: false`. The API key remains on the server. The integration follows https://developers.openai.com/api/docs/guides/text.

Without a key, all editing, saving, student preview, and printing work. The AI panel explains how to enable AI. Sending a discussion sends the relevant plan context and up to 40 recent messages to OpenAI. AI can make mistakes; review suggestions before inserting.

Context is assembled on the server:

- General: plan type and General Plan.
- Detailed: General Plan and timeline.
- Board / Slide: General Plan, timeline, boards, slides.
- Reflection: full plan and reflection.

AI messages do not mutate a plan. Select response text or click **Use this response**, edit the selected suggestion, then choose an insertion action. Stage suggestions initially enter Teacher Behaviors; split the text into the remaining fields as desired. Replacements are explicit, and whole-stage or slide/board replacement asks for confirmation. General Plan text replacement uses the text range selected in an editor field.

## Local data

One localStorage key: `TeachingPlanMaker_2026:v1`.

```json
{"version":1,"plans":[{"id":"UUID","type":"Lecture","general":{},"timeline":[],"slides":[],"boards":[],"reflection":{},"summary":"","visibility":{},"chats":{},"updated":"ISO date"}]}
```

General/reflection fields contain strings. Each timeline, slide, or board item has `{id, values, show}`. `visibility.objectives` and `visibility.summary` control the two general student-facing sections. `chats` stores separate discussions for each editing section.

Plans save on every edit. The sample is seeded only when the storage key does not exist; an intentionally empty list stays empty. Invalid stored data is left untouched. Storage failures are shown visibly. **Download backup** exports the local JSON, including teacher notes and chat history. Keep a backup before clearing browser data. There is no cloud sync. Use one tab at a time to avoid concurrent edits overwriting each other.

## Student privacy

Student View uses an allowlist: lesson title, explicitly shared objectives, shared stages' student behaviors, shared slides' title/content/question/student action, shared boards' wording/examples/diagram, and explicitly shared final summary. It excludes teacher actions, internal notes, timing instructions, chat, and reflections. All sharing starts off, including in the sample.

This is a preview within the teacher workspace, not a separately authenticated student portal. Use **Print Student View** for a student-facing handout. **Generate Final Plan** is the full teacher copy and includes private planning information and reflection.

## Source map

- `src/components/Workspace.tsx`: home, creation, saved plans, editing, local persistence, explicit insertion actions.
- `src/components/Editors.tsx`: reusable fields, sharing controls, reorderable stage/slide/board editors.
- `src/components/AIPanel.tsx`: section discussions, selected suggestions, network/error states.
- `src/components/PlanViews.tsx`: printable teacher copy and allowlisted Student View.
- `src/lib/plans.ts`: data types, validation, context filtering, time totals, sample plan.
- `src/app/api/chat/route.ts`: server-only OpenAI route.
- `src/app/globals.css`: visual design, responsive and print styles with Tailwind entry point.
- `tests/workspace.spec.ts`: browser workflow, persistence, AI insertion, and privacy checks.

## Verification

```sh
npx playwright install chromium
npm run build
npm test
```

Tests launch the production app on port 3216. Run with no API key for the missing-key test. AI response tests use mocks and do not incur API charges. A real-key end-to-end AI call is not part of the automated checks.

## Deliberately deferred

Native Word export, advanced PDF generation (browser Print/Save as PDF is available), cloud sync, database, accounts, public student links, presentation playback, rich board diagrams, JSON restore UI, automatic parsing of AI responses into multiple structured items, and multi-tab conflict resolution. No deployment has been configured.
