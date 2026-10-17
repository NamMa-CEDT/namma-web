# NamMa web (น้ำมา)

Web app for the NamMa flood assistant: chat, station map and responder dashboard.
The backend (FastAPI, LINE bot, ingest, risk, forecast) is in the sibling repo **`namma`**.

Stack: Vite + React 19 + TypeScript + Tailwind 4, react-router (`HashRouter`), TanStack Query, react-leaflet, Recharts.

## Run

```bash
npm ci
npm run dev                                    # mock API, http://localhost:5173
VITE_API_MODE=http VITE_DEMO_LOGIN=1 npx vite  # real backend on :8000 (backend needs DEMO_MODE=1)
npm run typecheck && npm test && npm run build # checks
```

Settings: `.env.example` (copy to `.env.local`).

## Working with the backend

- **API contract:** `docs/api.md` in the `namma` repo, mirrored here by `src/api/types.ts`. The mock in
  `src/api/mock/` is the executable spec (`mock.test.ts`). A shape change updates the contract doc,
  the types and the mock together: one PR in each repo, linked to each other.
- **Mock fixtures** (`src/api/mock/fixtures/`) are real ThaiWater data exported by the backend:
  with both repos side by side, run `python -m ingest.export_web_fixtures` in `namma`
  (or `--out <path to this repo>/src/api/mock/fixtures`).
- **Hosting:** the backend serves the built app on the same origin as `/api` (one cert, no CORS). Build here,
  then copy `dist/` to the VM and point `WEB_DIST` at it (see `infra/deploy/README.md` in `namma`).
- Why `HashRouter` and no service workers: OBS can't rewrite deep links, and the LIFF browser has none.
- Thai copy lives in `src/copy.ts`. Design tokens: `src/styles/tokens.json`
  (CSS via `scripts/tokens_to_css.py`); component classes `nm-*` in `src/index.css`.

## Rules that apply here too

The product rules in `namma/CLAUDE.md` §2 hold for the UI: numbers only from the API, every risk answer names
its source, the DDPM hotline (1784, LINE @1784DDPM) on every risk answer and alert, station ≠ house.
