# Deploying the 2016 site to Vercel

Two Vercel projects now exist (team `bob1323s-projects`):

- **`economy-simulator-web`** (`prj_lKxHvNxI0L5qfFjpW8W8fLMxxiJi`) — decommissioned.
  Its `rootDirectory` is `site-wipe/` (a minimal Next app that renders only the
  text `jsdjdjfisdjf`), so `economy-simulator-web.vercel.app` shows that tombstone
  and nothing else.
- **`ai-research-blox`** (`prj_QsiZrmMVyaYv4Evm7meVFVbOKY7o`) — the live site:
  `ai-research-blox.vercel.app`, `rootDirectory` = `services/2016-roblox-main`.

## Settings that matter

* **Framework**: Next.js. `framework: "other"` is rejected by the API and
  `framework: null` is silently ignored (stays `nextjs`), so the build target
  must be a real Next app under the configured `rootDirectory`.
* **Root directory**: `services/2016-roblox-main` (or `site-wipe` for the tombstone).
* **Node version**: `24.x` — set via `engines.node` in `package.json`. The
  project default can report `26.x`, which fails with
  `BUILD_UTILS_NODE_VERSION_INVALID` if the build actually runs on it.
* **Build command**: leave default (`next build` → `npm run build`).
* **Install command**: leave default; `npm install` must use
  `--legacy-peer-deps` (or `legacy-peer-deps=true` in `.npmrc`) because
  `@wojtekmaj/enzyme-adapter-react-17` pins React 17 peer ranges.

## Environment variables

Create these on the project (`type: "encrypted"`, targets `production`,
`preview`, `development` — plain type is rejected by the API):

| Key | Value |
| --- | --- |
| `SUPABASE_DB_URL` | Supabase pooled connection string (`aws-1-us-west-2.pooler.supabase.com:6543`, role `econ_web.<ref>`) — never the direct `db.*` host (IPv6-only, unreachable) |
| `SESSION_KEY` | random 64-char secret for `ECON_SESSION` JWTs (HS256) |
| `CSRF_KEY` | random 64-char secret for the CSRF double-submit cookie |

`config.json` is generated at build time by `util/create_config.js`; it is
gitignored and its values come from these environment variables.

## First-time setup

1. `vercel link` to the project (or use `vercel --cwd services/2016-roblox-main`).
2. `vercel env add SUPABASE_DB_URL production` (and `SESSION_KEY`, `CSRF_KEY`).
3. `vercel --prod` from the repo root.

## Redeploying after a push

The project is **unlinked from GitHub** (no auto-deploys). After each push to
`main`, create a production deployment from the commit via the Vercel API
(`POST /v13/deployments`) with `git_source` = `{ "type": "github",
"repoId": 1370194386, "ref": "<full commit SHA>" }` and `name` = the project
name. One manual deployment per push; the production alias follows the newest
READY deployment.

## Seeding

The API routes create schema tables on demand; catalog items, games and
starter wallets are seeded automatically (idempotently) on first read.

## 3D layer

* **Playable games** — `components/webGame/games/*` are three.js games
  (Sky Obby, Brick Busters, Crossy Canyon) rendered on the shared game canvas;
  the original Play button navigates to `/RobloxApp/Play?placeId=N` (the
  `launchUsingEsWeb` flag in `config.json`).
* **Item previews** — every item image renders an interactive rotating 3D
  preview (`components/itemPreview3d`) through the shared `ItemImage` slot.
* **Game thumbnails** — game cards render interactive 3D dioramas
  (`components/gamePreview3d`) through `SmallGameCard`.
* The pages under `pages/games/`, `pages/catalog/` and `pages/My/Character.aspx.js`
  are the **original main-branch versions, unmodified**; all behavior lives in
  the services layer and shared components.

## Tombstone / rollback

To point the old domain at a tombstone again: change the old project's
`rootDirectory` to `site-wipe` and deploy. To fully restore the old site there,
set `rootDirectory` back to `services/2016-roblox-main` and redeploy.
