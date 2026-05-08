# Bug Report

## Status
THÀNH CÔNG (Hotfix #C2: continuous alternating loop while in viewport)

## [Hotfix #C2] User feedback
- **User report**: "ảnh 2 chỉ hiện 1 lúc rồi quay lại ảnh 1 và dừng. Muốn lặp lại liên tục: ảnh 1 → ảnh 2 → ảnh 1 → ảnh 2 …"
- **Phân tích**: Code C1 dùng 2 `setTimeout` one-shot rồi `observer.disconnect()` → chỉ chạy 1 vòng.
- **Fix**: thay 2 setTimeout bằng `setInterval` toggle `showSecond` mỗi ~1800ms. Giữ observer luôn observe (không disconnect) để pause cycle khi card rời viewport (tiết kiệm pin), resume khi vào lại. Cleanup interval + observer khi unmount.

### Test Results (C2)
- `npm run build` → ✓ Compiled successfully + 27/27 pages OK.
- Static verification 10/10 pass:
  ```
  PASS  Uses setInterval for continuous loop
  PASS  No more one-shot setTimeout(setShowSecond(true))
  PASS  Toggles showSecond via prev callback
  PASS  SWAP_MS = 1800
  PASS  startCycle defined
  PASS  stopCycle defined
  PASS  Observer pauses on leave viewport (else stopCycle)
  PASS  Cleanup disconnects observer + stops cycle
  PASS  Skips when only one image
  PASS  No more disconnect inside intersection callback
  ```

### Verification trên iPhone (sau Vercel deploy)
- Cuộn xuống "Sản phẩm nổi bật" → mỗi card hiện ảnh 1 (1.8s) → fade ảnh 2 (1.8s) → fade ảnh 1 (1.8s) → ... lặp vô tận khi card còn trong viewport.
- Cuộn card ra khỏi viewport → cycle dừng (tiết kiệm pin). Cuộn lại → cycle tiếp tục (giữ trạng thái cuối cùng).
- Desktop hover → CSS hover vẫn override interval state.

## Bug Title
Trên mobile, ảnh thứ 2 của sản phẩm không hiện khi chạm vào card ở Section "Sản phẩm nổi bật".

## Bug Description
Trên Trang chủ → Section "Sản phẩm nổi bật", mỗi card sản phẩm có 2 ảnh: ảnh chính + ảnh thứ 2 (hover preview). Trên Desktop, di chuột vào ảnh → ảnh thứ 2 fade-in. Trên Mobile, không có cách nào thấy được ảnh thứ 2 — tap chỉ navigate sang trang chi tiết sản phẩm.

## Steps to Reproduce
1. Mở Trang chủ trên iPhone (gift-web-decoco.vercel.app).
2. Cuộn xuống Section "Sản phẩm nổi bật".
3. Chạm vào ảnh sản phẩm.
4. **Kết quả**: Trang nhảy sang `/san-pham/[slug]`, không kịp thấy ảnh thứ 2.

## Actual vs Expected
- **Thực tế**: Mobile chỉ thấy ảnh chính. Ảnh 2 không hiện ra dù cố gắng tap/hold.
- **Mong đợi**: Có cách nào đó (tap, long-press, hoặc auto) cho mobile xem được ảnh 2 trước khi quyết định vào trang chi tiết.

## Context
- File: `components/ui/ProductCard.tsx`
- Browser: Mobile Safari (iOS) / Chrome Android.

---

## Root Cause Analysis

`components/ui/ProductCard.tsx:31-40` dùng **pure CSS `group-hover`** để fade hoán đổi 2 ảnh:

```
<Image className="... group-hover:opacity-0" />        {/* ảnh 1 */}
<Image className="... opacity-0 group-hover:opacity-100" />  {/* ảnh 2 */}
```

```ascii
Desktop:  mouse enter  → :hover on .group → opacity transition → user thấy ảnh 2
Mobile:   tap (touchstart) → click ngay lập tức → navigate → :hover không kịp render
          (iOS có "first tap = hover, second tap = click" nhưng chỉ cho 1 số dạng hover style;
           fade opacity thường không trigger behavior này → tap là click luôn)
```

→ Mobile không có sự kiện hover bền vững → ảnh 2 không bao giờ visible.

## Proposed Fixes

### Option A — CSS-only, minimal (Recommended cho minimal change)
Thêm `group-active:opacity-*` song song với `group-hover:opacity-*`. Trên mobile, press-and-hold ảnh → ảnh 2 hiện trong lúc giữ; thả tay → vừa quay lại ảnh 1 vừa navigate.

```diff
- group-hover:opacity-0
+ group-hover:opacity-0 group-active:opacity-0
- group-hover:opacity-100
+ group-hover:opacity-100 group-active:opacity-100
```

- **Pros**: 0 JS, 0 state, không refactor; desktop hover giữ nguyên.
- **Cons**: User phải biết "press and hold" để xem ảnh 2 (không trực quan); thả tay là navigate luôn.

### Option B — Tap-to-preview (UX tốt hơn, cần client component)
Convert ProductCard sang Client Component. Tap đầu tiên trên ảnh = show ảnh 2 (preventDefault navigate). Tap thứ 2 trong 2s = navigate. Phần info bên dưới (tên + giá) luôn navigate ngay khi tap.

```ascii
Mobile:
  tap 1 trên ảnh    → showSecond=true, preventDefault → user thấy ảnh 2
  tap 2 trên ảnh    → navigate
  tap trên info     → navigate ngay (không cần preview)
  no interaction 2s → showSecond=false (revert)
Desktop:
  hover            → CSS group-hover (giữ nguyên, không bị ảnh hưởng)
```

- **Pros**: UX tự nhiên, giống pattern Shopee mobile preview; 2 ảnh đều khám phá được.
- **Cons**: ProductCard thành "use client" (mất 1 chút SSR benefit cho card này); thêm state + touch handler; nhỉnh hơn về complexity.

### Option C — Auto-cycle khi vào viewport (Không cần tương tác)
Dùng `IntersectionObserver`: khi card scroll vào viewport lần đầu, fade ảnh 1 → ảnh 2 → ảnh 1 (loop 1 lần).

- **Pros**: User không cần làm gì; ảnh 2 hiển thị tự nhiên.
- **Cons**: Cần Client Component + observer; có thể annoying nếu user scroll nhanh; nhiều card cùng cycle gây "đập mắt".

## Verification Plan
1. Mở `/` trên iPhone Safari, cuộn đến "Sản phẩm nổi bật".
2. Khi mỗi card lần đầu vào viewport (≥50%) → sau 400ms fade sang ảnh 2, hiển thị ~1.4s, fade về ảnh 1.
3. Cuộn lại lên rồi xuống → KHÔNG cycle lại (observer đã disconnect sau lần đầu — tránh annoying).
4. Hồi quy desktop: hover vẫn fade-swap như cũ; click vẫn navigate.

## Fix Applied
- **Files Changed**:
    - `components/ui/ProductCard.tsx`: convert sang `"use client"`. Thêm `useRef<HTMLAnchorElement>` + `useState(showSecond)` + `useEffect` mount IntersectionObserver (threshold 0.5). Lần đầu card vào viewport → setTimeout 400ms set `showSecond=true`, 1800ms set `showSecond=false`, sau đó disconnect observer (chỉ chạy 1 lần).
    - Class ảnh thêm conditional: image 1 nhận `opacity-0` khi `showSecond`, image 2 nhận `opacity-100`. CSS `group-hover:opacity-*` của desktop giữ nguyên (specificity của pseudo > class nên hover vẫn override).
    - Cleanup useEffect: disconnect observer + clear timers (tránh memory leak khi unmount giữa chừng).
    - Skip khi chỉ có 1 ảnh (`hoverImage === primaryImage`) → không tạo observer.
- **Test Results**:
    - `npm run build` → ✓ Compiled successfully + 27/27 pages OK.
    - Static verification 11/11 pass:
      ```
      PASS  Marked use client
      PASS  Imports useEffect/useRef/useState
      PASS  IntersectionObserver used
      PASS  Threshold 0.5
      PASS  Disconnect after first intersection
      PASS  Show second after 400ms
      PASS  Hide second after 1800ms
      PASS  Conditional opacity-0 on primary image
      PASS  Conditional opacity-100 on hover image
      PASS  Cleanup disconnects + clears timers
      PASS  Skips when only one image (hoverImage === primaryImage)
      ```
- **Verification cần làm trên iPhone**: mở Trang chủ, cuộn xuống "Sản phẩm nổi bật" → mỗi card hiện ảnh 1 → tự fade sang ảnh 2 (~400ms sau khi vào view) → giữ ~1.4s → fade về ảnh 1. Cuộn lên xuống lại không cycle nữa. Trên desktop, hover vẫn hoạt động như cũ.
