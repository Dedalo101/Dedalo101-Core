/**
 * Dedalo101 PocketBase client for static artist sites.
 * Read-only helpers with retry logic and structured errors.
 *
 * @example
 * const client = DedaloPB.create({ url: 'https://pb.dedalo101.com', artistSlug: 'my-artist' });
 * const data = await client.getSiteData();
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.DedaloPB = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : window, function () {
  "use strict";

  const DEFAULT_PAGE_SIZE = 50;
  const DEFAULT_RETRIES = 3;
  const DEFAULT_RETRY_DELAY_MS = 800;

  /**
   * @param {unknown} err
   * @returns {string}
   */
  function normalizeError(err) {
    if (!err) return "Unknown error";
    if (typeof err === "string") return err;
    if (err.message) {
      if (err.status === 0 || /failed to fetch|network/i.test(err.message)) {
        return "Network error — could not reach PocketBase.";
      }
      return err.message;
    }
    return "Request failed";
  }

  /**
   * Sleep helper for retries.
   * @param {number} ms
   */
  function delay(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * @param {() => Promise<T>} fn
   * @param {{ retries?: number, delayMs?: number }} [opts]
   * @returns {Promise<T>}
   * @template T
   */
  async function withRetry(fn, opts = {}) {
    const retries = opts.retries ?? DEFAULT_RETRIES;
    const delayMs = opts.delayMs ?? DEFAULT_RETRY_DELAY_MS;
    let lastError;

    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        return await fn();
      } catch (err) {
        lastError = err;
        const retryable =
          !err?.status ||
          err.status === 0 ||
          err.status >= 500 ||
          err.status === 429;

        console.warn(`[DedaloPB] Attempt ${attempt}/${retries} failed:`, normalizeError(err));

        if (!retryable || attempt === retries) break;
        await delay(delayMs * attempt);
      }
    }

    const message = normalizeError(lastError);
    const wrapped = new Error(message);
    wrapped.cause = lastError;
    throw wrapped;
  }

  function getConfig(overrides) {
    const cfg = typeof window !== "undefined" && window.DEDALO_CONFIG ? window.DEDALO_CONFIG : {};
    return {
      url: (overrides?.url || cfg.pocketbaseUrl || "").replace(/\/$/, ""),
      artistSlug: overrides?.artistSlug || cfg.artistSlug || "",
      artistId: overrides?.artistId || cfg.artistId || "",
      retries: overrides?.retries ?? cfg.retries ?? DEFAULT_RETRIES,
    };
  }

  function buildFilter(parts) {
    return parts.filter(Boolean).join(" && ");
  }

  /**
   * Low-level GET with retry.
   * @param {string} baseUrl
   * @param {string} path
   * @param {Record<string, string>} [params]
   * @param {number} retries
   */
  async function apiGet(baseUrl, path, params = {}, retries = DEFAULT_RETRIES) {
    return withRetry(
      async () => {
        const url = new URL(baseUrl + "/api" + path);
        Object.entries(params).forEach(([k, v]) => {
          if (v != null && v !== "") url.searchParams.set(k, v);
        });

        let res;
        try {
          res = await fetch(url.toString(), { headers: { Accept: "application/json" } });
        } catch (err) {
          err.status = 0;
          throw err;
        }

        if (!res.ok) {
          let msg = `PocketBase error (${res.status})`;
          try {
            const body = await res.json();
            if (body.message) msg = body.message;
          } catch (_) {}
          const e = new Error(msg);
          e.status = res.status;
          throw e;
        }
        return res.json();
      },
      { retries }
    );
  }

  /**
   * Paginate through all records.
   */
  async function getAllPages(baseUrl, collection, options) {
    const items = [];
    let page = 1;
    let totalPages = 1;
    const retries = options.retries ?? DEFAULT_RETRIES;

    while (page <= totalPages) {
      const data = await apiGet(
        baseUrl,
        `/collections/${collection}/records`,
        {
          page: String(page),
          perPage: String(options.perPage || DEFAULT_PAGE_SIZE),
          filter: options.filter || "",
          sort: options.sort || "",
          expand: options.expand || "",
          fields: options.fields || "",
        },
        retries
      );
      items.push(...(data.items || []));
      totalPages = data.totalPages || 1;
      page += 1;
    }
    return items;
  }

  function fileUrl(baseUrl, record, field) {
    const name = record?.[field];
    if (!name || !record?.id) return null;
    const coll = record.collectionId || record.collectionName;
    return `${baseUrl}/api/files/${coll}/${record.id}/${name}`;
  }

  function escapeFilterValue(value) {
    return String(value).replace(/\\/g, "\\\\").replace(/"/g, '\\"');
  }

  /**
   * @param {object} [options]
   */
  function create(options = {}) {
    const config = getConfig(options);
    const { url, artistSlug, retries } = config;

    if (!url) {
      throw new Error("DedaloPB: pocketbaseUrl is required (DEDALO_CONFIG or create({ url }))");
    }

    let artistIdCache = config.artistId || null;

    async function resolveArtistId() {
      if (artistIdCache) return artistIdCache;
      const slug = options.artistSlug || artistSlug;
      if (!slug) throw new Error("DedaloPB: artistSlug or artistId is required");

      const data = await apiGet(
        url,
        "/collections/artists/records",
        { filter: `slug = "${escapeFilterValue(slug)}"`, perPage: "1" },
        retries
      );
      const artist = data.items?.[0];
      if (!artist) throw new Error(`DedaloPB: no artist found for slug "${slug}"`);
      artistIdCache = artist.id;
      return artistIdCache;
    }

    async function getArtist() {
      const id = await resolveArtistId();
      return apiGet(url, `/collections/artists/records/${id}`, {}, retries);
    }

    async function getPublishedReleases(opts = {}) {
      const artistId = await resolveArtistId();
      const filter = buildFilter([
        `artist = "${artistId}"`,
        "published = true",
        opts.format ? `format = "${escapeFilterValue(opts.format)}"` : "",
      ]);
      const records = await getAllPages(url, "releases", {
        filter,
        sort: opts.sort || "-release_date,sort_order",
        retries,
      });
      return records.map((r) => ({ ...r, coverUrl: fileUrl(url, r, "cover") }));
    }

    async function getPublishedEvents(opts = {}) {
      const artistId = await resolveArtistId();
      const now = new Date().toISOString().slice(0, 10);
      const dateFilter =
        opts.upcoming === true
          ? `date_start >= "${now}"`
          : opts.past === true
            ? `date_start < "${now}"`
            : "";
      const filter = buildFilter([`artist = "${artistId}"`, "published = true", dateFilter]);
      const records = await getAllPages(url, "events", {
        filter,
        sort: opts.sort || (opts.past ? "-date_start" : "date_start"),
        retries,
      });
      return records.map((r) => ({ ...r, flyerUrl: fileUrl(url, r, "flyer") }));
    }

    async function getPublishedMixes(opts = {}) {
      const artistId = await resolveArtistId();
      const filter = buildFilter([`artist = "${artistId}"`, "published = true"]);
      const records = await getAllPages(url, "mixes", {
        filter,
        sort: opts.sort || "-published_at,sort_order",
        retries,
      });
      return records.map((r) => ({ ...r, coverUrl: fileUrl(url, r, "cover") }));
    }

    async function getReleaseBySlug(slug) {
      const artistId = await resolveArtistId();
      const data = await apiGet(
        url,
        "/collections/releases/records",
        {
          filter: buildFilter([
            `artist = "${artistId}"`,
            `slug = "${escapeFilterValue(slug)}"`,
            "published = true",
          ]),
          perPage: "1",
        },
        retries
      );
      const record = data.items?.[0];
      if (!record) return null;
      return { ...record, coverUrl: fileUrl(url, record, "cover") };
    }

    /** Full payload for static hydration / build pipelines */
    async function getSiteData(opts = {}) {
      try {
        const [artist, releases, events, mixes] = await Promise.all([
          getArtist(),
          getPublishedReleases(opts),
          getPublishedEvents({ upcoming: opts.upcomingEvents !== false, retries }),
          getPublishedMixes(opts),
        ]);
        return {
          generatedAt: new Date().toISOString(),
          artist: { ...artist, avatarUrl: fileUrl(url, artist, "avatar") },
          releases,
          events,
          mixes,
        };
      } catch (err) {
        console.error("[DedaloPB] getSiteData failed:", err);
        throw err;
      }
    }

    return {
      url,
      getArtist,
      getPublishedReleases,
      getPublishedEvents,
      getPublishedMixes,
      getReleaseBySlug,
      getSiteData,
      fileUrl: (record, field) => fileUrl(url, record, field),
      withRetry,
    };
  }

  return { create, apiGet, getAllPages, fileUrl, buildFilter, withRetry, normalizeError };
});