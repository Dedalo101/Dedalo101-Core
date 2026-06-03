/**
 * Dedalo101 Artist Dashboard
 * PocketBase-backed CRUD for events & releases.
 *
 * Error handling: maps PocketBase ClientResponseError, network failures, and
 * validation issues to user-visible toasts + inline form errors.
 */
(function () {
  "use strict";

  const PB_URL = (window.DEDALO_PB_URL || "").replace(/\/$/, "");
  if (!PB_URL) {
    console.error("[Dedalo Dashboard] DEDALO_PB_URL is not set.");
  }

  const pb = new PocketBase(PB_URL);

  /** @type {import('pocketbase').RecordModel | null} */
  let currentArtist = null;
  let eventsCache = [];
  let releasesCache = [];
  /** @type {{ type: 'event'|'release', id: string } | null} */
  let deleteTarget = null;

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  // ─── Utilities ───────────────────────────────────────────────────────────

  /**
   * Normalize PocketBase / fetch errors into a human-readable string.
   * @param {unknown} err
   * @returns {string}
   */
  function getErrorMessage(err) {
    if (!err) return "An unknown error occurred.";
    if (typeof err === "string") return err;

    // PocketBase ClientResponseError
    if (err.data && typeof err.data === "object") {
      const fieldErrors = [];
      for (const [field, msg] of Object.entries(err.data)) {
        if (field === "message") continue;
        fieldErrors.push(`${field}: ${msg}`);
      }
      if (fieldErrors.length) return fieldErrors.join(" · ");
    }
    if (err.message) {
      if (err.status === 0 || /fetch|network/i.test(err.message)) {
        return "Network error — check your connection and PocketBase URL.";
      }
      if (err.status === 400) return err.message || "Invalid request.";
      if (err.status === 401) return "Session expired. Please sign in again.";
      if (err.status === 403) return "You do not have permission for this action.";
      if (err.status === 404) return "Record not found. It may have been deleted.";
      return err.message;
    }
    return "Something went wrong. Please try again.";
  }

  /**
   * @param {string} message
   * @param {'success'|'error'|'info'} [type]
   */
  function showToast(message, type = "success") {
    const root = $("#toast-root");
    const el = document.createElement("div");
    const styles = {
      success: "border-dedalo-success/40 bg-dedalo-success/10 text-dedalo-success",
      error: "border-dedalo-danger/40 bg-dedalo-danger/10 text-dedalo-danger",
      info: "border-dedalo-accent/40 bg-dedalo-accent/10 text-gray-200",
    };
    el.className = `pointer-events-auto rounded-lg border px-4 py-3 text-sm shadow-lg ${styles[type] || styles.info}`;
    el.setAttribute("role", type === "error" ? "alert" : "status");
    el.textContent = message;
    root.appendChild(el);
    setTimeout(() => {
      el.classList.add("opacity-0", "transition", "duration-300");
      setTimeout(() => el.remove(), 300);
    }, 4500);
  }

  /**
   * @param {boolean} show
   * @param {string} [message]
   */
  function setGlobalLoading(show, message = "Loading…") {
    const loader = $("#global-loader");
    $("#loader-message").textContent = message;
    loader.classList.toggle("hidden", !show);
  }

  /**
   * @param {HTMLElement|null} el
   * @param {boolean} busy
   */
  function setBusy(el, busy) {
    if (!el) return;
    el.setAttribute("aria-busy", busy ? "true" : "false");
    if (el.tagName === "BUTTON") el.disabled = busy;
  }

  function showInlineError(elId, message) {
    const el = document.getElementById(elId);
    if (!el) return;
    if (message) {
      el.textContent = message;
      el.classList.remove("hidden");
    } else {
      el.textContent = "";
      el.classList.add("hidden");
    }
  }

  function showView(name) {
    $("#view-login").classList.toggle("hidden", name !== "login");
    $("#view-dashboard").classList.toggle("hidden", name !== "dashboard");
  }

  function openModal(id) {
    document.getElementById(id)?.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }

  function closeModal(id) {
    document.getElementById(id)?.classList.add("hidden");
    if (!document.querySelector('.fixed.inset-0:not(.hidden)[id^="modal-"]')) {
      document.body.style.overflow = "";
    }
  }

  function slugify(text) {
    return String(text || "")
      .toLowerCase()
      .trim()
      .replace(/[^\w\s-]/g, "")
      .replace(/\s+/g, "-")
      .replace(/-+/g, "-")
      .slice(0, 120);
  }

  function formatDate(iso) {
    if (!iso) return "—";
    try {
      return new Date(iso).toLocaleDateString(undefined, {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return iso;
    }
  }

  function escapeHtml(str) {
    const d = document.createElement("div");
    d.textContent = str ?? "";
    return d.innerHTML;
  }

  // ─── Auth ──────────────────────────────────────────────────────────────────

  async function restoreSession() {
    if (!pb.authStore.isValid) return false;
    try {
      setGlobalLoading(true, "Restoring session…");
      const result = await pb.collection("artists").authRefresh();
      currentArtist = result.record;
      return true;
    } catch (err) {
      console.warn("[Dedalo Dashboard] Session restore failed:", err);
      pb.authStore.clear();
      return false;
    } finally {
      setGlobalLoading(false);
    }
  }

  async function handleLogin(e) {
    e.preventDefault();
    showInlineError("login-error", "");
    const email = $("#login-email").value.trim();
    const password = $("#login-password").value;

    if (!email || !password) {
      showInlineError("login-error", "Email and password are required.");
      return;
    }

    const btn = $("#btn-login");
    setBusy(btn, true);
    try {
      const auth = await pb.collection("artists").authWithPassword(email, password);
      currentArtist = auth.record;
      showView("dashboard");
      updateHeader();
      await loadAll({ silent: false });
      showToast("Signed in successfully");
    } catch (err) {
      console.error("[Dedalo Dashboard] Login failed:", err);
      const msg = getErrorMessage(err);
      showInlineError("login-error", msg);
      showToast(msg, "error");
    } finally {
      setBusy(btn, false);
    }
  }

  function handleLogout() {
    pb.authStore.clear();
    currentArtist = null;
    eventsCache = [];
    releasesCache = [];
    showView("login");
    $("#form-login").reset();
    showInlineError("login-error", "");
    showToast("Signed out", "info");
  }

  function handleAuthError(err) {
    if (err?.status === 401) {
      showToast("Session expired. Please sign in again.", "error");
      handleLogout();
      return true;
    }
    return false;
  }

  function updateHeader() {
    $("#header-artist-name").textContent = currentArtist?.display_name || "Dashboard";
    $("#header-artist-email").textContent = currentArtist?.email || "";
  }

  // ─── Stats ─────────────────────────────────────────────────────────────────

  function updateStats() {
    const eventsPub = eventsCache.filter((e) => e.published).length;
    const relPub = releasesCache.filter((r) => r.published).length;
    $("#stat-events-total").textContent = String(eventsCache.length);
    $("#stat-events-published").textContent = String(eventsPub);
    $("#stat-releases-total").textContent = String(releasesCache.length);
    $("#stat-releases-published").textContent = String(relPub);
  }

  // ─── Data loading ──────────────────────────────────────────────────────────

  async function loadEvents() {
    const list = $("#events-list");
    list.innerHTML = `
      <div class="flex items-center justify-center gap-2 rounded-xl border border-dedalo-border bg-dedalo-card py-12 text-sm text-dedalo-muted">
        <svg class="h-5 w-5 animate-spin text-dedalo-accent" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
        Loading events…
      </div>`;
    try {
      eventsCache = await pb.collection("events").getFullList({
        filter: `artist = "${currentArtist.id}"`,
        sort: "-date_start",
      });
      renderEvents();
      updateStats();
    } catch (err) {
      if (handleAuthError(err)) return;
      console.error("[Dedalo Dashboard] loadEvents:", err);
      const msg = getErrorMessage(err);
      list.innerHTML = `<div class="rounded-xl border border-dedalo-danger/30 bg-dedalo-danger/5 p-6 text-center text-sm text-dedalo-danger">${escapeHtml(msg)}</div>`;
      showToast(msg, "error");
    }
  }

  async function loadReleases() {
    const list = $("#releases-list");
    list.innerHTML = `
      <div class="flex items-center justify-center gap-2 rounded-xl border border-dedalo-border bg-dedalo-card py-12 text-sm text-dedalo-muted">
        <svg class="h-5 w-5 animate-spin text-dedalo-accent" fill="none" viewBox="0 0 24 24"><circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"/><path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>
        Loading releases…
      </div>`;
    try {
      releasesCache = await pb.collection("releases").getFullList({
        filter: `artist = "${currentArtist.id}"`,
        sort: "-release_date",
      });
      renderReleases();
      updateStats();
    } catch (err) {
      if (handleAuthError(err)) return;
      console.error("[Dedalo Dashboard] loadReleases:", err);
      const msg = getErrorMessage(err);
      list.innerHTML = `<div class="rounded-xl border border-dedalo-danger/30 bg-dedalo-danger/5 p-6 text-center text-sm text-dedalo-danger">${escapeHtml(msg)}</div>`;
      showToast(msg, "error");
    }
  }

  /**
   * @param {{ silent?: boolean }} [opts]
   */
  async function loadAll(opts = {}) {
    if (!opts.silent) setGlobalLoading(true, "Refreshing data…");
    try {
      await Promise.all([loadEvents(), loadReleases()]);
      if (!opts.silent) showToast("Data refreshed", "info");
    } finally {
      if (!opts.silent) setGlobalLoading(false);
    }
  }

  // ─── Render lists ────────────────────────────────────────────────────────────

  function renderEvents() {
    const list = $("#events-list");
    if (!eventsCache.length) {
      list.innerHTML = `
        <div class="rounded-xl border border-dashed border-dedalo-border bg-dedalo-card/50 py-12 text-center">
          <p class="text-dedalo-muted">No events yet.</p>
          <button type="button" id="empty-new-event" class="mt-4 rounded-lg bg-dedalo-accent px-4 py-2 text-sm font-medium text-white hover:bg-dedalo-accent-hover">Add your first event</button>
        </div>`;
      $("#empty-new-event")?.addEventListener("click", () => openEventModal());
      return;
    }
    list.innerHTML = eventsCache
      .map((ev) => {
        const loc = [ev.venue, ev.city, ev.country].filter(Boolean).join(" · ");
        const badge = ev.published
          ? '<span class="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-dedalo-success/15 text-dedalo-success">Published</span>'
          : '<span class="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-white/10 text-dedalo-muted">Draft</span>';
        return `
          <article class="flex flex-wrap items-start justify-between gap-4 rounded-xl border ${ev.published ? "border-dedalo-border" : "border-dashed border-dedalo-border/80"} bg-dedalo-card p-4">
            <div class="min-w-[200px] flex-1">
              <h3 class="flex flex-wrap items-center gap-2 font-semibold">${escapeHtml(ev.title)} ${badge}</h3>
              <p class="mt-1 text-sm text-dedalo-muted">${formatDate(ev.date_start)}${loc ? " · " + escapeHtml(loc) : ""}</p>
            </div>
            <div class="flex gap-2">
              <button type="button" class="rounded-lg border border-dedalo-border px-3 py-1.5 text-xs hover:text-white" data-action="edit-event" data-id="${ev.id}">Edit</button>
              <button type="button" class="rounded-lg bg-dedalo-danger/15 px-3 py-1.5 text-xs text-dedalo-danger hover:bg-dedalo-danger/25" data-action="delete-event" data-id="${ev.id}">Delete</button>
            </div>
          </article>`;
      })
      .join("");
  }

  function renderReleases() {
    const list = $("#releases-list");
    if (!releasesCache.length) {
      list.innerHTML = `
        <div class="rounded-xl border border-dashed border-dedalo-border bg-dedalo-card/50 py-12 text-center">
          <p class="text-dedalo-muted">No releases yet.</p>
          <button type="button" id="empty-new-release" class="mt-4 rounded-lg bg-dedalo-accent px-4 py-2 text-sm font-medium text-white hover:bg-dedalo-accent-hover">Add your first release</button>
        </div>`;
      $("#empty-new-release")?.addEventListener("click", () => openReleaseModal());
      return;
    }
    list.innerHTML = releasesCache
      .map((rel) => {
        const badge = rel.published
          ? '<span class="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-dedalo-success/15 text-dedalo-success">Published</span>'
          : '<span class="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide bg-white/10 text-dedalo-muted">Draft</span>';
        const meta = [rel.format, rel.label].filter(Boolean).join(" · ");
        return `
          <article class="flex flex-wrap items-start justify-between gap-4 rounded-xl border ${rel.published ? "border-dedalo-border" : "border-dashed border-dedalo-border/80"} bg-dedalo-card p-4">
            <div class="min-w-[200px] flex-1">
              <h3 class="flex flex-wrap items-center gap-2 font-semibold">${escapeHtml(rel.title)} ${badge}</h3>
              <p class="mt-1 text-sm text-dedalo-muted">${formatDate(rel.release_date)}${meta ? " · " + escapeHtml(meta) : ""} · /${escapeHtml(rel.slug)}</p>
            </div>
            <div class="flex gap-2">
              <button type="button" class="rounded-lg border border-dedalo-border px-3 py-1.5 text-xs hover:text-white" data-action="edit-release" data-id="${rel.id}">Edit</button>
              <button type="button" class="rounded-lg bg-dedalo-danger/15 px-3 py-1.5 text-xs text-dedalo-danger hover:bg-dedalo-danger/25" data-action="delete-release" data-id="${rel.id}">Delete</button>
            </div>
          </article>`;
      })
      .join("");
  }

  // ─── Modals ────────────────────────────────────────────────────────────────

  function openEventModal(record = null) {
    showInlineError("event-form-error", "");
    $("#modal-event-title").textContent = record ? "Edit event" : "New event";
    $("#event-id").value = record?.id || "";
    $("#event-title").value = record?.title || "";
    $("#event-venue").value = record?.venue || "";
    $("#event-city").value = record?.city || "";
    $("#event-country").value = record?.country || "";
    $("#event-date-start").value = record?.date_start?.slice(0, 10) || "";
    $("#event-date-end").value = record?.date_end?.slice(0, 10) || "";
    $("#event-ticket-url").value = record?.ticket_url || "";
    $("#event-description").value = record?.description || "";
    $("#event-published").checked = !!record?.published;
    openModal("modal-event");
  }

  function openReleaseModal(record = null) {
    showInlineError("release-form-error", "");
    $("#modal-release-title").textContent = record ? "Edit release" : "New release";
    $("#release-id").value = record?.id || "";
    $("#release-title").value = record?.title || "";
    $("#release-slug").value = record?.slug || "";
    $("#release-slug").dataset.touched = record ? "1" : "";
    $("#release-date").value = record?.release_date?.slice(0, 10) || "";
    $("#release-format").value = record?.format || "";
    $("#release-label").value = record?.label || "";
    $("#release-catalog").value = record?.catalog_number || "";
    $("#release-stream-url").value = record?.stream_url || "";
    $("#release-buy-url").value = record?.buy_url || "";
    $("#release-description").value = record?.description || "";
    $("#release-published").checked = !!record?.published;
    openModal("modal-release");
  }

  function promptDelete(type, id, title) {
    deleteTarget = { type, id };
    showInlineError("delete-error", "");
    $("#delete-message").textContent = `Delete "${title}"? This cannot be undone.`;
    openModal("modal-delete");
  }

  // ─── CRUD ──────────────────────────────────────────────────────────────────

  async function saveEvent(e) {
    e.preventDefault();
    showInlineError("event-form-error", "");
    const btn = $("#btn-save-event");
    const id = $("#event-id").value;
    const title = $("#event-title").value.trim();
    const dateStart = $("#event-date-start").value;

    if (!title) {
      showInlineError("event-form-error", "Title is required.");
      return;
    }
    if (!dateStart) {
      showInlineError("event-form-error", "Start date is required.");
      return;
    }

    const body = {
      artist: currentArtist.id,
      title,
      venue: $("#event-venue").value.trim(),
      city: $("#event-city").value.trim(),
      country: $("#event-country").value.trim(),
      date_start: dateStart,
      date_end: $("#event-date-end").value || "",
      ticket_url: $("#event-ticket-url").value.trim(),
      description: $("#event-description").value.trim(),
      published: $("#event-published").checked,
    };

    setBusy(btn, true);
    try {
      if (id) {
        await pb.collection("events").update(id, body);
        showToast("Event updated");
      } else {
        await pb.collection("events").create(body);
        showToast("Event created");
      }
      closeModal("modal-event");
      await loadAll({ silent: true });
    } catch (err) {
      if (handleAuthError(err)) return;
      console.error("[Dedalo Dashboard] saveEvent:", err);
      const msg = getErrorMessage(err);
      showInlineError("event-form-error", msg);
      showToast(msg, "error");
    } finally {
      setBusy(btn, false);
    }
  }

  async function saveRelease(e) {
    e.preventDefault();
    showInlineError("release-form-error", "");
    const btn = $("#btn-save-release");
    const id = $("#release-id").value;
    const title = $("#release-title").value.trim();
    const slug = $("#release-slug").value.trim();
    const releaseDate = $("#release-date").value;

    if (!title) {
      showInlineError("release-form-error", "Title is required.");
      return;
    }
    if (!slug || !/^[a-z0-9-]+$/.test(slug)) {
      showInlineError("release-form-error", "Slug must be lowercase letters, numbers, and hyphens only.");
      return;
    }
    if (!releaseDate) {
      showInlineError("release-form-error", "Release date is required.");
      return;
    }

    const body = {
      artist: currentArtist.id,
      title,
      slug,
      release_date: releaseDate,
      format: $("#release-format").value || "",
      label: $("#release-label").value.trim(),
      catalog_number: $("#release-catalog").value.trim(),
      stream_url: $("#release-stream-url").value.trim(),
      buy_url: $("#release-buy-url").value.trim(),
      description: $("#release-description").value.trim(),
      published: $("#release-published").checked,
    };

    setBusy(btn, true);
    try {
      if (id) {
        await pb.collection("releases").update(id, body);
        showToast("Release updated");
      } else {
        await pb.collection("releases").create(body);
        showToast("Release created");
      }
      closeModal("modal-release");
      await loadAll({ silent: true });
    } catch (err) {
      if (handleAuthError(err)) return;
      console.error("[Dedalo Dashboard] saveRelease:", err);
      const msg = getErrorMessage(err);
      showInlineError("release-form-error", msg);
      showToast(msg, "error");
    } finally {
      setBusy(btn, false);
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return;
    const btn = $("#btn-confirm-delete");
    const { type, id } = deleteTarget;
    const collection = type === "event" ? "events" : "releases";
    setBusy(btn, true);
    showInlineError("delete-error", "");
    try {
      await pb.collection(collection).delete(id);
      showToast("Deleted successfully");
      closeModal("modal-delete");
      deleteTarget = null;
      await loadAll({ silent: true });
    } catch (err) {
      if (handleAuthError(err)) return;
      console.error("[Dedalo Dashboard] confirmDelete:", err);
      const msg = getErrorMessage(err);
      showInlineError("delete-error", msg);
      showToast(msg, "error");
    } finally {
      setBusy(btn, false);
    }
  }

  // ─── UI bindings ───────────────────────────────────────────────────────────

  function switchTab(tabName) {
    $$(".tab-btn").forEach((t) => {
      const active = t.dataset.tab === tabName;
      t.setAttribute("aria-selected", active ? "true" : "false");
      t.classList.toggle("text-white", active);
      t.classList.toggle("bg-dedalo-card", active);
      t.classList.toggle("shadow", active);
      t.classList.toggle("text-dedalo-muted", !active);
    });
    $("#panel-events").classList.toggle("hidden", tabName !== "events");
    $("#panel-releases").classList.toggle("hidden", tabName !== "releases");
  }

  function bindUi() {
    $("#form-login").addEventListener("submit", handleLogin);
    $("#btn-logout").addEventListener("click", handleLogout);
    $("#btn-refresh").addEventListener("click", () => loadAll({ silent: false }));
    $("#btn-new-event").addEventListener("click", () => openEventModal());
    $("#btn-new-release").addEventListener("click", () => openReleaseModal());
    $("#form-event").addEventListener("submit", saveEvent);
    $("#form-release").addEventListener("submit", saveRelease);
    $("#btn-confirm-delete").addEventListener("click", confirmDelete);

    $("#release-title").addEventListener("input", (e) => {
      const slugField = $("#release-slug");
      if (!slugField.dataset.touched) slugField.value = slugify(e.target.value);
    });
    $("#release-slug").addEventListener("input", () => {
      $("#release-slug").dataset.touched = "1";
    });

    $$(".tab-btn").forEach((tab) => {
      tab.addEventListener("click", () => switchTab(tab.dataset.tab));
    });

    document.body.addEventListener("click", (e) => {
      const closeId = e.target.closest("[data-close]")?.dataset.close;
      if (closeId) closeModal(closeId);
      if (e.target.classList.contains("fixed") && e.target.id?.startsWith("modal-")) {
        closeModal(e.target.id);
      }

      const editEv = e.target.closest('[data-action="edit-event"]');
      if (editEv) {
        const rec = eventsCache.find((x) => x.id === editEv.dataset.id);
        if (rec) openEventModal(rec);
      }
      const delEv = e.target.closest('[data-action="delete-event"]');
      if (delEv) {
        const rec = eventsCache.find((x) => x.id === delEv.dataset.id);
        if (rec) promptDelete("event", rec.id, rec.title);
      }
      const editRel = e.target.closest('[data-action="edit-release"]');
      if (editRel) {
        const rec = releasesCache.find((x) => x.id === editRel.dataset.id);
        if (rec) openReleaseModal(rec);
      }
      const delRel = e.target.closest('[data-action="delete-release"]');
      if (delRel) {
        const rec = releasesCache.find((x) => x.id === delRel.dataset.id);
        if (rec) promptDelete("release", rec.id, rec.title);
      }
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        ["modal-event", "modal-release", "modal-delete"].forEach((id) => {
          if (!document.getElementById(id)?.classList.contains("hidden")) closeModal(id);
        });
      }
    });
  }

  async function init() {
    bindUi();
    if (await restoreSession()) {
      showView("dashboard");
      updateHeader();
      await loadAll({ silent: true });
    } else {
      showView("login");
    }
  }

  init().catch((err) => {
    console.error("[Dedalo Dashboard] Init failed:", err);
    showToast(getErrorMessage(err), "error");
  });
})();