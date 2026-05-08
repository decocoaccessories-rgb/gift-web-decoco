# Bug Report

## Status
ĐANG SỬA CHỮA

## Bug Title
Hero Mobile image not displayed on mobile — homepage always shows Desktop image

## Bug Description
After changing the "Ảnh Hero (Mobile)" image in the Admin → Nội dung page, the homepage on mobile still displays the Desktop hero image. The mobile-specific image is never loaded.

## Steps to Reproduce
1. Go to `/admin/noi-dung`
2. Upload a new image under "Ảnh Hero (Mobile)" and click "Lưu"
3. Open the homepage `/` on a mobile device or narrow viewport (< 768px)
4. Observe: the Desktop hero image is shown, not the Mobile image

## Actual Result
Mobile viewport shows the Desktop hero image (landscape). The mobile image is ignored.

## Expected Result
Mobile viewport (< 768px) should show the dedicated Mobile hero image (portrait 9:16).

## Context
- **Environment**: Next.js app deployed on Vercel, Supabase backend
- **Screenshot**: User provided screenshot of Admin panel showing both Desktop and Mobile hero images configured

---

## Root Cause Analysis

The bug has **two independent causes** that compound each other:

### Cause 1: PATCH API upsert missing `section` field

```
Admin saves → PATCH /api/admin/site-content
            → upsert({ key, value, updated_at })    ← no `section`!
```

`app/api/admin/site-content/route.ts:42-45`:
```ts
await admin
  .from("site_content")
  .upsert({ key, value, updated_at: new Date().toISOString() }, { onConflict: "key" });
```

If `hero_image_mobile` does **not** already exist in the `site_content` table (e.g. never seeded), this upsert creates a **new row** with `section = null`.

### Cause 2: Homepage query filters by `section IN ("hero","story","cta")`

`app/page.tsx:24-26`:
```ts
supabase
  .from("site_content")
  .select("key, value")
  .in("section", ["hero", "story", "cta"])
```

This filter **excludes** any row where `section IS NULL`. So the newly created `hero_image_mobile` row (with `section = null`) is never returned to the homepage.

### Data flow diagram

```
Admin saves "hero_image_mobile"
        │
        ▼
  upsert({ key: "hero_image_mobile", value: "<url>" })
        │
        ▼
  DB row created: section = NULL  ← BUG: no section set
        │
        ▼
  Homepage query: .in("section", ["hero","story","cta"])
        │
        ▼
  Row filtered out → hero_image_mobile = ""
        │
        ▼
  HeroSection: mobileSrc = heroImageMobile || heroImage → falls back to desktop
```

## Proposed Fixes

### Fix Option 1 (Recommended): Include `section` and `type` in the upsert

In `app/api/admin/site-content/route.ts`, the `IMAGE_KEYS` and their corresponding metadata (section, type) should be known so the upsert always writes the correct `section`. This ensures whether the row already exists or is being created for the first time, it always gets the right `section`.

**Files to change:**
- `app/api/admin/site-content/route.ts` — Add a lookup map for known image keys and include `section`/`type` in the upsert

```ts
const KNOWN_KEY_METADATA: Record<string, { section: string; type: string; label: string }> = {
  hero_image:        { section: "hero",  type: "image", label: "Ảnh Hero (Desktop)" },
  hero_image_mobile: { section: "hero",  type: "image", label: "Ảnh Hero (Mobile)" },
  story_image:       { section: "story", type: "image", label: "Ảnh Story" },
};

// In the PATCH handler:
for (const { key, value } of parsed.data.updates) {
  const meta = KNOWN_KEY_METADATA[key];
  await admin
    .from("site_content")
    .upsert(
      {
        key,
        value,
        updated_at: new Date().toISOString(),
        ...(meta && { section: meta.section, type: meta.type, label: meta.label }),
      },
      { onConflict: "key" }
    );
}
```

**Trade-offs:** Minimal change, solves the root cause. New image keys added in the future just need to be added to the map.

### Fix Option 2 (Alternative): Seed the DB row upfront

Ensure `hero_image_mobile` already exists in the `site_content` table with `section = "hero"` before admin ever uses it. This avoids changing API code but is fragile — if the row gets deleted, the bug returns.

**Trade-offs:** Quick DB-only fix but doesn't prevent recurrence.

### Recommended: Apply both
Option 1 makes the code self-healing, Option 2 ensures existing data is correct immediately.

## Verification Plan

### Manual test steps
1. After applying the fix, save a new Mobile hero image in Admin
2. Query `site_content` via API/Supabase dashboard — confirm `hero_image_mobile` has `section = "hero"`
3. Visit homepage on mobile viewport — confirm mobile image is shown
4. Visit homepage on desktop viewport — confirm desktop image is still shown

### Edge cases
- What happens if admin clears the mobile image (sets to empty string)?
- Verify that `hero_image` (desktop) still works independently
