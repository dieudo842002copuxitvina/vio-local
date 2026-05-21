# VIO LOCAL — UI SYSTEM
**Version 1.0 | Earthy Premium Design for Modern Rural Commerce**

---

## 0. DESIGN PHILOSOPHY

### 0.1 The Aesthetic in Five Words

**Earthy. Premium. Warm. Trustworthy. Modern.**

This is not a startup. This is not a SaaS dashboard. This is not Shopee.

VIO LOCAL is what happens when rural Vietnamese commerce gets a **professional, dignified digital presence** — one that respects the user, honors the craft of small business, and feels like it belongs in 2026 (not 2015).

### 0.2 Inspiration Reference Points

```
DRAW FROM:
├── Premium agricultural brands (Whole Foods packaging, but Vietnamese)
├── Modern Japanese rural design (wabi-sabi meets utility)
├── Vietnamese coffee shop branding (warm earth tones, craft feel)
└── Editorial websites (NYT, Stripe — clean typography, generous space)

REJECT:
├── Loud marketplace design (Shopee, Lazada)
├── Trendy startup aesthetics (gradients, animations)
├── Generic SaaS dashboards (DataDog, Salesforce)
├── Web 3.0 minimalism (cold, sterile)
└── Tech bro corporate (purple gradients, neon accents)
```

### 0.3 The Five Design Principles

```
PRINCIPLE 1: CONFIDENT, NOT CLEVER
   Design that doesn't need to prove itself.
   No tricks. No animations to wow. Just clear, helpful interfaces.

PRINCIPLE 2: CONTENT IS THE STAR
   Photos of businesses. Names. Locations. Phone numbers.
   The UI fades into the background. Content steps forward.

PRINCIPLE 3: EARTHY, NOT NEON
   Colors from Vietnamese rural landscapes.
   Greens of paddy fields. Browns of soil. Whites of paper.
   No neon. No gradients. No "tech blue."

PRINCIPLE 4: GENEROUS, NOT CRAMPED
   Whitespace is luxury. Cramping is poverty.
   Even on mobile, give content room to breathe.

PRINCIPLE 5: MOBILE-FIRST, ALWAYS
   90% of traffic will be mobile.
   Design for 320px first. Desktop is a bonus view.
```

### 0.4 What This UI Is NOT

```
❌ Marketplace-style grid of 1000 products
❌ Dashboard with 20 widgets and sparklines
❌ Trendy gradient backgrounds
❌ Skeuomorphic textures
❌ Glassmorphism / neumorphism
❌ Animated illustrations
❌ Chat bots, popups, modals everywhere
❌ Infinite scroll feeds
❌ Notification badges everywhere
❌ Onboarding tours with 12 steps
❌ Gamification (badges, levels, points)
❌ Dark mode (Phase 7+, if at all)
```

---

## 1. COLOR SYSTEM

### 1.1 Color Philosophy

**Earth, not tech.**

Colors derived from Vietnamese rural landscapes:
- Paddy field greens
- Sun-warmed terracotta
- Hand-made paper neutrals
- Ink-on-paper text colors
- Sunset accent (rare, intentional)

### 1.2 Primary Palette

```css
/* PRIMARY — Paddy Green
   The signature color. Used sparingly for primary actions and brand. */
--vio-green-50:  #f1f8f0;   /* Tint: backgrounds, hover states */
--vio-green-100: #dcecd9;   /* Light: badges, subtle accents */
--vio-green-200: #b8d9b2;   /* Soft: borders, dividers */
--vio-green-500: #4a7c47;   /* DEFAULT: primary actions, brand */
--vio-green-600: #3d6b3a;   /* Hover: buttons */
--vio-green-700: #2f5a2c;   /* Active: pressed state */
--vio-green-900: #1a3818;   /* Deep: text on light bg */

/* SECONDARY — Terracotta
   Warmth, craft, earth. Used for accent moments. */
--vio-clay-50:  #fbf3ef;
--vio-clay-100: #f3e0d4;
--vio-clay-500: #b86c45;   /* DEFAULT: accent, sale badges */
--vio-clay-700: #8a4d2f;

/* NEUTRAL — Paper & Ink
   The bulk of the interface. Soft, warm, never sterile. */
--vio-cream-50:  #fdfbf6;   /* Page background (warm white) */
--vio-cream-100: #faf6ed;   /* Card background */
--vio-cream-200: #f0ead8;   /* Subtle background tint */

--vio-stone-100: #f5f2ec;   /* Dividers, soft borders */
--vio-stone-300: #d6cfc1;   /* Borders */
--vio-stone-500: #8a8174;   /* Secondary text */
--vio-stone-700: #4a4438;   /* Primary text */
--vio-stone-900: #1f1c16;   /* Headings, emphasis */
```

### 1.3 Semantic Colors

```css
/* INFO — Trust, links */
--vio-info-500:  #3a6b8a;   /* Muted blue, trustworthy */
--vio-info-700:  #2a5169;

/* SUCCESS — Confirmation, "open now" */
--vio-success-500: #4a7c47;  /* Same as primary green */
--vio-success-700: #2f5a2c;

/* WARNING — Caution */
--vio-warning-500: #c89546;  /* Warm amber, not yellow */
--vio-warning-700: #a07232;

/* ERROR — Mistakes, "closed" */
--vio-error-500:   #b54a3c;  /* Muted red-brown, not bright red */
--vio-error-700:   #8a3528;
```

### 1.4 Usage Guidelines

**THE 60-30-10 RULE:**
```
60% Neutral (cream/stone for backgrounds, text, structure)
30% Primary (green for actions, brand moments)
10% Accent (clay terracotta, info blue, etc.)
```

**FORBIDDEN COMBINATIONS:**
```
❌ Pure black (#000) — use --vio-stone-900 instead
❌ Pure white (#fff) — use --vio-cream-50 instead
❌ Bright primary colors — they shout, we whisper
❌ Color gradients — flat colors only
❌ More than 2 accent colors per screen
```

**WHEN TO USE GREEN:**
- Primary buttons (call-to-action)
- Brand moments (logo, header accent)
- "Open Now" indicators
- Active states

