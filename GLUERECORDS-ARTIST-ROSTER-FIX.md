# GlueRecords.club Roster Fix: Foreverness → Edomite

## Issue
The Glue Records label site (https://github.com/Dedalo101/GlueRecords serving https://gluerecords.club) was still featuring the artist "Foreverness" (with a dedicated heavy canvas effect + 300KB+ base64 image embedded in index.html) and linking to https://foreverness.club.

Edomite (a current Glue Records resident artist with https://edomite.club) was listed only in the README table (with incorrect genre) but **not present** in the live served site (grid, structured data, meta descriptions, hidden SEO content).

## Changes Made
- Replaced Foreverness tile in the visual artist grid with Edomite tile (links to https://edomite.club, sub "Red Land · Dust · Bass").
- Replaced the Foreverness entry in the JSON-LD `member` array with proper Edomite MusicGroup (correct genres).
- Updated all meta descriptions, keywords, og:description, twitter:description that enumerated the roster (removed Foreverness, inserted Edomite in logical position).
- Replaced the hidden (SEO-only) `<article>` for Foreverness with one for Edomite.
- **Removed the entire giant Foreverness canvas effect** (comment + ~328KB IIFE containing the full embedded jpeg base64 of the baroque anatomical image). This was the source of bloat.
- Inserted a new lightweight, on-theme canvas effect for the Edomite tile:
  - Dark desert (#060302) field.
  - Rust/sand floating particles with attraction to hover + global pointer (re-uses the page PTR).
  - Subtle scanlines + pulsing central "signal/star" glyph in rust.
  - Responsive, uses the shared `fitTile` / `tileW` helpers.
- Updated the table in README.md: removed Foreverness row, added/ corrected Edomite with accurate genre "Techno · Underground · Desert Bass", cleaned other genres for consistency.
- (The physical `foreverness.jpg` asset in the repo is now unused and can be deleted in a follow-up commit.)

## Result
- `gluerecords.club` now correctly surfaces **edomite.club** in the roster instead of foreverness.club.
- Page weight dropped dramatically (~392KB → ~67KB).
- Edomite tile is interactive and fits the atmospheric Glue aesthetic while nodding at Edomite's own desert/particle visual language.
- Structured data, SEO text, and all copy are in sync.
- Foreverness still has its own dedicated site (Dedalo101/Foreverness) if needed for archive.

## Files in this workspace (apply to GlueRecords repo)
- `gluerecords-fixed-index.html` — drop-in replacement for `index.html`
- `gluerecords-fixed-README.md` — updated README
- This document

## How to apply
1. In a clone of https://github.com/Dedalo101/GlueRecords :
   - Replace `index.html` with the content of `gluerecords-fixed-index.html`
   - Replace `README.md` with the content of `gluerecords-fixed-README.md`
   - `git rm foreverness.jpg` (optional but recommended — it is no longer referenced)
   - Commit: `git commit -m "chore(roster): replace Foreverness with Edomite (remove heavy asset+effect, update grid + metadata + README)"`
   - Push. GitHub Pages (or whatever serves the root index.html) will update.

2. Optionally submit updated sitemap in GSC if you want faster re-crawl.

3. Test: the 8th tile should now be Edomite, clicking it goes to edomite.club, no console errors, particles react to mouse on that tile.

## Verification (local)
- No remaining "foreverness" strings in the served index.html
- Edomite appears in meta, JSON-LD, grid HTML, hidden articles, and canvas init
- New Edomite effect block is small and self-contained
- File size reduced by > 5x

Per AGENTS.md (both Core and the one in GlueRecords): performance-obsessed, consistent roster truth, easy artist onboarding.

If you want a different visual treatment for the Edomite tile (e.g. more glitch/scanline heavy like the full edomite.club site, or using the star motif), provide reference and I can iterate the canvas code.
