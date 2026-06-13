# Edomite.club Mobile Touch/Drag Fix

## Problem
On mobile, touching and dragging on the site caused the page/layout to shift or "move" (rubber-banding, viewport panning, or content translation even though it is a fixed no-scroll immersive experience).

## Root Cause
- `html, body { overflow: hidden; }` alone is not sufficient on all mobile browsers (esp. iOS Safari, some Android) to fully suppress pan/overscroll gestures on touch drag.
- No `touch-action` or `overscroll-behavior` declarations.
- The canvas + particle system uses `touchmove` (passive) for interaction, but defaults allowed browser to attempt scroll/pan.
- Viewport meta was basic.

## Changes Applied
In `index.html`:

1. **Viewport**: added `viewport-fit=cover` for full-screen fixed layouts on notched devices.

2. **CSS** (html, body):
   ```css
   overflow: hidden;
   overscroll-behavior: none;
   touch-action: none;
   ```

3. **CSS** (#bg-canvas):
   ```css
   touch-action: none;
   ```

4. **CSS** (interactive controls for good tap response without pan):
   ```css
   nav, .label-link, .orion-player, .orion-player *, button, a[href] {
     touch-action: manipulation;
   }
   #bookings-modal, #bookings-modal .modal-content, #bookings-modal iframe {
     touch-action: auto; /* allow iframe content scrolling */
   }
   ```

5. **JS**: added early touchmove preventer (mobile only, skips the #bookings-modal so RA events list remains scrollable inside iframe):
   ```js
   if ('ontouchstart' in window) {
     document.addEventListener('touchmove', e => {
       if (e.target.closest && e.target.closest('#bookings-modal')) return;
       e.preventDefault();
     }, { passive: false });
   }
   ```

## Files
- `edomite-fixed-index.html` — the complete fixed single-file site (drop-in replacement for index.html in the Edomite.club repo).
- This document for reference.

## How to Deploy
1. In your local clone of https://github.com/Dedalo101/Edomite.club replace `index.html` with the content of `edomite-fixed-index.html` (or apply the diffs above).
2. Commit + push.
3. (Optional) Test on real mobile: hard refresh, try dragging in main area (should feel completely locked; taps/Orion player/nav still work; open Bookings modal and verify the events list inside can still be scrolled).

## Notes (per AGENTS.md)
- Preserved performance (no new assets, CSS only + tiny JS guard).
- Accessibility: did not use user-scalable=no.
- The modal/iframe still works for touch scrolling.
- The canvas touch tracking for particles continues to work (events still fire; only the *default browser pan* is suppressed).

Tested via static verification of all locks present.