**WHEN TO USE CLAY:**
- Premium business badges
- Featured listings
- Verification marks
- Special promotional moments

**WHEN TO USE NEUTRALS:**
- 90% of everything
- Backgrounds, cards, text, borders
- Default state for almost any element

### 1.5 Contrast & Accessibility

**MINIMUM CONTRAST RATIOS:**
```
Body text on background:       4.5:1 (WCAG AA)
Large text on background:      3:1 (WCAG AA)
UI elements (icons, borders):  3:1
Focus indicators:              3:1 against adjacent colors
```

**TESTED COMBINATIONS:**
```
✅ --vio-stone-700 on --vio-cream-50    (4.5:1+ contrast)
✅ --vio-stone-900 on --vio-cream-100   (8:1+ contrast)
✅ --vio-green-700 on --vio-cream-50    (5:1+ contrast)
✅ --vio-cream-50 on --vio-green-600    (4.5:1+ contrast, for buttons)
```

---

## 2. TYPOGRAPHY SYSTEM

### 2.1 Font Family

**One font family. Used confidently.**

```css
font-family: 'Inter', 'Be Vietnam Pro', -apple-system, BlinkMacSystemFont, 
             system-ui, sans-serif;
```

**Why Inter:**
- Excellent Vietnamese diacritic support
- High readability at small sizes
- Free and open source
- Variable font (one file, all weights)

**Why Be Vietnam Pro as fallback:**
- Designed specifically for Vietnamese
- Beautiful with diacritics
- Falls back well on Vietnamese systems

**NO SERIF FONTS** for primary use. Editorial moments may use:
```css
font-family: 'Lora', 'Crimson Pro', Georgia, serif;
```
Reserve for: business taglines, quoted text, editorial intros.

### 2.2 Type Scale

**Mobile-first scale (base 16px):**

```css
/* DISPLAY — Hero moments, very rare */
--text-display: 36px;     line-height: 40px;   weight: 600;
/* Use case: Homepage hero, "VIO LOCAL" brand moments */

/* HEADING — Page titles, business names */
--text-h1: 28px;          line-height: 36px;   weight: 600;
--text-h2: 22px;          line-height: 30px;   weight: 600;
--text-h3: 18px;          line-height: 26px;   weight: 600;

/* BODY — The workhorse */
--text-body-lg: 18px;     line-height: 28px;   weight: 400;
--text-body: 16px;        line-height: 24px;   weight: 400;
--text-body-sm: 14px;     line-height: 20px;   weight: 400;

/* META — Captions, timestamps, supporting info */
--text-meta: 13px;        line-height: 18px;   weight: 400;
--text-tiny: 11px;        line-height: 14px;   weight: 500;
/* Use case: "2km away", "Updated 3 days ago" */

/* MINIMUM SIZE: 13px (for meta text only) */
/* MINIMUM SIZE FOR INTERACTIVE TEXT: 16px (always) */
```

### 2.3 Font Weights

**Use only 3-4 weights:**

```css
--weight-regular:  400;   /* Body text */
--weight-medium:   500;   /* Emphasis, labels */
--weight-semibold: 600;   /* Headings, buttons */
--weight-bold:     700;   /* Reserved — use sparingly */
```

**FORBIDDEN:**
- Weight 300 (too thin for outdoor reading)
- Weight 800-900 (too aggressive)
- Italic for emphasis (use --weight-medium instead)

### 2.4 Vietnamese-Specific Considerations

**Diacritic Spacing:**
```css
/* Vietnamese stacked diacritics need extra line-height */
line-height: 1.4; /* minimum for Vietnamese text */
line-height: 1.5; /* preferred for body text */
```

**Character Width:**
- Vietnamese text is often 10-15% wider than English
- Test all UI with full Vietnamese names
- Allow buttons to expand: `min-width` not `width`

### 2.5 Headings Hierarchy

**HOMEPAGE:**
```html
<h1>Khám phá doanh nghiệp địa phương</h1>          <!-- 28px -->
<h2>Sản phẩm nông sản theo vùng</h2>               <!-- 22px -->
<h3>Tỉnh Đồng Nai</h3>                             <!-- 18px -->
```

**STOREFRONT:**
```html
<h1>Cá Tươi Bà Năm</h1>                            <!-- 28px -->
<h2>Sản phẩm</h2>                                  <!-- 22px -->
<h3>Cá rô đồng</h3>                                <!-- 18px -->
```

**RULES:**
- One `<h1>` per page (SEO requirement)
- Sequential nesting (h1 → h2 → h3, no skipping)
- Headings carry weight (600), not size alone

### 2.6 Body Text Rules

```
✅ DO:
- 16px minimum for body
- 1.5 line-height for paragraphs
- Max 75 characters per line (readability)
- Left-aligned (not justified)
- Use --vio-stone-700 for body, --vio-stone-900 for emphasis

❌ DON'T:
- Center-align long text
- Justify text (creates Vietnamese spacing issues)
- Use italics for emphasis (poor Vietnamese rendering)
- Underline text that isn't a link
- Use ALL CAPS for body (use --vio-tiny + tracking instead)
```

---

## 3. SPACING SYSTEM

### 3.1 The Scale

**Based on 4px grid:**

```css
--space-0:  0;
--space-1:  4px;     /* Tight: icon padding */
--space-2:  8px;     /* Small: badge padding */
--space-3:  12px;    /* Compact: between related items */
--space-4:  16px;    /* DEFAULT: most spacing */
--space-5:  20px;    /* Comfortable: card padding */
--space-6:  24px;    /* Section: between sections */
--space-8:  32px;    /* Large: major sections */
--space-10: 40px;    /* XL: hero spacing */
--space-12: 48px;    /* XXL: page section dividers */
--space-16: 64px;    /* Massive: between major page sections (desktop) */
```

### 3.2 Spacing Philosophy

**GENEROUS, NOT CRAMPED.**

```
✅ GOOD: 24px between cards in a list
❌ BAD:  8px between cards (feels crowded)

✅ GOOD: 32px between page sections
❌ BAD:  16px (sections blur together)

✅ GOOD: 20px padding inside cards
❌ BAD:  8px padding (content touches edges)
```

