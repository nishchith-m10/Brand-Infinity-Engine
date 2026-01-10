# Campaigns & Videos UI issues — notes + fix plan 🛠️

Summary: answers and actionable fixes for the five items you reported. Each section explains the cause, points to the exact files, and gives a minimal code example + test suggestion.

---

## 1) Campaigns still appear in the dropdown after delete/archive ✅
- Observation: Deleted or archived campaigns still show in the header `CampaignSelector` drop-down.
- Files to inspect:
  - Frontend: `components/CampaignSelector.tsx`
  - API & validation: `lib/validations/api-schemas.ts` (status enum includes `archived`, `pending_deletion`)
  - Backend: `app/api/v1/campaigns/*` and `scripts/test-pipeline-api.sh` (deletes return `data.deleted`)

Cause: the UI currently renders all returned campaigns without filtering out soft-deleted (`deleted_at`) or archived/pending_deletion statuses.

Fix (frontend): only show active campaigns in the selector (filter out archived/pending_deletion and soft-deleted rows).

Minimal change (replace in `components/CampaignSelector.tsx`):

  // Before
  const activeCampaigns = campaigns;

  // After
  const activeCampaigns = campaigns.filter(c => {
    return !c.deleted_at && !['archived', 'pending_deletion'].includes(c.status);
  });

Notes & backend checks:
- Prefer server-side filtering (API should avoid returning deleted/archived campaigns for list endpoints)
- DB: there is a `deleted_at` column and RLS/migrations referencing cascade deletes; ensure API uses `WHERE deleted_at IS NULL` when listing.

Suggested test:
- Unit test for `CampaignSelector` that passes campaigns with `status: 'archived'` and ensures they are not rendered
- Integration: API test to verify listing endpoint excludes archived/deleted campaigns

ASCII lifecycle (campaign) >>>

  +-----------+    archive    +-----------+    delete    +-----------+
  |  active   | ------------> | archived  | -----------> | soft-deleted/removed |
  +-----------+               +-----------+              +---------------------+
       ^                          UI filter                       API / DB
       |                                                            |
       +------------------------------------------------------------+

---

## 2) Search Campaign container/outbox uses wrong color in light mode 🎨
- Observation: search results box / outbox stays gray/black in light mode.
- Files to inspect: `components/Navbar.tsx` (search input & results), Tailwind config / global styles.

Cause: background/text colors for search results and input rely on defaults that can appear gray — not explicitly enforced for light mode. Also possible dark-mode class leaking or missing `text-*` for light mode.

Fix (frontend): make the input and results explicit about light/dark color.

Recommended changes (in `components/Navbar.tsx`):

  // Input
  className="pl-9 pr-9 py-2 w-64 text-sm bg-white text-slate-900 dark:bg-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg ..."

  // Results container
  className="absolute top-full mt-2 w-full bg-white text-slate-900 dark:bg-slate-800 dark:text-slate-200 border border-slate-200 dark:border-slate-700 rounded-lg ..."

Also for result items:
  className="w-full text-left px-3 py-2 rounded hover:bg-slate-100 dark:hover:bg-slate-700 transition-colors text-slate-900 dark:text-slate-200"

Test:
- Switch theme to light vs dark and visually verify search results background and text are correct

ASCII visual (search box):

  [ Search input (bg-white, text-slate-900) ]
                 |
                 v
  +-------------------------------------------+
  | Search results (bg-white, text-slate-900) |
  +-------------------------------------------+

---

## 3) Exact color in your screenshot (tooltip / knowledge bar) — what is it? 🎯
- The color displayed matches the repository's brand purple token **`lamaPurple`**.
- Exact hex: **#8B5CF6** (see `HEALTH_AUDIT_MASTER_REPORT.md` where `lamaPurple: '#8B5CF6'`).
- Use the class names / tokens where possible: `text-lamaPurple`, `bg-lamaPurple`, `from-lamaPurple`.

Quick usage example:
- `className="text-lamaPurple"` (preferred)
- Fallback hex if needed: `style={{ color: '#8B5CF6' }}`

---

## 4) Campaign box (folder icon, campaign name, dropdown list) looks too-light in light mode — should be black text (dynamic) ⚫️
- Observation: these elements are very light gray in light mode; should be dark/black while preserving dark mode appearance.
- Files to inspect: `components/CampaignSelector.tsx` (trigger button, icon and dropdown list), `components/Navbar.tsx` (if any wrappers)

Cause: currently using `text-slate-800` for light mode. That's fairly dark, but may render lighter in some browsers; we should use a stronger light-mode color and keep dark mode unchanged.

Fix (frontend): make explicit light/dark text classes — `text-slate-900` for light mode and keep `dark:text-slate-300` for dark.

Example replacements (in `components/CampaignSelector.tsx`):

  // Icon & text
  <FolderOpen className="h-4 w-4 text-slate-900 dark:text-slate-300" />
  <span className="text-sm font-medium text-slate-900 dark:text-slate-300 ...">{displayName}</span>
  <ChevronDown className={`h-4 w-4 text-slate-900 dark:text-slate-300 ...`} />

Notes:
- Use `text-slate-900 dark:text-slate-300` consistently for UI elements where you want a crisp dark color in light mode without affecting dark mode.

---

## 5) Remove all mock test data in the videos page (cleanup) 🧹
- Observation: videos page contains mock/test data surviving in UI or DB seeds.
- Places that create mock/test video rows:
  - CI scripts: `scripts/ci/test_business_logic_ci.sh` inserts temporary `generation_jobs` (look for `E2E test` prompts)
  - Local sim: `src/pillars/production/video_generator.js` contains simulated/mock generation logic that returns `https://storage.example.com/...` URLs for local testing
  - Migrations: `supabase/migrations/..._test_conversation_tables.sql` may insert test data

Recommendation:
1. Remove test mock rows from the production DB (run a one-off cleanup query):

   DELETE FROM generation_jobs
   WHERE prompt ILIKE '%E2E test%'
      OR (metadata->>'note') ILIKE '%e2e%'
      OR model_name = 'mock';

2. Update UI/pages to avoid rendering hard-coded mock arrays in the videos page. Replace with an empty-state that says "No videos yet" and a CTA to "Create a video".

3. Ensure CI test insertion is limited to CI environments and cleaned up after tests; add cleanup steps to `scripts/ci/test_business_logic_ci.sh`.

4. If `video_generator.js` has a mock branch, ensure `IMAGE_GEN_MODE=mock` is required (already enforced in many modules) and never used in production.

Suggested empty-state UI (frontend):

  if (!videos || videos.length === 0) {
    return (
      <div className="p-6 text-center text-slate-500">
        No videos found for this campaign. Click <button>Generate video</button> to start.
      </div>
    );
  }

---

### Want me to implement these fixes? ✅
I can open a small PR with the following changes:
- [ ] `components/CampaignSelector.tsx` — add filtering & bump light-mode text color
- [ ] `components/Navbar.tsx` — enforce explicit light/dark colors for search input and results
- [ ] Add tests: `tests/CampaignSelector.test.tsx` and a small visual check test for search box colors (unit snapshot)
- [ ] Guidance & cleanup SQL for removing test videos; add CI cleanup step

Tell me which subset you'd like done now and I'll implement and open a PR (I can keep commits small & focused).