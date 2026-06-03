# Dedalo101 Core — Zero-Cost Artist Management

Headless **PocketBase** backend on Oracle Cloud Always Free, **static** artist sites on GitHub Pages / Cloudflare, and a **Tailwind** artist dashboard for self-service content management.

## Architecture

```
Artist Dashboard (Tailwind + PocketBase SDK)
        │  HTTPS auth + CRUD
        ▼
PocketBase on Oracle ARM (pb.dedalo101.com)
        │  published records only
        ▼
GitHub Actions → build-static.js
        │  site-data.json + HTML fragments
        ▼
Static artist site (GitHub Pages / Cloudflare)
```

| Layer | Cost |
|-------|------|
| Oracle Always Free ARM | $0 |
| PocketBase (self-hosted) | $0 |
| GitHub Pages / Cloudflare Pages | $0 |
| GitHub Actions (free tier) | $0 |

---

## Folder structure

```
dedalo-core/
├── dashboard/
│   ├── artist-dashboard.html   # Tailwind UI
│   └── dashboard-app.js        # CRUD + error handling
├── js/
│   └── pocketbase-client.js    # Static site read helpers + retry
├── scripts/
│   └── build-static.js         # CI/local static generator
├── pocketbase/
│   └── pocketbase-collections.json
├── components/
│   └── config.example.js
├── README.md
└── AGENTS.md
```

---

## 1. Oracle Cloud — PocketBase installation

### Create the VM

1. Oracle Cloud → **Compute** → **Instances** → **Create**.
2. Shape: **Ampere** (Always Free), Ubuntu 22.04/24.04, public IPv4.
3. Ingress: **22** (SSH, restrict to your IP), **80**, **443**.

### Install PocketBase

```bash
ssh ubuntu@YOUR_VM_IP

PB_VERSION=0.22.0
wget "https://github.com/pocketbase/pocketbase/releases/download/v${PB_VERSION}/pocketbase_${PB_VERSION}_linux_arm64.zip"
unzip pocketbase_*_linux_arm64.zip
sudo mv pocketbase /usr/local/bin/
sudo mkdir -p /var/lib/pocketbase
sudo useradd -r -s /bin/false pocketbase 2>/dev/null || true
sudo chown -R pocketbase:pocketbase /var/lib/pocketbase
```

### systemd service

```bash
sudo tee /etc/systemd/system/pocketbase.service << 'EOF'
[Unit]
Description=PocketBase
After=network.target

[Service]
Type=simple
User=pocketbase
Group=pocketbase
WorkingDirectory=/var/lib/pocketbase
ExecStart=/usr/local/bin/pocketbase serve --http=127.0.0.1:8090 --dir=/var/lib/pocketbase/pb_data
Restart=on-failure
RestartSec=5
LimitNOFILE=4096

[Install]
WantedBy=multi-user.target
EOF

sudo systemctl daemon-reload
sudo systemctl enable --now pocketbase
```

Create superuser (once):

```bash
sudo -u pocketbase pocketbase superuser upsert admin@dedalo101.com 'STRONG_PASSWORD' \
  --dir=/var/lib/pocketbase/pb_data
```

### Nginx + SSL

```bash
sudo apt update && sudo apt install -y nginx certbot python3-certbot-nginx

sudo tee /etc/nginx/sites-available/pocketbase << 'EOF'
server {
    listen 80;
    server_name pb.dedalo101.com;

    location / {
        proxy_pass http://127.0.0.1:8090;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        client_max_body_size 20M;
    }
}
EOF

sudo ln -sf /etc/nginx/sites-available/pocketbase /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d pb.dedalo101.com
```

In PocketBase Admin → **Settings** → set **Application URL** to `https://pb.dedalo101.com`.

---

## 2. Import collections

File: `pocketbase/pocketbase-collections.json`

**Option A — Admin UI (recommended)**

1. Open `https://pb.dedalo101.com/_/`
2. **Settings** → **Import collections** (if available in your PB version), or create manually from the JSON.
3. Import order: **artists** (auth) → **releases** → **events** → **mixes**.
4. After creating `artists`, update relation fields so `collectionId` points to the real artists collection ID.

**Option B — Manual**

Use the JSON as reference for field names, types, indexes, and API rules.

### API rules summary