### 3.3 Common Spacing Patterns

```
ELEMENT                    SPACING
────────────────────────────────────────────
Icon ↔ text                space-2 (8px)
Form label ↔ input         space-2 (8px)
Related items              space-3 (12px)
Independent items          space-4 (16px)
Card internal padding      space-5 (20px)
Section dividers           space-6 (24px)
Major sections             space-8 (32px)
Page padding (mobile)      space-4 (16px)
Page padding (desktop)     space-6 (24px)
```

### 3.4 Mobile vs Desktop Spacing

```css
/* Mobile baseline (320-768px) */
.section { padding: var(--space-6) var(--space-4); }

/* Tablet (768-1024px) */
@media (min-width: 768px) {
  .section { padding: var(--space-8) var(--space-6); }
}

/* Desktop (1024px+) */
@media (min-width: 1024px) {
  .section { padding: var(--space-12) var(--space-8); }
}
```

**Desktop gets MORE space, not less.**
Rural users on tiny phones need every pixel. Desktop users have screen to spare.

---

## 4. BORDER RADIUS RULES

### 4.1 The Radius Scale

```css
--radius-none:   0;
--radius-sm:     4px;     /* Subtle: badges, tags */
--radius-md:     8px;     /* DEFAULT: buttons, inputs */
--radius-lg:     12px;    /* Cards, panels */
--radius-xl:     16px;    /* Hero cards, modals */
--radius-2xl:    24px;    /* Large hero moments */
--radius-full:   9999px;  /* Pills, avatars */
```

### 4.2 Radius Philosophy

**Soft, but not bubbly.**

```
✅ 8-12px for most things (friendly, modern)
✅ 4px for subtle elements (badges, small chips)
✅ Full circle for avatars only

❌ 24px+ on small elements (looks toy-like)
❌ 0px sharp corners (cold, unfriendly)
❌ Inconsistent radii within same UI level
```

### 4.3 Application Rules

```
ELEMENT                    RADIUS
────────────────────────────────────────────
Avatars                    radius-full (circle)
Pills, status badges       radius-full
Buttons                    radius-md (8px)
Inputs, selects            radius-md (8px)
Cards (default)            radius-lg (12px)
Cards (hero)               radius-xl (16px)
Modals                     radius-xl (16px)
Image previews             radius-md (8px)
Hero images                radius-lg (12px)
Tags, small badges         radius-sm (4px)
Banner sections            radius-2xl (24px) — rare
```

### 4.4 Image Radius Special Case

**Images need careful radius treatment:**

```css
/* Hero images: subtle rounding */
.hero-image { border-radius: var(--radius-lg); }

/* Avatar images: circle */
.avatar { 
  border-radius: var(--radius-full);
  aspect-ratio: 1;
}

/* Product thumbnails: gentle rounding */
.product-thumb { border-radius: var(--radius-md); }

/* List item images: small rounding */
.list-thumb { border-radius: var(--radius-sm); }
```

---

## 5. CARD DESIGN RULES

### 5.1 Card Anatomy

Cards are the workhorse of the interface. Every list, every grid, every result — cards.

```
┌─────────────────────────────────────┐
│  [HERO IMAGE — 16:9 or 4:3]         │   ← Image (optional)
├─────────────────────────────────────┤
│                                      │
│  Business Name              [Badge] │   ← Title row
│  Category · Tag                      │   ← Meta row
│                                      │
│  Short description if needed...     │   ← Body (optional)
│                                      │
│  📍 2.3km · Tân Phú                  │   ← Location row
│  🟢 Đang mở · 6:00–18:00             │   ← Status row
│                                      │
│  [📞 Call]  [💬 Zalo]                │   ← Actions (optional)
│                                      │
└─────────────────────────────────────┘
```

### 5.2 Card Style Specs

```css
.card {
  background: var(--vio-cream-100);
  border: 1px solid var(--vio-stone-100);
  border-radius: var(--radius-lg);
  padding: var(--space-5);
  
  /* Subtle shadow — earned by hovering, not always present */
  box-shadow: none;
  
  /* Transition for hover */
  transition: 
    transform 0.15s ease-out,
    box-shadow 0.15s ease-out,
    border-color 0.15s ease-out;
}

.card:hover {
  border-color: var(--vio-stone-300);
  box-shadow: 0 4px 12px rgba(31, 28, 22, 0.06);
  /* NO transform — feels jittery, doesn't help users */
}

.card:active {
  /* Mobile touch state */
  background: var(--vio-cream-200);
}
```

### 5.3 Card Variants

```
CARD TYPE              USE CASE
────────────────────────────────────────────────
Card.Default           List items, grid items
Card.Hero              Featured business at top of section
Card.Compact           Dense lists (search results)
Card.Map               Map marker preview popup
Card.Action            Settings, dashboard items
```

### 5.4 Card Anti-Patterns

```
❌ Cards with no padding (content touches edges)
❌ Cards with heavy shadows (looks like Web 2.0)
❌ Cards with gradient backgrounds (cluttered)
❌ Cards that scale on hover (jittery)
❌ Cards with corner ribbons (Etsy 2010 style)
❌ Cards with multiple primary actions (confusing)
❌ Cards with hidden actions (revealed on hover)
   → Mobile has no hover; must be visible
```

### 5.5 The Image-Heavy Card

For storefront previews where the hero image is the star:

```
┌─────────────────────────────────────┐
│                                      │
│                                      │
│      [LARGE HERO IMAGE 16:9]        │
│                                      │
│                                      │
├─────────────────────────────────────┤
│  Business Name                       │
│  📍 Tân Phú, Đồng Nai · 2.3km        │
└─────────────────────────────────────┘
```

Minimal text overlay. Image speaks first.

---

## 6. MOBILE-FIRST RULES

### 6.1 Viewport Targets

```
PRIMARY:        320px – 428px   (Most Vietnamese phones)
SECONDARY:      768px           (Tablets, less common)
TERTIARY:       1024px – 1280px (Desktop, business owners using PCs)
ULTRA-WIDE:     1440px+         (Rare, capped at 1280px container)
```

