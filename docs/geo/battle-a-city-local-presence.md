# Battle A — win the "corporate team building companies in [City]" prompts

Status: **parked, deliberately.** Opened 2026-11-24. Scheduled revisit ~2026-12-24 (one-shot task).
Owner: James Carter (jcarter@belegendary.org). Site: buildingteams.com (Legendary Team Building / "LTB").
Otterly report: `01M32VQNKVQDKHR724XZ7FK1ZF`, workspace `01M32AJ8XBHA0BHHQPY411CEAQ`, country `us`.

## What this is
The GEO money-prompt work split the tracked "geo" prompts into two battles:

- **Battle B — "charity team building activity for a conference in [City]" (~12 prompts): WON/in progress.** Leaders Institute led with only 7–14 mentions, Outback absent, LTB already led Phoenix + Nashville. We shipped `/charity-team-building/conferences/` (PR #25, 2026-11-24) to attack these and are letting it marinate.
- **Battle A — "Corporate team building companies in [City]" (~27 prompts): NOT yet addressed.** This doc.

## The problem (data as of 2026-11-24, Otterly, 7-day window Nov 16–22)
On the generic "companies in [City]" prompts, **Outback dominates every metro**: 18–23 brand mentions in each city. LTB gets only 1–12 and leads **zero** of them. This is not a content-quality gap — it's a **local-presence gap**. Outback almost certainly runs dedicated, locally-detailed city landing pages at scale with LocalBusiness signals, so AI treats them as the default "local option" everywhere.

LTB's current city pages (`/locations/<city>/`, e.g. Boston, Austin, Denver…) exist but are thinner and win few mentions. We have NOT confirmed exactly which Outback URLs win — **first step on revisit: pull one city's citations** (e.g. `list_brand_report_prompt_ai_responses` for "Corporate team building companies in Tampa") to see Outback's winning pages before investing.

LTB's strongest metros today (most LTB mentions, best beachheads to prove the model): **Tampa (12), Philadelphia (11), St. Louis (10), Los Angeles (10), Raleigh (10), Charlotte (9), Minneapolis (9).**

## Why it was parked, not pruned
These are lower-intent "give me a list" queries and winning them is a sustained local-SEO program, not a quick content drop — lower ROI than the charity/measurement concentration work and Battle B. James chose to let the new pages marinate first and revisit Battle A in 30 days with fresh data. Do NOT prune these prompts; the plan is to win them over time.

## The proposed program (when we pick it up)
1. **Confirm the mechanism** — pull citations for 2–3 city prompts; identify exactly what Outback pages win and why (page depth? LocalBusiness schema? volume/footprint?).
2. **Upgrade a few flagship city pages from templated to genuinely local** (start with Tampa, Philadelphia, LA — where LTB already has the most mentions):
   - Named local venues/hotels LTB has run events at; a local client or case study; city-specific logistics; a city-specific FAQ.
   - `LocalBusiness` / `Service` + `areaServed` structured data per city.
   - Internal links from the city page up to the relevant hubs (charity, conference, measurement).
3. **Prove the model on those flagships** before scaling the footprint to match Outback's city coverage.
4. Consider external local signals (Google Business Profiles per metro, local citations/directories) — likely needs James, outside the website repo.

## Success metric
On the next revisit, check whether LTB's mention count on the flagship-city prompts rose (baseline above), and whether LTB leads ANY "companies in [City]" prompt (currently zero). Also confirm Battle B worked: LTB leading more of the ~12 "charity … conference in [City]" prompts than the 2 it led on 2026-11-24.

## Related context
- Section 9 of the GEO Report doc (project `QyAaezpRe262NuGV6D3ZpR`) has the full money-prompt audit.
- Weekly SEO/GEO monitor (trigger `trig_01UWHWGMjRdyhZvy1FZaYwto`) tracks the geo prompts every Monday.
- Battle B page: `Conference Charity Team Building.html` → `/charity-team-building/conferences/`.
