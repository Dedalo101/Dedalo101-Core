# Dedalo101 Core — Agent Guidelines

Architecture and implementation rules for **dedalo-core** and all Dedalo101 artist properties.

## System goals

1. **Zero marginal cost** — Oracle Always Free + PocketBase + static hosting until profitable.
2. **Static-first public sites** — GitHub Pages or Cloudflare; no server runtime on artist domains.
3. **Artist self-service** — Tailwind dashboard at `dashboard/artist-dashboard.html`.
4. **Single source of truth** — PocketBase; static output is derived, not authoritative.

## Architecture (mandatory)

```
dashboard/artist-dashboard.html  →  PocketBase (Oracle)
scripts/build-static.js          →  data/{slug}/*.json + *.html
Artist static site               →  reads data/ or DedaloPB client
```

### Never

- Add PHP/Node/database to artist site repos.
- Commit admin tokens, passwords, or `POCKETBASE_TOKEN` to any repo.
- Bypass API rules with public write access.
- Ship artist sites that call PocketBase for writes (dashboard only).

## Repository layout

| Path | Purpose |
|------|---------|
| `dashboard/artist-dashboard.html` | Tailwind UI shell |
| `dashboard/dashboard-app.js` | Auth, CRUD, errors, loading UX |
| `js/pocketbase-client.js` | Read-only static site helpers + retry |
| `scripts/build-static.js` | CI/local static generator |
| `pocketbase/pocketbase-collections.json` | Schema source of truth |
| `components/config.example.js` | Static site config template |

## PocketBase

| Collection | Type | Static export |
|------------|------|---------------|
| `artists` | auth | profile fields only |
| `releases` | base | `published = true` |
| `events` | base | `published = true` |
| `mixes` | base | `published = true` |

### API rules (do not weaken without review)

- Public list/view: `published = true` on content collections.
- Artist CRUD: `@request.auth.id != '' && artist = @request.auth.id`.
- Artists view/update own auth record only.

Schema changes require updating `pocketbase-collections.json` and re-import/sync on server.

## Artist dashboard guidelines

- **Stack:** Tailwind CDN + PocketBase JS SDK 0.22.x (pinned).
- **Config:** `window.DEDALO_PB_URL` set before scripts — never hardcode production URL in `dashboard-app.js`.
- **Error handling (required):**
  - `getErrorMessage()` for all catch blocks
  - Inline errors on login/forms (`#login-error`, `#event-form-error`, etc.)
  - Toast notifications for global feedback
  - `console.error` with `[Dedalo Dashboard]` prefix for debugging
  - 401 → clear session and return to login
- **UX (required):**
  - Global loader overlay for session restore / full refresh
  - Per-list loading spinners
  - `aria-busy` on buttons during submit
  - Delete confirmation modal
  - Auto-refresh lists after create/update/delete (`loadAll({ silent: true })`)
  - Escape key closes modals
- **Stats:** Update `#stat-*` after every successful load.
- New entity types (e.g. mixes CRUD) follow the same modal + list + toast patterns.

## Static site integration

### Preferred: build-time artifacts

- Output: `data/{slug}/site-data.json`, `*.fragment.html`, `index.generated.html`
- Workflow: `.github/workflows/build-from-pocketbase.yml`
- Failures must exit non-zero; use GitHub step summary + optional `SLACK_WEBHOOK_URL`

### Optional: client-side

- `DedaloPB.create()` with built-in retry (429/5xx/network)
- Configure CORS on PocketBase for artist origins
- Prefer JSON build for GitHub Pages (no CORS dependency)

## Performance priorities

1. Static sites load **JSON or prebuilt HTML** — no blocking API chains on first paint.
2. Images via PocketBase file URLs; use `loading="lazy"` in generated HTML.
3. `getFullList` only in dashboard (authenticated); static uses filtered public rules + pagination in client.
4. Minimize dashboard bundle — no frameworks beyond Tailwind + PocketBase SDK.

## GitHub Actions

- Secrets: `POCKETBASE_URL`, `POCKETBASE_TOKEN`
- Variable: `ARTIST_SLUGS`
- Validate secrets before build step
- Commit `data/` only when changed; `[skip ci]` in message
- `notify-failure` job on build failure

## Security checklist

- [ ] API rules on every new collection
- [ ] No secrets in frontend or artist repos
- [ ] Dashboard `noindex,nofollow`
- [ ] Slug validation `^[a-z0-9-]+$`
- [ ] `published` defaults false for new content
- [ ] PocketBase SDK version pinned

## Coding standards

- Vanilla JS; well-commented functions for error mapping and retry.
- `snake_case` in PocketBase fields; `camelCase` in JS when mapping for UI.
- English UI strings; concise user-facing errors.
- One schema file: `pocketbase-collections.json` (not scattered JSONs).

## Out of scope

- Payments, ticketing inventory, streaming analytics
- Label-wide admin UI (future module)
- Email marketing integrations

## Related repos

Artist sites consume `data/` or copy `js/pocketbase-client.js`. Do not duplicate schema — reference dedalo-core.