### 6.2 Touch Target Rules

```
MINIMUM TOUCH TARGET:   44px × 44px
COMFORTABLE TARGET:     48px × 48px
PREFERRED FOR PRIMARY:  56px × 56px (CTA buttons)

SPACING BETWEEN TARGETS: minimum 8px
```

### 6.3 Mobile Layout Principles

**ONE PRIMARY ACTION PER SCREEN.**

```
✅ GOOD: Single "Tạo cửa hàng" button
❌ BAD:  3 equal-weight CTAs competing for attention
```

**SCROLL IS NATURAL. AVOID HORIZONTAL SCROLL.**

```
✅ GOOD: Vertical list of business cards
❌ BAD:  Horizontal carousel of cards (users miss content)
```

**THUMB ZONES MATTER.**

```
Primary actions:    Bottom of screen (thumb reach)
Secondary actions:  Top of screen (less convenient)
NEVER:              Tiny targets in corners
```

### 6.4 Mobile Navigation

**NO HAMBURGER MENU FOR PRIMARY NAV.**

Bottom tab bar pattern (when needed):
```
┌─────────────────────────────────┐
│                                  │
│         [PAGE CONTENT]           │
│                                  │
│                                  │
├─────────────────────────────────┤
│  🏠      🔍      📍      👤      │
│  Trang   Tìm    Khu vực  Tôi    │
│  chủ     kiếm                    │
└─────────────────────────────────┘
```

**OR no global nav at all** (link from header logo + breadcrumbs).

For Phase 1, prefer:
- Sticky top header with logo + search icon
- Breadcrumbs for navigation hierarchy
- Footer with all links

### 6.5 Mobile Form Patterns

**ONE INPUT PER SCREEN (for important forms):**

```
┌─────────────────────────────────┐
│  ← Back              Step 3/8   │
│                                  │
│  Tên doanh nghiệp của bạn?       │
│                                  │
│  [_____________________________] │
│                                  │
│                                  │
│                                  │
│  ─────────────────────────────  │
│         [TIẾP TỤC →]             │
└─────────────────────────────────┘
```

For lists of inputs (settings, profile):
- Stack vertically, never side-by-side on mobile
- Labels above inputs (not floating, not inside)
- Generous spacing between (space-4 minimum)
- Use native HTML5 input types (`tel`, `number`, `email`)

### 6.6 Mobile Image Loading

```
✅ Lazy load all below-fold images
✅ Show solid color placeholder (--vio-cream-200) during load
✅ Specify width/height attributes (prevent CLS)
✅ Use WebP with JPEG fallback
✅ Serve appropriate size (don't ship 2000px to 320px screen)

❌ NEVER load full-res images on mobile
❌ NEVER use background-image for content (use <img>)
❌ NEVER skip alt text
```

---

## 7. IMAGE USAGE RULES

### 7.1 Image Philosophy

**Photos are the heart of VIO LOCAL.**

Real photos of real businesses. Real photos of real products. Real photos of real farms and workshops.

```
✅ DO USE:
- Photos of actual businesses
- Photos of actual products/crops
- Photos of business owners (with permission)
- Photos of products in context
- Photos showing scale, season, freshness

❌ DON'T USE:
- Stock photos pretending to be the business
- Generic agriculture stock photos
- AI-generated images
- Watermarked images
- Heavily filtered/edited photos
- Photos under copyright without permission
```

### 7.2 Image Specifications

```
HERO IMAGES (storefront top):
- Aspect ratio: 16:9 or 3:2
- Resolution: 1200 × 800 (display: scaled to viewport)
- File size: < 200KB (WebP) after compression
- Format: WebP primary, JPEG fallback

LIST IMAGES (business cards):
- Aspect ratio: 4:3 or 1:1
- Resolution: 600 × 600 (display: ~300px on mobile)
- File size: < 80KB

THUMBNAIL IMAGES (search results):
- Aspect ratio: 1:1
- Resolution: 300 × 300 (display: ~120px)
- File size: < 30KB

AVATARS:
- Aspect ratio: 1:1
- Resolution: 200 × 200
- File size: < 20KB
- Format: WebP or JPEG
```

### 7.3 Image Treatment

**No heavy filters. No Instagram aesthetic.**

```
✅ Natural color
✅ Subtle contrast enhancement
✅ Proper white balance
✅ Sharp focus on subject

❌ Vintage filters
❌ Saturation boost (looks unnatural)
❌ HDR over-processing
❌ Vignettes
❌ Color overlays
```

### 7.4 Image Placement

**HERO PLACEMENT:**
- Full-width on mobile
- Constrained to container on desktop
- Aspect ratio preserved with `object-fit: cover`
- Subject in upper-third for thumbnail cropping

**CARD PLACEMENT:**
- Top of card
- Fills card width
- Bottom of image touches card content (no gap)
- Border-radius matches card top corners only

**INLINE PLACEMENT:**
- Within prose, max-width = container width
- Caption below image (if needed) in --text-meta
- Center-aligned on mobile, left-aligned on desktop

### 7.5 No-Image Fallback

**When a business has no photos:**

```
Don't show:  Empty grey box
Don't show:  Generic placeholder photo
Don't show:  "No image" text

DO show:
┌─────────────────────────────────┐
│                                  │
│            [ICON]                │
│             🐟                   │
│                                  │
│      Cá Tươi Bà Năm              │
│                                  │
└─────────────────────────────────┘

A large category icon over --vio-cream-200 background.
Dignified, not embarrassing.
```

---

## 8. MARKETPLACE / DISCOVERY LAYOUT RULES

### 8.1 The Anti-Marketplace Layout

**VIO LOCAL is not a marketplace. Don't lay it out like one.**

```
❌ MARKETPLACE LAYOUT (Shopee, Lazada):
- Dense grid of 50 items per screen
- Tiny thumbnails
- Price tags everywhere
- Stars/ratings prominent
- "Add to cart" buttons
- Banner ads, sponsored items

✅ VIO LOCAL LAYOUT:
- 2 columns on mobile, 3 on tablet, 4 on desktop (maximum)
- Generous image space
- Business name + location prominent
- Phone/contact actions (no cart)
- No ratings (Phase 7+ if at all)
- No ads ever
```

