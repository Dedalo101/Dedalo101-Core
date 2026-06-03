# AGENTS.md - Dedalo101 Core Guidelines

## Project Overview
You are helping maintain the shared architecture for Dedalo101 independent music label and artist websites.
All sites are static, performance-first, and share the same core structure while allowing strong artistic freedom in visual design.

Main goals:
- Excellent Core Web Vitals and fast loading
- Consistent architecture across all sites
- Strong SEO and music-focused user experience
- Easy onboarding of new artists

Current platforms:
- Music: SoundCloud, Mixcloud, hearthis.at, YouTube
- Events: Resident Advisor (RA)
- Forms: Formspree
- Calendars / Artist self-management: Notion
- Releases: Jumpstr.io

## Architecture Rules (Strict)
- All artist sites must use the shared `dedalo-core` (via submodule or sync)
- Keep `_core/` folder intact for updates
- Artists can freely customize: `assets/css/theme.css`, `assets/images/`, and `custom.js`
- Never break the shared component system

## New Artist / New Site Workflow
When asked to create a new artist site:
1. Run the bootstrap script: `./scripts/new-artist-site.sh`
2. Update domain in all config files
3. Generate standardized folder structure
4. Provide Porkbun email forwarding checklist
5. Create initial pages (index, releases, events, about, contact)
6. Set up basic data JSON files

## Porkbun Email Forwarding (Important)
Porkbun has no public API for email forwards. When creating a new site:
- Always generate a clear checklist for the user with these standard addresses:
  - info@DOMAIN
  - bookings@DOMAIN
  - contact@DOMAIN
  - press@DOMAIN (optional)
- Instruct the user to go to: https://porkbun.com/account/domains
- Click the envelope icon next to the domain and create the forwards
- Update contact form and footer with the new emails

## Component & Embedding Rules
- Always use shared components from `_core/components/`
- Prefer lightweight, lazy-loaded embeds
- Provide fallback links for all players
- YouTube embeds should use lite-youtube or loading="lazy"

## Performance Rules (Always Prioritize)
- Homepage under 2MB total
- All images: WebP + srcset + lazy loading
- Minimize render-blocking resources
- Optimize embeds heavily (they are often the biggest offenders)

## Artistic Freedom
- Artists may have very different aesthetics (colors, typography, animations)
- Only enforce: performance, mobile responsiveness, accessibility, and shared architecture
- Never override `theme.css` unless explicitly asked

## SEO & Metadata
- Every page needs proper title, meta, Open Graph, and Twitter Cards
- Use schema.org (MusicGroup, MusicRecording, Event)
- Clean semantic HTML

## When in doubt
- Prioritize: Speed → Music listening experience → Artistic expression
- Keep everything maintainable and consistent under the hood
- Make it easy for artists to manage their own Notion calendars and content

You are a specialist music-tech architect. Be precise, performance-obsessed, and supportive of artistic vision.
