# TeachingPlanMaker_2026 — handover

## Created folder

`/Users/hitoshieguchi/Documents/English Department/2026/APP Making/Teaching/TeachingPlanMaker_2026`

The original `/Users/eguchihitoshi` account does not exist on this Mac. The matching hierarchy was created under the actual `hitoshieguchi` account after filesystem approval. No pre-existing apps or files were changed. No deployment or external database was created.

## Run

The production app was started at http://127.0.0.1:3216.

To develop after stopping the running server:

```sh
cd "/Users/hitoshieguchi/Documents/English Department/2026/APP Making/Teaching/TeachingPlanMaker_2026"
npm run dev -- --port 3216
```

Dependencies are already installed. On a fresh copy use `npm ci` first. Keep the host and port the same to access the same browser-local saved plans.

## Main source files

- `src/components/Workspace.tsx`: home, creation, planning navigation, autosave and insertion actions.
- `src/components/Editors.tsx`: five-column editable timeline, slide/board editors, reorder and sharing controls.
- `src/components/AIPanel.tsx`: section-specific discussion and explicit insertion controls.
- `src/components/PlanViews.tsx`: printable teacher view and student content allowlist.
- `src/lib/plans.ts`: schemas, sample, contextual inheritance and time calculations.
- `src/app/api/chat/route.ts`: secure server-side OpenAI integration.
- `src/app/globals.css`: Tailwind entry, responsive styling, print layout.

## Saved data

localStorage key: `TeachingPlanMaker_2026:v1`.

Value: `{version: 1, plans: [...]}`. Each plan contains metadata, General Plan, timeline, slides, boards, visibility flags, reflection, summary, separate AI conversations and last-edited timestamp. A sample plan is seeded on first use. Download backup saves a JSON copy. Storage is specific to the browser and URL origin. No server database is used.

## AI setup

Copy `.env.example` to `.env.local` in the created app folder, enter `OPENAI_API_KEY`, then restart the server. No actual API key is included. The server route uses the Responses API, `store: false`, and `OPENAI_MODEL` (default `gpt-4.1-mini`). The client never receives the key. Only explicit teacher insertion changes a plan. Earlier sections are filtered into later contexts on the server. The missing-key state is functional and clearly explained.

## Verification completed

- TypeScript: passed (`npm run typecheck`).
- Production build: passed (`npm run build`, Next.js 15.5.25).
- Automated checks: 3 passed — context isolation, sample sequence/timing/disclosure order, and missing-key API response.
- Browser UI checks: new plan with blank initial duration; custom 37.5-minute duration; editing; autosave and full-reload persistence; 40-minute overrun warning; recalculation to 25 minutes remaining; stage reordering; slide editing/duplication; board editing; explicit suggestion insertion; reflection; final teacher view; and Student View excluding private notes/actions/reflection.
- Full Playwright browser tests are included, but this session's macOS sandbox prevented their Chromium process from launching. They are not reported as passed. The manual browser checks above were performed through the Codex browser instead.
- No real-key OpenAI call was made. AI network success with your account still needs verification after configuring a key.
- Print styles and the final print-ready view are implemented; a physical print/PDF export was not performed.

A disposable plan named “Prototype check lesson” may remain in the verification browser's storage; it is not part of the seeded app data. A native confirmation dialog prevented automated cleanup in that browser.

## Deferred

Native Word export, advanced PDF export, cloud sync, accounts, a separately hosted student portal, presentation playback, visual board diagrams, JSON import UI, automatic structured parsing of AI responses and multi-tab conflict resolution. Browser Print / Save as PDF is available. No cloud publishing was configured.

See README.md for full usage and data-model notes.