### 8.2 List View (Default)

**Mobile (1 column):**
```
┌─────────────────────────────────┐
│  [IMAGE]                         │
│                                  │
│  Cá Tươi Bà Năm                  │
│  Cá tươi · Tân Phú, Đồng Nai     │
│  📍 2.3km · 🟢 Đang mở            │
└─────────────────────────────────┘
                                    
┌─────────────────────────────────┐
│  [IMAGE]                         │
│  ...
```

Generous spacing between cards (space-4 = 16px).

**Tablet (2 columns):**
```
┌──────────────┐  ┌──────────────┐
│  [IMAGE]     │  │  [IMAGE]     │
│              │  │              │
│  Business    │  │  Business    │
│  Name        │  │  Name        │
│  Meta        │  │  Meta        │
└──────────────┘  └──────────────┘
```

**Desktop (3 columns max):**
```
┌──────┐  ┌──────┐  ┌──────┐
│ IMG  │  │ IMG  │  │ IMG  │
│      │  │      │  │      │
│ Name │  │ Name │  │ Name │
│ Meta │  │ Meta │  │ Meta │
└──────┘  └──────┘  └──────┘
```

**Never more than 3 columns.** Cramming 4-5 columns creates marketplace feel.

### 8.3 Map View

**Toggle between List and Map (not split-screen on mobile):**

```
Mobile:
┌─────────────────────────────────┐
│  [Tìm: ___________]   [≡ List]  │
│                                  │
│                                  │
│         [FULL MAP VIEW]          │
│                                  │
│      🟢      🟢                  │
│            🟢                    │
│      🟢                          │
│                                  │
└─────────────────────────────────┘
```

When user taps a marker:
- Small card slides up from bottom
- 50% of screen visible
- "Xem chi tiết" takes them to storefront

### 8.4 Discovery Filters

**Filter bar should be minimal:**

```
┌─────────────────────────────────┐
│                                  │
│  [Danh mục ▼]  [Khoảng cách ▼]  │
│                                  │
└─────────────────────────────────┘
```

**MAXIMUM 3 FILTERS.** More than that overwhelms.

Defer advanced filters to Phase 7+:
- Price range
- Open now
- Has photos
- Verified
- Has products

For Phase 1-3: just category and distance.

### 8.5 Empty States

**Never show "No results" alone.**

```
┌─────────────────────────────────┐
│                                  │
│           [LARGE ICON]           │
│              🌾                  │
│                                  │
│   Chưa có kết quả phù hợp        │
│                                  │
│   Thử mở rộng khoảng cách        │
│   hoặc xem các danh mục khác.    │
│                                  │
│   [Xem tất cả danh mục →]        │
│                                  │
└─────────────────────────────────┘
```

Always provide an action. Never dead-end the user.

---

## 9. STOREFRONT LAYOUT RULES

### 9.1 Storefront Anatomy

```
┌─────────────────────────────────┐
│  ← Tân Phú       Chia sẻ  Lưu  │   ← Header (sticky)
├─────────────────────────────────┤
│                                  │
│                                  │
│      [HERO IMAGE 16:9]          │
│                                  │
│                                  │
├─────────────────────────────────┤
│                                  │
│  Cá Tươi Bà Năm                  │   ← Business name (H1)
│  Cá tươi · Tân Phú, Đồng Nai     │   ← Category · Location
│                                  │
│  🟢 Đang mở · Đóng 18:00         │   ← Status
│                                  │
├─────────────────────────────────┤
│  [📞 Gọi]  [💬 Zalo]  [📍 Đường] │   ← Quick actions (sticky)
├─────────────────────────────────┤
│                                  │
│  Cá sông tươi sống, nuôi tự      │   ← Tagline / About
│  nhiên từ sông Đồng Nai...       │
│                                  │
├─────────────────────────────────┤
│                                  │
│  Sản phẩm                        │   ← Products section (H2)
│                                  │
│  ┌──────┐  ┌──────┐             │
│  │      │  │      │             │
│  │ Cá rô│  │ Cá lóc │            │
│  └──────┘  └──────┘             │
│                                  │
├─────────────────────────────────┤
│                                  │
│  Thông tin liên hệ               │   ← Contact info
│                                  │
│  📞 0912 345 678                 │
│  💬 zalo.me/0912345678           │
│  📍 Ấp 3, Xã Tân Phú             │
│       Huyện Tân Phú, Đồng Nai    │
│                                  │
├─────────────────────────────────┤
│                                  │
│  Giờ mở cửa                      │   ← Hours
│                                  │
│  Thứ 2–6   6:00 – 18:00          │
│  Thứ 7     6:00 – 17:00          │
│  Chủ nhật  Nghỉ                  │
│                                  │
├─────────────────────────────────┤
│                                  │
│        [MAP PREVIEW]             │   ← Map
│                                  │
├─────────────────────────────────┤
│                                  │
│  Doanh nghiệp khác tại Tân Phú   │   ← Related businesses
│  [Cards...]                       │
│                                  │
└─────────────────────────────────┘
```

### 9.2 Storefront Principles

**1. Hero image is the introduction.**
Large, beautiful, real. Sets the tone.

**2. Contact is one tap away.**
Phone/Zalo/Directions visible without scrolling on mobile.

**3. Hours are honest.**
"Open now" indicator. Closed days clearly marked.

**4. Address is precise.**
Full Vietnamese address hierarchy.

**5. Map shows location.**
Preview map, tappable for full screen.

**6. Related businesses keep users on the platform.**
Same district, same category. Builds the graph.

### 9.3 Sticky Action Bar

**On mobile, action buttons stick at the top after scrolling past hero:**

```
┌─────────────────────────────────┐
│ Cá Tươi Bà Năm                  │
│ [📞 Gọi]  [💬 Zalo]  [📍 Đường] │   ← Sticky after scroll
├─────────────────────────────────┤
│                                  │
│   [page content scrolls here]    │
│                                  │
```

Always one tap from any point on the page to making contact.

### 9.4 Information Density

