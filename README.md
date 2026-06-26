# Building Teams — Website (buildingteams.com)

Static, philanthropic team-building website for **Be Legendary / Building Teams**.
Hand-authored HTML + one shared stylesheet. No framework, no runtime build
dependencies — just a tiny Node script that turns the editable source files into
a clean-URL `dist/` ready to drop on the server.

---

## 1. How this repo is organized

```
/                         ← repo root = EDITABLE SOURCE (one source of truth)
  Homepage C - Authority Proof-driven.html   ← the live homepage (becomes "/")
  Experiences.html  Programs.html  Team Coaching.html  ...
  Team Building <City>.html        ← 18 location pages
  Case Study *.html                ← case studies
  assets/
    site.css                       ← the entire design system (colors, type, components)
    photos/  logos/  logo.png  favicon-*.png
  .htaccess                        ← Apache: HTTPS+www, clean URLs, 301/410 redirect map
  sitemap.xml  robots.txt  llms.txt  site.webmanifest
  404.html
  build.js                         ← generates dist/ (clean URLs)  ← run before deploy
  dist/                            ← GENERATED. Do not edit or commit. (gitignored)
```

**Edit the pretty-name files in the root.** They preview directly in a browser.
`dist/` is disposable output — `build.js` rebuilds it from scratch every time.

### Pages map to clean URLs via their `<link rel="canonical">`
`build.js` reads each file's canonical tag to decide where it lands, e.g.

| Source file                         | Production URL                         |
|-------------------------------------|----------------------------------------|
| `Homepage C - Authority...html`     | `/`                                    |
| `Experiences.html`                  | `/experiences/`                        |
| `The Ultimate Hunt.html`            | `/experiences/the-ultimate-hunt/`      |
| `DaVita Case Study.html`            | `/case-studies/davita/`                |
| `Team Building Dallas.html`         | `/locations/dallas/`                   |
| `Ideas Remote Team Building.html`   | `/resources/team-building-ideas/remote-team-building-ideas/` |

Homepage A & B and the internal `*.html` docs (Strategy Brief, etc.) are **excluded**
from the build (see `EXCLUDE` in `build.js` and `.gitignore`).

---

## 2. Build

```bash
node build.js
```

Produces `dist/` containing the clean-URL tree, with **all internal links and
asset paths rewritten to root-absolute** (`/experiences/`, `/assets/site.css`)
so they resolve from any folder depth. Also copies `assets/`, `.htaccess`,
`sitemap.xml`, `robots.txt`, `llms.txt`, `site.webmanifest`, and `404.html`.

No npm install needed — `build.js` uses only Node's built-in `fs`/`path`.

---

## 3. Deploy to the GoDaddy managed VPS (Plesk)

The server needs the **contents of `dist/`** in the domain's web root
(Plesk default: `/var/www/vhosts/buildingteams.com/httpdocs/`).

> ⚠️ **Plesk + `.htaccess` gotcha.** Plesk usually runs **nginx in front of Apache**.
> Apache still processes `.htaccess`, *but* if the domain has nginx set to serve
> static files directly, your rewrites/redirects get bypassed. Fix one of two ways:
> - **Keep Apache in charge of static files:** Plesk → Domains → buildingteams.com →
>   **Apache & nginx Settings** → *uncheck* "Smart static files processing" (and
>   "Serve static files directly by nginx"). `.htaccess` then works as written.
> - **Or port the rules to nginx:** paste equivalent `location`/`return 301` rules
>   into **Additional nginx directives** in that same screen. (Ask Claude Code to
>   translate `.htaccess` → nginx if you go this route.)

### Option A — Plesk Git (recommended)
1. Plesk → Domains → buildingteams.com → **Git**.
2. Remote: `https://github.com/lpmoon007/Building-Teams-Website-2026.git`, branch `main`.
3. Set **Deployment path** to `httpdocs`. Because the deployable files are the
   built `dist/` (gitignored), enable **"Additional deployment actions"** and run
   the build + copy on each pull:

   ```bash
   /opt/plesk/node/<ver>/bin/node build.js && \
   rsync -a --delete dist/ /var/www/vhosts/buildingteams.com/httpdocs/
   ```
   (Find the Node path under Plesk → **Tools & Settings → Node.js**, or use the
   domain's Node panel. If Node isn't available on the server, use Option B.)

### Option B — build locally, push code, rsync the build (cleanest)
From your machine (the Claude Code path — see §4):
```bash
node build.js
rsync -avz --delete dist/ <user>@buildingteams.com:/var/www/vhosts/buildingteams.com/httpdocs/
```
`--delete` keeps the server identical to the build. Source stays in GitHub;
only built `dist/` touches the server. (SSH must be enabled for the subscription
in Plesk → **Web Hosting Access**.)

### Either way — verify on the server
- `.htaccess` is honored (see the Plesk/nginx note above) and `mod_rewrite` is on.
- Visit `/`, `/experiences/`, `/case-studies/davita/`, and a bad URL (→ `/404.html`).
- Spot-check the new flagship pages: `/measurable-team-building/` and `/state-of-team-building/`.
- Confirm HTTPS + www forcing works (http→https, non-www→www).
- In Plesk, set the domain's SSL (Let's Encrypt) and **"Permanent SEO-safe 301
  redirect from HTTP to HTTPS"** as a belt-and-suspenders backup to the `.htaccess` rule.

---

## 4. The Claude Code workflow (push + deploy)

In Claude Code, from the repo folder:

> "Build the site with `node build.js`, commit the source, and push to
> `lpmoon007/Building-Teams-Website-2026` on `main`. Then deploy the contents of
> `dist/` to my GoDaddy VPS web root over rsync/SSH (I'll provide host + key),
> ensuring `.htaccess` lands and HTTPS+www forcing works. Finally apply the
> domain-consolidation redirects in `REDIRECTS.md`."

---

## 5. Domain consolidation & redirects

See **`REDIRECTS.md`** for the plan to fold **teambuildingactivity.com** into
buildingteams.com (301 the legit ranking URLs, 410 the spam remnants from the
hack) and the internal moves. The existing `.htaccess` already contains the
backlink-recovery redirect map for buildingteams.com's own old URLs.

---

## 6. Editing notes

- **Design system lives in `assets/site.css`** — colors are CSS variables
  (`--brand:#64010a; --brand-2:#8c0f1c; …`). Reuse them; don't hard-code hex.
- **Primary nav is identical on every page**: Home · Experiences · Programs ·
  Team Coaching · Case Studies · About. If you add a top-level page, update the
  nav block on each page (or factor nav into a small include + template step).
- **Pricing is intentionally gated** everywhere — "Book a call", no public numbers.
- **SEO is tuned**: unique titles (≤62) + descriptions (≤160), canonical, OG +
  Twitter, JSON-LD on every page. Keep that contract when adding pages.
- After any content change: `node build.js` → redeploy `dist/`.
