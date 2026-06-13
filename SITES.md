# Dedalo101 — Local folder ↔ GitHub repo map

**Rule:** Every site lives at `DEDALO101 SITES/<repo-name>/` where `<repo-name>` is **exactly** the GitHub repo name under [Dedalo101](https://github.com/Dedalo101).

Clone command (always the same pattern):

```bash
git clone https://github.com/Dedalo101/<repo-name>.git "C:/Users/agg/Desktop/DEDALO101 SITES/<repo-name>"
```

## Glue Records roster (artist sites)

| Artist | GitHub repo | Local folder | Domain |
|--------|-------------|--------------|--------|
| Benny Yasoto | `bennyasoto.com` | `bennyasoto.com/` | bennyasoto.com |
| Prisss | `Prisss` | `Prisss/` | prisss.com |
| Edomite | `Edomite.club` | `Edomite.club/` | edomite.club |
| Kamaleonica | `kamaleonica.com` | `kamaleonica.com/` | kamaleonica.com |
| Nahuel | `Nahuel.club` | `Nahuel.club/` | nahuel.club |
| Amoro | `Amoro` | `Amoro/` | amoro.club |
| Foreverness | `Foreverness` | `Foreverness/` | foreverness.club |
| DJ Hoppi | `DjHoppi.club` | `DjHoppi.club/` | djhoppi.club |
| Breaking Robots | `BreakingRobots-main` | `BreakingRobots-main/` | breakingrobots.com |

## Label & shared core

| Project | GitHub repo | Local folder |
|---------|-------------|--------------|
| Glue Records (label site) | `GlueRecords` | `GlueRecords/` |
| Shared architecture | `Dedalo101-Core` | `Dedalo101-Core/` |

## New artist checklist

1. Create GitHub repo `Dedalo101/<name>` (repo name = domain or artist slug).
2. Clone into `DEDALO101 SITES/<name>/` — **no nested subfolders**, no `Artist.club/Artist/`.
3. Add row to this table.
4. Never keep duplicate paths (`yasoto/bennyasoto.com`, `Prisss/Prisss`, `Amoro.club/Amoro`, etc.).

## Stale / archived paths (do not use)

Moved or superseded — kept under `_archive/` or old names for reference only:

- `yasoto/` — bennyasoto moved to `bennyasoto.com/`
- `Amoro.club/` — repo moved to `Amoro/` (Priv/ notes may remain)
- `DjHoppy/` — renamed to `DjHoppi.club/`
- `Nahuel2.club-main/` — zip extract; use `Nahuel.club/`
- `Foreverness.com/` — wrong remote/content; use `Foreverness/`
- `GlueRecords-local-backup/` — pre-clone copy before official `GlueRecords/` clone
- `Glue Records/` — duplicate label folder (space in name)