**Storefront pages should not be busy.**

```
✅ DO:
- Generous whitespace between sections (space-8 = 32px)
- Clear section headings (H2)
- Bullet points for hours, contacts
- Limit to 6-8 products visible (with "Xem thêm")

❌ DON'T:
- Show all 30 products at once
- Cram sections together
- Add accordion menus (use sections)
- Add tabs (use sections — scroll is natural)
- Add modal popups for any info
```

### 9.5 No Sidebar on Desktop

**Single-column layout, even on desktop.**

```
✅ GOOD:
┌──────────────────────────────────────────────┐
│                                               │
│           [CENTERED CONTENT]                  │
│           Max-width: 720px                    │
│                                               │
└──────────────────────────────────────────────┘

❌ BAD:
┌──────────────┐  ┌────────────────────────────┐
│  Sidebar     │  │  Main content              │
│  with        │  │                            │
│  related     │  │                            │
│  ads/info    │  │                            │
└──────────────┘  └────────────────────────────┘
```

Storefronts read like editorial pages. Single column. Generous margins.

---

## 10. DASHBOARD SIMPLICITY RULES

### 10.1 The Anti-Dashboard Dashboard

**Business owners are not analysts. They want to know:**
1. Is my business still showing?
2. Did anyone view it today?
3. Did anyone contact me?

**That's it.** No charts. No widgets. No KPIs.

### 10.2 Dashboard Layout

```
┌─────────────────────────────────┐
│                                  │
│  Xin chào, Bà Năm 👋             │
│                                  │
├─────────────────────────────────┤
│                                  │
│  Cửa hàng của bạn                │
│                                  │
│  ┌─────────────────────────┐    │
│  │  [IMAGE]                 │    │
│  │  Cá Tươi Bà Năm          │    │
│  │  ● Đang hiển thị         │    │
│  │                          │    │
│  │  [Quản lý]               │    │
│  └─────────────────────────┘    │
│                                  │
├─────────────────────────────────┤
│                                  │
│  Thống kê 7 ngày qua             │
│                                  │
│  ┌──────────┐  ┌──────────┐    │
│  │   147    │  │    12    │    │
│  │  Lượt    │  │  Lượt    │    │
│  │  xem     │  │  liên hệ │    │
│  └──────────┘  └──────────┘    │
│                                  │
├─────────────────────────────────┤
│                                  │
│  Hành động nhanh                 │
│                                  │
│  📷 Cập nhật ảnh                 │
│  📝 Sửa thông tin                │
│  🛒 Thêm sản phẩm                │
│  📊 Xem chi tiết thống kê        │
│                                  │
└─────────────────────────────────┘
```

**Two numbers. Four actions. That's the dashboard.**

### 10.3 What's Forbidden in the Dashboard

```
❌ Sparkline charts everywhere
❌ "Conversion funnels"
❌ Time-series graphs
❌ Heat maps
❌ Comparison percentages ("23% vs last week")
❌ Multiple KPI cards in a row
❌ Customizable widget grid
❌ "Insights" with AI-generated text
❌ Notification badges with red dots
❌ Anything that looks like Google Analytics
```

### 10.4 Settings Pages

**Settings pages: lists, not panels.**

```
┌─────────────────────────────────┐
│                                  │
│  Cài đặt                         │
│                                  │
├─────────────────────────────────┤
│                                  │
│  📝 Thông tin doanh nghiệp   →  │
│                                  │
├─────────────────────────────────┤
│                                  │
│  📷 Ảnh & Phương tiện        →  │
│                                  │
├─────────────────────────────────┤
│                                  │
│  📞 Thông tin liên hệ        →  │
│                                  │
├─────────────────────────────────┤
│                                  │
│  🕐 Giờ mở cửa               →  │
│                                  │
├─────────────────────────────────┤
│                                  │
│  📍 Địa chỉ                  →  │
│                                  │
├─────────────────────────────────┤
│                                  │
│  📞 Tài khoản                →  │
│                                  │
└─────────────────────────────────┘
```

Each settings item is its own page. No tabs. No accordions. No modals.

### 10.5 Analytics Page (Phase 6+)

When analytics are added (post-MVP), keep it simple:

```
┌─────────────────────────────────┐
│  ← Quay lại                      │
│                                  │
│  Thống kê                        │
│                                  │
├─────────────────────────────────┤
│                                  │
│  Lượt xem cửa hàng               │
│                                  │
│  ┌─────────────────────────┐    │
│  │                          │    │
│  │   [SIMPLE LINE CHART]    │    │
│  │   30 days                │    │
│  │                          │    │
│  └─────────────────────────┘    │
│                                  │
│  Tổng: 1,234 lượt xem            │
│                                  │
├─────────────────────────────────┤
│                                  │
│  Phương thức liên hệ phổ biến    │
│                                  │
│  📞 Gọi điện thoại     67 lần   │
│  💬 Zalo               45 lần   │
│  📍 Chỉ đường          23 lần   │
│                                  │
└─────────────────────────────────┘
```

ONE chart (line). LIST of contact methods. NO MORE.

---

## 11. BUTTON SYSTEM

### 11.1 Button Hierarchy

```
PRIMARY:    Bold action ("Tạo cửa hàng", "Gọi ngay")
SECONDARY:  Supporting action ("Hủy", "Chia sẻ")
TERTIARY:   Subtle action ("Xem thêm", "Đọc thêm")
DESTRUCTIVE: Dangerous action ("Xóa")
```

### 11.2 Button Specs

**PRIMARY:**
```css
.btn-primary {
  background: var(--vio-green-600);
  color: var(--vio-cream-50);
  padding: 14px 24px;
  border-radius: var(--radius-md);
  font-size: 16px;
  font-weight: 600;
  min-height: 48px;
  border: none;
  transition: background 0.15s ease-out;
}

.btn-primary:hover  { background: var(--vio-green-700); }
.btn-primary:active { background: var(--vio-green-700); transform: scale(0.98); }
```