| Collection | Public read | Artist write |
|------------|-------------|--------------|
| artists | list public; view own | update own |
| releases, events, mixes | `published = true` | CRUD when `artist = @request.auth.id` |

---

## 3. Set up artist accounts

1. Admin → **artists** → **New record**.
2. Set **email**, **password**, **slug** (e.g. `glue-records`), **display_name**.
3. Send credentials to the artist securely (password manager / encrypted channel).
4. Artist opens `dashboard/artist-dashboard.html` (hosted on a private URL).
5. Set PocketBase URL:

```html
<script>window.DEDALO_PB_URL = "https://pb.dedalo101.com";</script>
```

6. Artist signs in and manages events/releases; toggles **Published** when ready for static sites.

---

## 4. Connect static sites

### A. Build-time JSON + HTML (recommended)

**GitHub repo secrets**

| Secret | Value |
|--------|--------|
| `POCKETBASE_URL` | `https://pb.dedalo101.com` |
| `POCKETBASE_TOKEN` | Admin or automation bearer token |

**GitHub repo variable**

| Variable | Example |
|----------|---------|
| `ARTIST_SLUGS` | `glue-records,breaking-robots` |

Workflow `.github/workflows/build-from-pocketbase.yml` writes:

```
data/{slug}/site-data.json
data/{slug}/events.fragment.html
data/{slug}/releases.fragment.html
data/{slug}/index.generated.html
```

**Consume on site:**

```html
<script>
  fetch('/data/my-slug/site-data.json')
    .then((r) => {
      if (!r.ok) throw new Error('Failed to load site data');
      return r.json();
    })
    .then((data) => {
      // render data.releases, data.events
    })
    .catch((err) => console.error('[Site]', err));
</script>
```

**Local build:**

```bash
POCKETBASE_URL=https://pb.dedalo101.com \
POCKETBASE_TOKEN=your_token \
ARTIST_SLUG=my-slug \
node dedalo-core/scripts/build-static.js
```

### B. Client-side (with retry)

```html
<script src="https://cdn.jsdelivr.net/npm/pocketbase@0.22.0/dist/pocketbase.umd.js"></script>
<script src="js/pocketbase-client.js"></script>
<script src="js/dedalo-config.js"></script>
<script>
  const client = DedaloPB.create();
  client.getSiteData()
    .then((data) => { /* render */ })
    .catch((err) => console.error(err));
</script>
```

Copy `components/config.example.js` → `js/dedalo-config.js`.

---

## 5. Security best practices

- **HTTPS only** — TLS at nginx; correct PocketBase app URL.
- **Dashboard** — host at non-indexed URL; `noindex` meta included; consider Cloudflare Access.
- **API rules** — never open create/update/delete on public collections without auth checks.
- **Build token** — dedicated automation user; rotate quarterly; GitHub Secrets only.
- **CORS** — allow only artist site origins if using client-side reads.
- **SSH** — key-only auth, fail2ban, restrict port 22.
- **Admin UI** — strong password; restrict `/_/` by IP/VPN if possible.
- **Rate limiting** — nginx `limit_req` on `/api/` under abuse.
- **No secrets** in artist repos or `dedalo-config.js`.

---

## 6. Backup strategy

| Asset | Method | Frequency |
|-------|--------|-----------|
| `pb_data` | `pocketbase backup create` or tarball | Daily |
| Off-site | `rclone` → B2 / Oracle Object Storage | Weekly |
| Git `data/` | Secondary; regenerate from PB | On each build |

**Cron on VM:**

```bash
0 4 * * * /usr/local/bin/pocketbase backup create -o /var/backups/pb_$(date +\%F).zip --dir=/var/lib/pocketbase/pb_data
```

Test restore on a staging VM before production reliance.

---

## Dashboard development

Serve locally (example):

```bash
cd dedalo-core/dashboard
python -m http.server 8080
# Open http://localhost:8080/artist-dashboard.html
```

---

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Login fails | Check `DEDALO_PB_URL`, CORS, artist email verified |
| 403 on save | API rules; `artist` field must equal auth record id |
| Build fails in CI | Verify secrets, `ARTIST_SLUGS`, token scope |
| Empty static data | Records must have `published = true` |

---

## License

Proprietary — Dedalo101 internal use unless otherwise agreed.