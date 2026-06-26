# Redirects & Domain Consolidation

This documents (a) the **teambuildingactivity.com → buildingteams.com**
consolidation and (b) the internal moves from the June 2026 IA restructure.
The site's *own* legacy backlink-recovery map already lives in `.htaccess`.

---

## A. Consolidate teambuildingactivity.com (TBA) into buildingteams.com (BT)

**Why:** Same buyer, same buying motion as BT, and you no longer sell products —
so two domains only split topical authority and AI-citation weight. Consolidating
concentrates it. (Most of TBA's recent backlink drop was **spam from a hack that
was cleaned**, not lost authority — so this is hygiene + consolidation, not a rescue.)

**Mechanism:** Point TBA's DNS/vhost at the same VPS (or keep its vhost) and add a
TBA-only `.htaccess` (or vhost block) that 301s legit URLs to their BT equivalent
and 410s the spam remnants. Keep TBA registered and the redirects live
**indefinitely** (don't let the domain lapse — that's how the link equity passes).

### Fill this map from a Semrush/GSC export of TBA's *ranking* URLs
For each TBA URL with real traffic/backlinks, map to the closest BT page.
Anything spam/hacked → `410 Gone` (don't dilute BT by 301'ing junk).

```apache
# /  (TBA home)  ->  BT home  (passes the domain's root authority)
RewriteEngine On
RewriteCond %{HTTP_HOST} (^|\.)teambuildingactivity\.com$ [NC]
RewriteRule ^/?$ https://www.buildingteams.com/ [R=301,L]

# --- Topic mappings (EDIT: derive exact left-hand paths from Semrush) ---
# Products / activities  -> Experiences (or a specific activity)
RewriteRule ^.*bike.*build.*$        https://www.buildingteams.com/activities/bike-build/        [R=301,NC,L]
RewriteRule ^.*shoe.*$               https://www.buildingteams.com/activities/shoe-build/        [R=301,NC,L]
RewriteRule ^.*skateboard.*$         https://www.buildingteams.com/activities/skateboard/        [R=301,NC,L]
RewriteRule ^.*scavenger.*hunt.*$    https://www.buildingteams.com/experiences/the-ultimate-hunt/ [R=301,NC,L]
RewriteRule ^.*sailing.*$            https://www.buildingteams.com/experiences/                  [R=301,NC,L]
RewriteRule ^.*workshop.*$           https://www.buildingteams.com/programs/                     [R=301,NC,L]
RewriteRule ^.*(activities|games|exercises).*$ https://www.buildingteams.com/experiences/        [R=301,NC,L]
# Anything we can't map confidently -> BT home (still passes equity, no 404s)
RewriteRule ^(.*)$                   https://www.buildingteams.com/                              [R=301,L]

# --- Spam remnants from the hack -> 410 GONE (do NOT 301) ---
# (Reuse the spam patterns already proven in BT's .htaccess: /news/, casino/pharma/essay slugs.)
RewriteRule ^news/ - [G,NC,L]
```

> ⚠️ Replace the wildcard topic rules with **exact** path mappings from the
> Semrush export before going live — wildcards are a safety net, not the plan.
> Aim to 301 the top ~50 ranking/linked URLs precisely; let the catch-all handle the long tail.

### Post-cutover checklist
- [ ] Google Search Console: add TBA, use **Change of Address** → BT.
- [ ] Keep both properties verified; submit BT's `sitemap.xml`.
- [ ] Spot-check 10 mapped URLs return `301` to a live BT page (not a chain, not a 404).
- [ ] Spot-check spam URLs return `410`.
- [ ] Update GBP / directory citations that pointed at TBA.

---

## B. Internal moves (June 2026 IA restructure)

The site reorganized around **buyer intent**: Experiences (one-off) ·
Programs (ongoing) · Team Coaching (executive). Notes:

### Keep — do NOT redirect
- **`/executive-team-building/`** stays a live page. It ranks for a distinct,
  valuable keyword ("executive team building") that is *not* synonymous with
  "team coaching." Redirecting it into `/team-coaching/` would forfeit that
  ranking. Instead it's cross-linked to `/team-coaching/` and `/programs/`.
  (It's intentionally out of the **primary nav** to reduce choice overload, but
  remains in the footer + cross-links + sitemap.)
- **`/conference-team-building/`** and **`/charity-team-building/`** likewise stay
  live (valuable keywords); they're surfaced *inside* Experiences and the footer.

### New pages (already in sitemap.xml)
- `/experiences/` , `/experiences/the-ultimate-hunt/`
- `/programs/` (TeamwoRx) , `/team-coaching/`
- `/testimonials/` , `/case-studies/conference-case-histories/` , `/case-studies/executive-turnarounds/`

No internal 301s are required — these are net-new URLs. If any *old* BT URL needs
to move, add it to the "301 MOVED PERMANENTLY" block in `.htaccess`.