**SECONDARY:**
```css
.btn-secondary {
  background: var(--vio-cream-100);
  color: var(--vio-stone-900);
  border: 1px solid var(--vio-stone-300);
  /* same dimensions */
}

.btn-secondary:hover { 
  background: var(--vio-stone-100);
  border-color: var(--vio-stone-500);
}
```

**TERTIARY (Text-only):**
```css
.btn-tertiary {
  background: transparent;
  color: var(--vio-green-700);
  padding: 8px 12px;
  font-weight: 500;
  text-decoration: underline;
  text-underline-offset: 2px;
}
```

### 11.3 Button Rules

```
✅ DO:
- Make primary buttons obvious (full color, bold weight)
- Use only one primary button per screen
- Touch targets minimum 48px tall
- Use Vietnamese verbs ("Lưu", "Gửi", "Tạo")

❌ DON'T:
- Use ALL CAPS button text
- Use icons without labels (unless universally understood)
- Use buttons that look like links (or vice versa)
- Use ghost buttons with thin borders (poor visibility outdoors)
- Animate buttons on hover (jittery)
- Use loading spinners inside buttons (use skeleton states elsewhere)
```

### 11.4 Icon Buttons

For action bars (Call, Zalo, Directions):

```
┌────────────┐
│            │
│    📞      │     ← 48 × 48px minimum
│   Gọi      │     ← Label below icon
│            │
└────────────┘
```

Icon + label. Never icon alone for primary actions.

---

## 12. FORMS

### 12.1 Form Layout

**One column. Always.**

```
✅ GOOD:
[Label]
[Input]

[Label]
[Input]

❌ BAD:
[Label] [Input]   [Label] [Input]
[Label] [Input]   [Label] [Input]
```

Even on desktop, forms remain single-column. Easier scanning, faster filling.

### 12.2 Input Specs

```css
.input {
  height: 48px;
  padding: 0 16px;
  background: var(--vio-cream-50);
  border: 1px solid var(--vio-stone-300);
  border-radius: var(--radius-md);
  font-size: 16px;  /* Prevents iOS zoom */
  color: var(--vio-stone-900);
  transition: border-color 0.15s ease-out;
}

.input:focus {
  border-color: var(--vio-green-500);
  outline: 2px solid var(--vio-green-100);
  outline-offset: 0;
}

.input::placeholder {
  color: var(--vio-stone-500);
}

.input.error {
  border-color: var(--vio-error-500);
}
```

### 12.3 Labels

**Labels above inputs.**

```
✅ Tên doanh nghiệp
   [_____________________]

❌ [Tên doanh nghiệp _____]  (placeholder as label — disappears)
❌ Tên doanh nghiệp [_____]  (side label — wastes space on mobile)
```

### 12.4 Validation Messages

**Inline, below input, in error color:**

```
Tên doanh nghiệp
[_____________________]
✕ Tên phải có ít nhất 3 ký tự
```

```css
.input-error-msg {
  color: var(--vio-error-700);
  font-size: 14px;
  margin-top: 4px;
}
```

---

## 13. ANIMATION RULES

### 13.1 Animation Philosophy

**Earned, not gratuitous.**

```
✅ ALLOWED:
- Subtle state transitions (color change on hover, 150ms)
- Page transitions (fade, 200ms)
- Skeleton → content reveal (opacity, 300ms)
- Bottom sheets sliding up (300ms)
- Image lazy load fade-in (200ms)

❌ FORBIDDEN:
- Bouncing buttons
- Spinning loaders (use skeletons)
- Parallax scrolling
- Animated illustrations
- Particle effects
- Hover scale on cards
- Auto-playing videos
- Animated icons
- Scroll-triggered animations
- Lottie animations
```

### 13.2 Animation Specs

```css
--duration-instant: 100ms;   /* Button press */
--duration-fast:    150ms;   /* Color transitions */
--duration-normal:  200ms;   /* Page transitions */
--duration-slow:    300ms;   /* Bottom sheets */

--ease-out: cubic-bezier(0.0, 0.0, 0.2, 1);
--ease-in-out: cubic-bezier(0.4, 0.0, 0.2, 1);

/* Default for everything: */
transition: all var(--duration-fast) var(--ease-out);
```

### 13.3 Loading States

**Use skeleton screens, not spinners.**

```
┌─────────────────────────────────┐
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
│  ░░░░░░░░░░░░░░░░░░░░░░░░░░░░  │
│                                  │
│  ░░░░░░░░░░░░░░                  │
│  ░░░░░░░░░░░░░░░░░░░             │
└─────────────────────────────────┘
```

Skeleton blocks pulse subtly (opacity 0.6 → 1.0 → 0.6, 1.5s loop).

### 13.4 Reduced Motion Support

```css
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```

Respect user preferences. Always.

---

## 14. ICONOGRAPHY

### 14.1 Icon System

**Use Lucide React.** Open source, consistent style, tree-shakeable.

```
PREFERRED ICONS:
- Phone        (call action)
- MessageCircle (chat/Zalo)
- MapPin       (location)
- Clock        (hours)
- Calendar     (date)
- Camera       (upload photo)
- Search       (search)
- Filter       (filters)
- ChevronRight (navigation)
- ArrowLeft    (back)
- Share        (share)
- ExternalLink (external link)
- Check        (success)
- X            (close/error)
- AlertCircle  (warning)
```

### 14.2 Icon Sizing

```
SMALL:   16px  (inline with text)
MEDIUM:  20px  (in buttons, list items)
LARGE:   24px  (standalone, navigation)
XL:      32px  (empty states, hero moments)
```

### 14.3 Icon Style Rules

```
✅ DO:
- Use line icons (stroke-based, 2px width)
- Match icon color to surrounding text
- Use alt text or aria-label for accessibility

❌ DON'T:
- Mix line and filled icons
- Use colored/multicolor icons
- Use icons larger than 32px in UI (use illustrations instead)
- Use animated icons
```

---

## 15. EMPTY STATES & ERRORS

### 15.1 Empty State Pattern

**Always have:**
1. A friendly illustration or large icon
2. A clear message
3. A constructive action

