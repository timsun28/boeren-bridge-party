# Repository Guidelines

## Project Structure & Module Organization
- `app/` hosts App Router routes; `app/page.tsx` and `app/RoomList.tsx` render the lobby, while server actions live in `app/actions.ts`.
- `components/` stores reusable UI; `components/ui/` mirrors the shadcn settings in `components.json`.
- `lib/` holds helpers and `types/` centralizes shared models such as `types/game.ts`.
- `party/` runs the PartyKit server (`party/index.ts`) with utilities in `party/utils/` and static assets under `party/public/`.
- `public/` exposes static files served by Next.js.

## Build, Test, and Development Commands
- `pnpm install` installs dependencies; use pnpm to keep `pnpm-lock.yaml` canonical.
- `pnpm dev` launches Next.js with Turbopack on `http://localhost:3003`.
- `pnpm exec partykit dev` starts the PartyKit rooms locally (default `127.0.0.1:1999`); run beside `pnpm dev` for realtime flows.
- `pnpm build` creates the production bundle.
- `pnpm start` serves the compiled app for smoke checks.
- `pnpm lint` applies the Next.js ESLint rules; run before every PR.

## Coding Style & Naming Conventions
- TypeScript is strict; rely on the `@/*` alias instead of deep relative paths.
- Current formatting uses four-space indentation and double quotes; keep the style consistent or run your formatter before committing.
- React components use PascalCase filenames, hooks start with `use*`, and PartyKit helpers remain in `party/utils/`.
- Compose Tailwind classes in a consistent order: layout, spacing, color, interaction.

## Testing Guidelines
- No automated harness exists yet; linting and manual verification in the browser guard regressions.
- When adding coverage, colocate `*.test.ts(x)` files with the code and document a `pnpm test` script so contributors share an entrypoint.
- Exercise realtime behaviour by hitting `http://localhost:3003` while tailing the PartyKit console.

## Commit & Pull Request Guidelines
- Recent commits are brief; prefer imperative summaries (e.g., `Add trick summary modal`) and add context in the body if needed.
- PRs should include a change summary, proof of checks (`pnpm lint`, manual steps), and screenshots or GIFs for UI tweaks.
- Reference issues or PartyKit tickets and flag any environment or schema updates explicitly.

## Environment Notes
- `.env.local` configures `NEXT_PUBLIC_PARTYKIT_HOST` (defaults to `127.0.0.1:1999`) and protocol overrides for remote servers.
- Keep `vercel.json` and `partykit.json` in sync with deployment changes to avoid drift.