```
┌─────────────────────────────────┐
│                                  │
│              [ICON]              │
│               📷                 │
│                                  │
│   Chưa có ảnh nào                │
│                                  │
│   Thêm ảnh để khách hàng có      │
│   thể thấy doanh nghiệp của bạn  │
│                                  │
│   [+ Thêm ảnh đầu tiên]          │
│                                  │
└─────────────────────────────────┘
```

### 15.2 Error State Pattern

**Honest, helpful, actionable:**

```
┌─────────────────────────────────┐
│                                  │
│              [ICON]              │
│               ⚠️                  │
│                                  │
│   Không thể tải dữ liệu          │
│                                  │
│   Kết nối mạng không ổn định.    │
│   Vui lòng kiểm tra và thử lại.  │
│                                  │
│   [Thử lại]                      │
│                                  │
└─────────────────────────────────┘
```

NEVER:
- "Error 500"
- "Something went wrong" (too generic)
- "Internal server error"
- Stack traces visible

---

## 16. COMPONENT INVENTORY (PHASE 1)

These are the components needed for Phase 1 MVP. Build NO MORE than these.

```
PRIMITIVES (UI building blocks):
├── Button (primary, secondary, tertiary, icon)
├── Input (text, tel, number, textarea)
├── Select (native dropdown)
├── Card (default, compact, hero)
├── Avatar
├── Badge (status, category)
├── Icon (wrapper for Lucide)
├── Image (with lazy loading, placeholder)
├── Skeleton (loading state)
├── Spinner (only for inline button loading)
├── Link (styled anchor)

COMPOSITE:
├── BusinessCard (used in lists, search results)
├── ContactButton (Call, Zalo, Directions)
├── HoursDisplay
├── AddressDisplay
├── MapPreview (small embedded map)
├── PhotoGallery (basic, swipeable)
├── ProductCard (in storefront grid)

LAYOUT:
├── Container (max-width wrapper)
├── Section (with consistent spacing)
├── Header (sticky top nav)
├── Footer
├── Breadcrumb
├── EmptyState
├── ErrorBoundary

FORMS:
├── FormField (label + input + error)
├── FormSection
├── StepIndicator (for wizard)
├── PhotoUpload

NAVIGATION:
├── BackButton
├── StickyActionBar (storefront actions)
```

**NOTHING ELSE IN PHASE 1.**

---

## 17. ACCESSIBILITY

### 17.1 Mandatory Requirements

```
✅ Semantic HTML (use <button>, not <div onClick>)
✅ Color contrast ≥ 4.5:1 for body text
✅ Touch targets ≥ 44px
✅ Focus visible on all interactive elements
✅ Alt text on all images
✅ ARIA labels on icon-only buttons
✅ Keyboard navigation works
✅ Forms have proper labels (not just placeholders)
✅ Errors announced to screen readers
✅ Reduced motion support
```

### 17.2 Vietnamese-Specific Accessibility

```
✅ Use lang="vi" on HTML element
✅ Test with Vietnamese screen readers (NVDA + Vietnamese voice)
✅ Test with Vietnamese keyboard layouts
✅ Ensure diacritics don't break reading flow
✅ Don't rely on font features that ignore Vietnamese
```

---

## 18. PERFORMANCE BUDGETS

### 18.1 UI Performance

```
INITIAL PAGE LOAD:
├── First Contentful Paint:   < 1.5s on slow 4G
├── Largest Contentful Paint: < 2.5s on slow 4G
├── Time to Interactive:      < 3.5s on slow 4G
└── Cumulative Layout Shift:  < 0.1

INTERACTION:
├── Tap response:             < 100ms (feels instant)
├── Page transition:          < 200ms
└── Search response:          < 500ms

ASSETS:
├── Initial JS bundle:        < 150KB gzipped
├── Initial CSS:              < 50KB gzipped
├── Hero image:               < 200KB
└── Card thumbnails:          < 80KB each
```

### 18.2 No Render-Blocking Resources

```
✅ Critical CSS inlined
✅ Fonts: font-display: swap
✅ JavaScript: defer or async (no render-blocking)
✅ Images: lazy load below the fold
✅ Third-party scripts: minimized, async
```

---

## 19. FINAL CHECKLIST

Before any UI ships, verify:

```
DESIGN:
☐ Uses approved color palette only
☐ Typography follows scale
☐ Spacing follows 4px grid
☐ Border radii are consistent
☐ No forbidden patterns (carousels, hover-only, etc.)

MOBILE:
☐ Works on 320px width
☐ Touch targets ≥ 44px
☐ Body text ≥ 16px
☐ No horizontal scroll
☐ Single column layouts

ACCESSIBILITY:
☐ Semantic HTML
☐ Color contrast passes WCAG AA
☐ Keyboard navigable
☐ Screen reader friendly
☐ Reduced motion respected

PERFORMANCE:
☐ Images optimized
☐ No unnecessary animations
☐ Bundle size within budget
☐ No render-blocking resources

CONTENT:
☐ Vietnamese language correct
☐ Real photos (no stock)
☐ No placeholder text in production
☐ Empty states have actions
☐ Errors are helpful
```

---

## 20. FINAL DIRECTIVES

### 20.1 The Soul of the UI

**Every screen should feel like:**
- A trusted local newspaper page
- A well-organized phone book
- A friendly storefront window
- A clear map you can read

**No screen should feel like:**
- A Shopee homepage
- A SaaS analytics dashboard  
- A trendy startup landing page
- A casino interface

### 20.2 The Test

If a 65-year-old rural Vietnamese farmer can:
1. Find their business listing
2. Update their phone number
3. See if anyone called

In under 2 minutes, on their feature-phone-replacement Android, with their reading glasses, in bright sunlight outdoors...

**The UI works.**

### 20.3 The Restraint

**This UI succeeds through restraint, not addition.**

```
Every animation removed = better
Every gradient removed = better
Every shadow removed = better  
Every widget removed = better
Every notification removed = better
Every modal removed = better
```

When in doubt: **don't add it.**

---

**END OF UI SYSTEM v1.0**

*This UI is not designed to impress. It is designed to work. For a farmer in Đồng Nai. For a workshop owner in Bình Phước. For a household business in Bến Tre. They deserve professional, dignified design — not Silicon Valley trends.*