# VIO LOCAL — MASTER RULES
**Version 1.0 | Hyperlocal Commerce Infrastructure for Rural Vietnam**

---

## 0. PLATFORM IDENTITY

**VIO LOCAL IS:**
- A hyperlocal commerce discovery platform for rural Vietnam
- A digital identity layer for household businesses, farmers, and local producers
- A hyperlocal SEO infrastructure that makes rural businesses Google-discoverable
- A social-commerce-ready storefront network
- A public directory with structured business data

**VIO LOCAL IS NOT:**
- ❌ A marketplace (not Shopee/Lazada/TikTok Shop)
- ❌ A classifieds website (not Chotot/Facebook Marketplace)
- ❌ A transaction platform (no checkout, no cart, no payments)
- ❌ A social network (no feeds, no likes, no following)
- ❌ An inventory management system
- ❌ A logistics platform

**CORE TRUTH:**
> "We help rural businesses be found, not sell online. We are infrastructure, not a storefront."

---

## 1. PLATFORM PHILOSOPHY

### 1.1 The Problem We Solve
Rural Vietnamese businesses exist but are invisible:
- Household producers have no digital presence
- Farmers sell through middlemen because buyers can't find them
- Local workshops rely on word-of-mouth in a 5km radius
- Agricultural businesses have no way to be discovered online
- Social commerce happens on personal Facebook pages with zero SEO

**VIO LOCAL creates persistent, discoverable, public digital identities for these businesses.**

### 1.2 Core Value Propositions

**For Businesses:**
1. **Hyperlocal SEO Presence** — Google-discoverable storefronts with structured data
2. **Public Storefront** — Professional business page with contact info, products, location
3. **Social Commerce Bridge** — QR codes and shareable links for Facebook/Zalo commerce
4. **Zero Technical Barrier** — SMS-first onboarding, mobile-only operation
5. **Free Digital Identity** — No subscription, no transaction fees, no gatekeeping

**For Consumers:**
1. **Local Discovery** — Find nearby producers, workshops, services by location/product
2. **Direct Contact** — Phone numbers, Zalo, Facebook direct to business owner
3. **Verified Business Info** — Structured data: hours, location, products, certifications
4. **Hyperlocal Search** — "cá tươi gần đây" → fish farms within 10km
5. **Community Trust Signals** — Business registration, years in operation, location verification

### 1.3 Business Model Philosophy

**FREE TIER (Phase 1):**
- Business listing creation
- Public storefront hosting
- Hyperlocal SEO optimization
- Basic analytics
- Mobile-first management

**NO TRANSACTION FEES. EVER.**
- We don't touch money flow
- We don't facilitate transactions
- We don't charge per listing/product
- We don't extract rent from commerce

**FUTURE REVENUE (Phase 2+):**
- Premium SEO features (featured listings, top-of-search)
- Advanced analytics (customer insights, traffic patterns)
- Marketing tools (bulk SMS, targeted promotions)
- API access for regional cooperatives/aggregators
- White-label solutions for province governments

---

## 2. ARCHITECTURE PHILOSOPHY

### 2.1 Core Principles

**1. MOBILE-FIRST, MOBILE-ONLY**
```
Design Order:
1. Mobile (320px-428px) — PRIMARY
2. Tablet (768px-1024px) — SECONDARY
3. Desktop (1280px+) — TERTIARY

Mobile is not a "responsive version." Desktop is a "bonus view."
```

**2. PROGRESSIVE DISCLOSURE**
- Show essentials first, hide complexity
- Every screen should answer: "What can I do here?"
- No feature should require >3 taps to access

**3. OFFLINE-FIRST MINDSET**
- Assume intermittent connectivity
- Cache aggressively
- Queue actions, sync when online
- Never block UI on network requests

**4. STATELESS WHERE POSSIBLE**
- Avoid session dependencies
- Use JWT tokens, not server sessions
- Let clients own their state
- Server validates, doesn't remember

**5. DATA SOVEREIGNTY**
- Businesses own their data
- Export at any time (CSV, JSON)
- Delete at any time (right to erasure)
- No lock-in, no data hostage

### 2.2 Technology Stack

**BACKEND:**
- **Language:** Node.js (TypeScript)
- **Framework:** Express.js or Fastify (lightweight, not NestJS)
- **Database:** PostgreSQL + PostGIS (geographic queries are core)
- **Cache:** Redis (sessions, rate limiting, hot data)
- **Storage:** S3-compatible (images, business documents)
- **Search:** Elasticsearch or Meilisearch (Vietnamese text + geographic)
- **Queue:** BullMQ (SMS sending, batch operations)

**FRONTEND:**
- **Framework:** Next.js 14+ (App Router, RSC)
- **Styling:** Tailwind CSS (mobile-first utilities)
- **State:** Zustand (simple, not Redux)
- **Forms:** React Hook Form + Zod (validation)
- **Maps:** Google Maps JavaScript API (Vietnamese POI support)
- **Icons:** Lucide React (tree-shakeable)

**INFRASTRUCTURE:**
- **Hosting:** Vercel (frontend) + Railway/Fly.io (backend)
- **CDN:** Cloudflare (Vietnam edge nodes)
- **SMS:** VIETGUYS or VIETTEL SMS Gateway
- **Monitoring:** Sentry (errors) + Plausible (privacy-friendly analytics)

### 2.3 Data Architecture

**CORE ENTITIES:**
```
Business (Storefront)
├── Owner (User)
├── Location (Address + Coordinates)
├── Products (Catalog Items)
├── OperatingHours
├── ContactMethods (Phone, Zalo, Facebook)
├── Media (Photos, Videos)
└── Certifications (Optional)

User (Business Owner)
├── Phone Number (Primary Identity)
├── SMS Verification
├── Owned Businesses (1:many)
└── Sessions (JWT tokens)

Product (Catalog Item)
├── Name, Description
├── Category, Tags
├── Price Range (Optional)
├── Availability Status
├── Photos
└── Seasonal Indicators

GeographicHierarchy
├── Province (Tỉnh)
├── District (Huyện)
├── Ward/Commune (Xã/Phường)
└── Village/Hamlet (Thôn/Ấp)
```

**DATABASE SCHEMA RULES:**
1. Use `bigserial` for IDs (future-proof)
2. Use `jsonb` for flexible metadata (certifications, social links)
3. Use `geography(Point, 4326)` for coordinates (PostGIS)
4. Index heavily: `phone_number`, `location`, `category`, `status`
5. Soft deletes: `deleted_at timestamp` (never hard delete businesses)
6. Audit trails: `created_at`, `updated_at`, `created_by`, `updated_by`

### 2.4 API Design

**RESTful Principles:**
```
GET    /api/businesses?lat=X&lng=Y&radius=10km  # Discover nearby
GET    /api/businesses/:slug                     # View storefront
POST   /api/businesses                           # Create (auth required)
PATCH  /api/businesses/:id                       # Update (owner only)
DELETE /api/businesses/:id                       # Soft delete

GET    /api/businesses/:id/products              # List products
POST   /api/businesses/:id/products              # Add product
PATCH  /api/products/:id                         # Update product
```

**RESPONSE FORMAT:**
```json
{
  "success": true,
  "data": { ... },
  "meta": {
    "page": 1,
    "perPage": 20,
    "total": 156
  }
}

// Errors:
{
  "success": false,
  "error": {
    "code": "BUSINESS_NOT_FOUND",
    "message": "Không tìm thấy cửa hàng",
    "details": { "businessId": "123" }
  }
}
```

**AUTHENTICATION:**
- SMS-based OTP for login (no passwords)
- JWT tokens (7-day expiry, sliding window)
- Rate limiting: 5 login attempts per phone per hour
- No OAuth, no social login (friction for rural users)

### 2.5 File Storage

**IMAGE HANDLING:**
- Max upload: 5MB per image
- Accepted formats: JPEG, PNG, WebP
- Auto-resize to: 1200px (original), 600px (thumbnail), 300px (list view)
- CDN delivery with Vietnamese edge caching
- Lazy loading: `loading="lazy"` + intersection observer

**STORAGE STRUCTURE:**
```
/businesses/{businessId}/
  /storefront/       # Main storefront photos
  /products/         # Product photos
  /documents/        # Certifications, licenses (PDF)
```

---

## 3. UI/UX PHILOSOPHY

### 3.1 Design Principles

**1. BRUTALLY SIMPLE**
- If a feature needs explanation, it's too complex
- Every button should be obvious
- No hamburger menus (put critical actions in view)
- No carousels (users don't swipe, they tap the first thing they see)

**2. INFORMATION HIERARCHY**
```
Priority 1: What business does (category, main product)
Priority 2: Where it is (map, address)
Priority 3: How to contact (phone, Zalo button)
Priority 4: Everything else (hours, history, certifications)
```

**3. CULTURALLY APPROPRIATE**
- Vietnamese language first (no English fallback needed)
- Use familiar metaphors: "Cửa hàng" not "Store", "Sản phẩm" not "Products"
- Show prices in VND (never USD, never with decimals)
- Phone numbers formatted: 0912 345 678 (spaces, no dashes)

**4. ACCESSIBILITY**
- Touch targets: minimum 44px × 44px
- Font size: minimum 16px (never smaller)
- Color contrast: WCAG AA minimum (4.5:1 for text)
- No color-only indicators (add icons)

### 3.2 Mobile-First Components

**STOREFRONT PAGE ANATOMY:**
```
[Hero Image]                    ← Full width, 16:9 ratio
[Business Name + Category]      ← H1, 24px bold
[Quick Actions Bar]             ← Call | Zalo | Directions (3 buttons)
[Map Preview]                   ← Small map, tappable for full view
[Operating Hours]               ← Expandable if long
[Products Grid]                 ← 2-column grid, 4-6 items max
[About Section]                 ← Collapsible long text
[Contact Info]                  ← Phone, Facebook, Zalo (icons + text)
```

**SEARCH/DISCOVERY PAGE:**
```
[Search Bar]                    ← Autocomplete, category filter
[Map View Toggle]               ← Switch: List ↔ Map
[Results List]
  ├─ [Business Card]            ← Photo, Name, Distance, Category
  ├─ [Business Card]
  └─ [Load More]
```

**BUSINESS CARD (List View):**
```
┌─────────────────────────────────┐
│ [Photo]  Business Name          │
│  80×80   Category Tag           │
│          ⭐ 2.3km away           │
│          📞 0912 345 678         │
└─────────────────────────────────┘
```

### 3.3 Color Palette

**PRIMARY COLORS:**
```css
--vio-green-primary: #16a34a;    /* Trust, growth, agriculture */
--vio-green-dark: #15803d;       /* Hover states */
--vio-green-light: #22c55e;      /* Success states */
```

**SEMANTIC COLORS:**
```css
--vio-blue-info: #3b82f6;        /* Information, links */
--vio-yellow-warning: #f59e0b;   /* Warnings, attention */
--vio-red-error: #ef4444;        /* Errors, destructive actions */
--vio-gray-text: #374151;        /* Body text */
--vio-gray-border: #d1d5db;      /* Dividers, borders */
--vio-gray-bg: #f3f4f6;          /* Page background */
```

### 3.4 Typography

**FONT STACK:**
```css
font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', 
             'Roboto', 'Helvetica Neue', Arial, sans-serif;
```

**SCALE:**
```css
--text-xs: 12px;    /* Captions, meta info */
--text-sm: 14px;    /* Secondary text */
--text-base: 16px;  /* Body text (MINIMUM) */
--text-lg: 18px;    /* Emphasized text */
--text-xl: 20px;    /* Section headers */
--text-2xl: 24px;   /* Page titles */
--text-3xl: 30px;   /* Hero text */
```

**NO FONTS BELOW 16PX FOR BODY TEXT.**

### 3.5 Interaction Patterns

**BUTTONS:**
```tsx
// Primary Action (Call to action)
<button className="bg-vio-green-primary text-white px-6 py-3 rounded-lg 
                   text-base font-semibold active:scale-95">
  Tạo cửa hàng
</button>

// Secondary Action
<button className="border border-vio-gray-border text-vio-gray-text 
                   px-6 py-3 rounded-lg">
  Hủy bỏ
</button>

// Icon Button (Quick actions)
<button className="w-12 h-12 rounded-full bg-vio-blue-info text-white">
  <PhoneIcon />
</button>
```

**LOADING STATES:**
- Use skeleton screens (not spinners)
- Show content structure immediately
- Progressive rendering (hero → details → products)

**ERROR STATES:**
- Always actionable (show "Thử lại" button)
- Never show raw error codes to users
- Vietnamese error messages only

---

## 4. SEO PHILOSOPHY

### 4.1 Hyperlocal SEO Strategy

**GOAL:** When someone in rural Đồng Nai searches "cá tươi gần đây" (fresh fish nearby), VIO LOCAL businesses appear on Google Maps and organic search.

**STRUCTURED DATA (Schema.org):**
Every storefront page must include:
```html
<script type="application/ld+json">
{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "Cá Tươi Bà Năm",
  "description": "Cá tươi sông Đồng Nai, nuôi tự nhiên",
  "address": {
    "@type": "PostalAddress",
    "streetAddress": "Ấp 3, Xã Tân Phú",
    "addressLocality": "Huyện Tân Phú",
    "addressRegion": "Tỉnh Đồng Nai",
    "postalCode": "76000",
    "addressCountry": "VN"
  },
  "geo": {
    "@type": "GeoCoordinates",
    "latitude": 10.8231,
    "longitude": 107.1921
  },
  "telephone": "+84912345678",
  "openingHours": "Mo-Su 06:00-18:00",
  "priceRange": "₫₫",
  "image": "https://violocal.vn/businesses/ca-tuoi-ba-nam/hero.jpg"
}
</script>
```

**URL STRUCTURE:**
```
violocal.vn/dong-nai/tan-phu/ca-tuoi-ba-nam
            └─province─┴─district─┴─business-slug

SEO Benefits:
- Geographic hierarchy in URL
- Vietnamese slug (Google understands Vietnamese)
- Breadcrumb-ready structure
```

**META TAGS (Every storefront page):**
```html
<title>Cá Tươi Bà Năm - Tân Phú, Đồng Nai | VIO LOCAL</title>
<meta name="description" content="Cá tươi sông Đồng Nai nuôi tự nhiên. 
      Cung cấp cá rô, cá trê, cá lóc tươi sống tại Ấp 3, Xã Tân Phú. 
      Gọi 0912 345 678.">
<meta name="keywords" content="cá tươi, cá sông, Đồng Nai, Tân Phú, 
      cá rô, cá trê">
<link rel="canonical" href="https://violocal.vn/dong-nai/tan-phu/ca-tuoi-ba-nam">
```

**SITEMAP STRATEGY:**
- Generate `sitemap.xml` dynamically
- Include all public storefronts
- Update frequency: daily (new businesses)
- Priority: 0.8 for businesses, 1.0 for category/location pages

### 4.2 Vietnamese SEO Optimization

**VIETNAMESE TEXT SEARCH:**
- Normalize Unicode (NFD vs NFC) before indexing
- Handle tone marks: "ca" vs "cá" vs "cả"
- Support common misspellings: "ca tuoi" → "cá tươi"
- Synonym expansion: "cửa hàng" = "cửa tiệm" = "quán"

**CATEGORY TAXONOMY:**
```
Nông nghiệp (Agriculture)
├── Cá tươi (Fresh fish)
├── Rau sạch (Clean vegetables)
├── Trái cây (Fruits)
└── Gia súc (Livestock)

Thủ công mỹ nghệ (Handicrafts)
├── Gốm sứ (Pottery)
├── Mây tre đan (Bamboo weaving)
└── Thêu thùa (Embroidery)

Dịch vụ (Services)
├── Sửa xe (Vehicle repair)
├── Thợ điện (Electrician)
└── Thợ hàn (Welding)
```

**LOCATION HIERARCHY:**
```
Vietnam
├── Tỉnh Đồng Nai (Province)
│   ├── Huyện Tân Phú (District)
│   │   ├── Xã Tân Phú (Commune)
│   │   │   └── Ấp 3 (Hamlet)
│   │   └── Xã Phú Trung
│   └── Huyện Định Quán
└── Tỉnh Bình Dương (Province)
```

### 4.3 Google Business Profile Integration

**PHASE 2:** Help businesses claim/create Google Business Profiles
- Auto-populate GBP with VIO LOCAL data
- Sync hours, photos, contact info
- Generate QR code for GBP claiming
- Provide GBP optimization guide (Vietnamese)

---

## 5. MOBILE-FIRST PHILOSOPHY

### 5.1 Mobile Constraints as Features

**EMBRACE LIMITATIONS:**
- Small screen → Focus on one thing at a time
- Touch input → Large buttons, no hover states
- Slow networks → Aggressive caching, optimistic UI
- Limited attention → Prioritize ruthlessly

### 5.2 Performance Budget

**HARD LIMITS:**
```
First Contentful Paint (FCP):  < 1.5s
Largest Contentful Paint (LCP): < 2.5s
Time to Interactive (TTI):      < 3.5s
Cumulative Layout Shift (CLS):  < 0.1
Total Page Weight:              < 500KB (initial load)
JavaScript Bundle:              < 150KB (gzipped)
```

**MEASUREMENT:**
- Test on real Vietnamese networks (3G, slow 4G)
- Use Lighthouse CI in deployment pipeline
- Reject PRs that regress performance by >10%

### 5.3 Offline Capabilities

**SERVICE WORKER STRATEGY:**
```javascript
// Cache-First for static assets
self.addEventListener('fetch', (event) => {
  if (isStaticAsset(event.request)) {
    event.respondWith(cacheFirst(event.request));
  }
  // Network-First for API calls
  if (isApiRequest(event.request)) {
    event.respondWith(networkFirst(event.request));
  }
  // Stale-While-Revalidate for images
  if (isImage(event.request)) {
    event.respondWith(staleWhileRevalidate(event.request));
  }
});
```

**OFFLINE ACTIONS:**
- Queue business updates (sync when online)
- Cache storefront pages for offline viewing
- Show "Offline Mode" banner with sync status

### 5.4 Mobile-First Forms

**PRINCIPLES:**
- One input per screen (wizard pattern for long forms)
- Auto-advance after selection (category → next step)
- Use native inputs: `<input type="tel">`, `<input type="number">`
- Show keyboard appropriate to input (numeric, phone, email)
- Validate on blur, not on submit (immediate feedback)

**BUSINESS CREATION FLOW:**
```
Step 1: Phone Verification (SMS OTP)
Step 2: Business Category (icon picker, 12 options)
Step 3: Business Name (text input, Vietnamese keyboard)
Step 4: Location (map pin + address autocomplete)
Step 5: Contact Info (phone, Zalo, Facebook)
Step 6: Operating Hours (time picker)
Step 7: Add Photos (camera or gallery)
Step 8: Review & Publish
```

**EACH STEP:**
- Shows progress indicator (1/8, 2/8, ...)
- Has "Quay lại" (back) and "Tiếp tục" (next) buttons
- Saves draft automatically (resume later)
- Maximum 3 fields per step

---

## 6. SOCIAL COMMERCE PHILOSOPHY

### 6.1 The Social Commerce Reality

**TRUTH:** Vietnamese rural commerce happens on Facebook, Zalo, and word-of-mouth, not websites.

**VIO LOCAL'S ROLE:**
- We are the **permanent, SEO-friendly home base**
- Social platforms are where **transactions happen**
- We bridge: Discovery → Social → Transaction

### 6.2 Integration Strategy

**QR CODE GENERATION:**
Every storefront gets:
- Unique QR code linking to VIO LOCAL page
- Branded QR code (with logo) for printing
- Download options: PNG, PDF, print-ready A4

**USE CASES:**
- Print on storefront sign
- Share in Facebook posts
- Attach to product packaging
- Include in Zalo business card

**SHAREABLE LINKS:**
```
violocal.vn/s/abc123  → Short link (7 characters)
                        Redirects to full storefront
                        Tracks referral source
```

**SOCIAL EMBED:**
```html
<!-- Facebook Open Graph -->
<meta property="og:title" content="Cá Tươi Bà Năm - Đồng Nai">
<meta property="og:description" content="Cá tươi sông Đồng Nai...">
<meta property="og:image" content="https://violocal.vn/.../hero.jpg">
<meta property="og:url" content="https://violocal.vn/...">

<!-- Twitter Card -->
<meta name="twitter:card" content="summary_large_image">
```

### 6.3 Contact Method Priority

**DISPLAY ORDER:**
1. **Phone Call** (immediate, trusted, universal)
2. **Zalo** (messaging, popular in Vietnam)
3. **Facebook Messenger** (if business has FB page)
4. **Address** (for walk-in customers)

**BUTTONS:**
```tsx
<a href="tel:+84912345678" className="contact-button">
  <PhoneIcon /> Gọi ngay
</a>

<a href="https://zalo.me/84912345678" className="contact-button">
  <ZaloIcon /> Chat Zalo
</a>

<a href="https://m.me/business-page-id" className="contact-button">
  <MessengerIcon /> Nhắn tin
</a>
```

**NO BUILT-IN CHAT:**
- Don't build messaging (users already use Zalo/Facebook)
- Don't try to own conversations
- Just facilitate the connection

---

## 7. GEOGRAPHIC SYSTEM PHILOSOPHY

### 7.1 Vietnamese Address Structure

**HIERARCHY (Top-Down):**
```
Country:    Việt Nam
Province:   Tỉnh Đồng Nai
District:   Huyện Tân Phú
Commune:    Xã Tân Phú
Village:    Ấp 3
Street:     Đường Tỉnh Lộ 2
Number:     Số 123
```

**DATABASE REPRESENTATION:**
```sql
CREATE TABLE addresses (
  id bigserial PRIMARY KEY,
  country_code char(2) DEFAULT 'VN',
  province varchar(100) NOT NULL,      -- Tỉnh
  district varchar(100) NOT NULL,      -- Huyện
  commune varchar(100),                -- Xã/Phường
  village varchar(100),                -- Ấp/Thôn (optional)
  street varchar(200),                 -- Đường (optional)
  building_number varchar(50),         -- Số nhà (optional)
  location geography(Point, 4326) NOT NULL,  -- PostGIS
  formatted_address text NOT NULL,     -- Display format
  google_place_id varchar(255),        -- Google Maps reference
  created_at timestamp DEFAULT now()
);

CREATE INDEX idx_addresses_location ON addresses USING GIST(location);
CREATE INDEX idx_addresses_province ON addresses(province);
CREATE INDEX idx_addresses_district ON addresses(district);
```

### 7.2 Geographic Queries

**NEARBY SEARCH (Core Query):**
```sql
-- Find businesses within 10km of a point
SELECT 
  b.id,
  b.name,
  b.category,
  ST_Distance(
    a.location,
    ST_SetSRID(ST_MakePoint($longitude, $latitude), 4326)::geography
  ) / 1000 AS distance_km
FROM businesses b
JOIN addresses a ON b.address_id = a.id
WHERE ST_DWithin(
  a.location,
  ST_SetSRID(ST_MakePoint($longitude, $latitude), 4326)::geography,
  10000  -- 10km in meters
)
AND b.status = 'active'
ORDER BY distance_km ASC
LIMIT 20;
```

**BOUNDARY SEARCH:**
```sql
-- Find all businesses in a district
SELECT b.*
FROM businesses b
JOIN addresses a ON b.address_id = a.id
WHERE a.province = 'Đồng Nai'
  AND a.district = 'Tân Phú'
  AND b.status = 'active'
ORDER BY b.name;
```

### 7.3 Location Input Patterns

**OPTION 1: Map Pin (Preferred)**
- User drags pin on Google Maps
- System reverse-geocodes to address
- Auto-fills province, district, commune
- User confirms or edits

**OPTION 2: Address Autocomplete**
- Use Google Places Autocomplete API
- Restrict to Vietnam (`componentRestrictions: {country: 'vn'}`)
- Filter to business-relevant types
- Extract coordinates from place details

**OPTION 3: Current Location**
- Request geolocation permission
- Get GPS coordinates
- Reverse-geocode to address
- Show on map for confirmation

### 7.4 Distance Display

**RULES:**
```javascript
function formatDistance(meters) {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;  // 500m
  } else if (meters < 10000) {
    return `${(meters / 1000).toFixed(1)}km`;  // 2.3km
  } else {
    return `${Math.round(meters / 1000)}km`;  // 15km
  }
}
```

**DISPLAY:**
- Always show distance from user's current location
- Update distance when user moves (background geolocation)
- Show "~" prefix for estimated distances (no GPS)

---

## 8. AI COLLABORATION RULES

### 8.1 How to Work with Claude

**WHEN ASKING FOR CODE:**
1. Specify the exact file path and purpose
2. Indicate if this is NEW code or MODIFICATION
3. If modifying, show the CURRENT code first
4. State any constraints (performance, mobile-first, etc.)

**EXAMPLE:**
```
Create a new React component: 
  src/components/BusinessCard.tsx

Requirements:
- Display business name, category, distance, photo
- Mobile-first design (Tailwind)
- Touch-friendly (44px minimum touch targets)
- Skeleton loading state
- Click → navigate to storefront page

Constraints:
- Must work on 320px screens
- Performance: < 100ms render time
- Accessibility: WCAG AA contrast
```

### 8.2 Code Review Checklist

Before accepting any code, verify:

**MOBILE-FIRST:**
- [ ] Tested on 320px width
- [ ] Touch targets ≥ 44px × 44px
- [ ] Font sizes ≥ 16px for body text
- [ ] No horizontal scroll

**PERFORMANCE:**
- [ ] Images lazy-loaded
- [ ] No unnecessary re-renders
- [ ] Memoization where appropriate
- [ ] Debounced search inputs

**ACCESSIBILITY:**
- [ ] Semantic HTML (not div soup)
- [ ] ARIA labels on icon buttons
- [ ] Color contrast ≥ 4.5:1
- [ ] Keyboard navigation works

**SEO:**
- [ ] Structured data present (if storefront page)
- [ ] Meta tags complete
- [ ] Vietnamese slugs
- [ ] Canonical URL set

**SECURITY:**
- [ ] Input validation (Zod schema)
- [ ] SQL injection prevention (parameterized queries)
- [ ] XSS prevention (escaped output)
- [ ] Rate limiting on auth endpoints

### 8.3 Documentation Standards

**CODE COMMENTS:**
```typescript
// ❌ BAD: Obvious comments
const total = price * quantity;  // Multiply price by quantity

// ✅ GOOD: Explain WHY
const total = price * quantity;  // Tax is calculated server-side, not here

// ✅ GOOD: Business logic explanation
// Vietnamese phone numbers: strip all non-digits, ensure 10-digit format
// Formats accepted: 0912 345 678, 0912-345-678, 84912345678
const normalizedPhone = phone.replace(/\D/g, '').slice(-10);
```

**COMPONENT DOCUMENTATION:**
```typescript
/**
 * BusinessCard - Displays business summary in list view
 * 
 * @param business - Business data from API
 * @param distance - Distance in meters (optional)
 * @param onPress - Click handler (optional, defaults to navigate)
 * 
 * Mobile-optimized: 320px min-width, 44px touch targets
 * Performance: Memoized, lazy-loads image
 * Accessibility: Semantic HTML, ARIA labels
 */
export function BusinessCard({ business, distance, onPress }: Props) {
  // ...
}
```

### 8.4 Incremental Development

**RULE: Build in working increments**

**WRONG:**
```
"Build the entire business listing creation flow with all 8 steps"
→ Too big, will miss edge cases, hard to test
```

**RIGHT:**
```
Step 1: "Create phone verification screen (SMS OTP)"
  → Test, verify, commit
Step 2: "Create category selection screen"
  → Test, verify, commit
Step 3: "Create business name input screen"
  → Test, verify, commit
...
```

**EACH INCREMENT MUST:**
- Be independently testable
- Not break existing functionality
- Be deployable (even if feature-flagged)
- Include error handling

---

## 9. CODING RULES

### 9.1 File Structure

```
vio-local/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (public)/           # Public pages (no auth)
│   │   │   ├── page.tsx        # Homepage
│   │   │   ├── search/         # Discovery
│   │   │   └── [slug]/         # Storefront pages
│   │   ├── (auth)/             # Authenticated pages
│   │   │   ├── dashboard/
│   │   │   └── business/
│   │   └── api/                # API routes
│   ├── components/
│   │   ├── ui/                 # Reusable UI (buttons, inputs)
│   │   ├── business/           # Business-specific components
│   │   └── layout/             # Layout components (header, footer)
│   ├── lib/
│   │   ├── api/                # API client functions
│   │   ├── utils/              # Utility functions
│   │   └── validation/         # Zod schemas
│   ├── hooks/                  # Custom React hooks
│   ├── stores/                 # Zustand stores
│   └── types/                  # TypeScript types
├── public/
│   ├── images/
│   └── fonts/
└── prisma/
    └── schema.prisma           # Database schema
```

### 9.2 Naming Conventions

**FILES:**
```
Components:    PascalCase       BusinessCard.tsx
Pages:         kebab-case       business-list.tsx
Utilities:     camelCase        formatPhone.ts
Types:         PascalCase       Business.ts
Constants:     SCREAMING_SNAKE  API_ENDPOINTS.ts
```

**VARIABLES:**
```typescript
// Booleans: is, has, should, can
const isActive = true;
const hasProducts = false;
const shouldShowMap = true;

// Arrays: plural
const businesses = [];
const categories = [];

// Functions: verb + noun
function fetchBusinesses() {}
function validatePhone() {}
function normalizeAddress() {}

// Constants: SCREAMING_SNAKE_CASE
const MAX_UPLOAD_SIZE = 5_000_000;
const DEFAULT_RADIUS_KM = 10;
```

### 9.3 TypeScript Rules

**STRICT MODE ENABLED:**
```json
// tsconfig.json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true
  }
}
```

**TYPE EVERYTHING:**
```typescript
// ❌ BAD: Implicit any
function processBusiness(data) {
  return data.name;
}

// ✅ GOOD: Explicit types
interface Business {
  id: number;
  name: string;
  category: string;
  location: {
    lat: number;
    lng: number;
  };
}

function processBusiness(data: Business): string {
  return data.name;
}
```

**USE DISCRIMINATED UNIONS:**
```typescript
// API response type
type ApiResponse<T> =
  | { success: true; data: T }
  | { success: false; error: { code: string; message: string } };

// Usage
const response: ApiResponse<Business> = await fetchBusiness(id);
if (response.success) {
  console.log(response.data.name);  // TypeScript knows data exists
} else {
  console.error(response.error.message);  // TypeScript knows error exists
}
```

### 9.4 Error Handling

**STRUCTURED ERRORS:**
```typescript
// Define error types
class BusinessNotFoundError extends Error {
  code = 'BUSINESS_NOT_FOUND';
  statusCode = 404;
  constructor(businessId: string) {
    super(`Business ${businessId} not found`);
  }
}

class ValidationError extends Error {
  code = 'VALIDATION_ERROR';
  statusCode = 400;
  constructor(public fields: Record<string, string>) {
    super('Validation failed');
  }
}

// Usage
try {
  const business = await getBusiness(id);
} catch (error) {
  if (error instanceof BusinessNotFoundError) {
    return res.status(404).json({
      success: false,
      error: { code: error.code, message: 'Không tìm thấy cửa hàng' }
    });
  }
  throw error;  // Re-throw unknown errors
}
```

**CLIENT-SIDE ERROR BOUNDARIES:**
```tsx
// Wrap pages in error boundaries
<ErrorBoundary fallback={<ErrorFallback />}>
  <BusinessPage />
</ErrorBoundary>

// Show user-friendly error
function ErrorFallback({ error }: { error: Error }) {
  return (
    <div className="error-container">
      <h2>Đã xảy ra lỗi</h2>
      <p>Vui lòng thử lại sau</p>
      <button onClick={() => window.location.reload()}>
        Tải lại trang
      </button>
    </div>
  );
}
```

### 9.5 Testing Requirements

**UNIT TESTS:**
- All utility functions must have tests
- All API client functions must have tests
- Use Jest + React Testing Library

**INTEGRATION TESTS:**
- All API endpoints must have tests
- Use Supertest for HTTP testing
- Test auth flows end-to-end

**E2E TESTS (Critical paths only):**
- Business creation flow
- Search and discovery
- Storefront viewing
- Use Playwright

**COVERAGE REQUIREMENTS:**
- Utilities: 90%+
- API routes: 80%+
- Components: 60%+ (focus on logic, not styling)

---

## 10. FORBIDDEN PATTERNS

### 10.1 Architecture Anti-Patterns

**❌ FORBIDDEN:**

**1. MICROSERVICES (Phase 1)**
- Don't split into separate services until >100k businesses
- Monolith with modular code is fine
- Premature distribution kills startups

**2. GRAPHQL**
- Adds complexity without benefit at this scale
- REST is simpler, more cacheable
- GraphQL optimizes for wrong problem (we're read-heavy)

**3. SERVERLESS FUNCTIONS FOR EVERYTHING**
- Cold starts hurt mobile UX
- Keep long-running backend server
- Use serverless only for: image processing, email sending

**4. NOSQL FOR PRIMARY DATABASE**
- Geographic queries NEED PostGIS
- Joins are essential (business ↔ products ↔ categories)
- Use PostgreSQL, not MongoDB/DynamoDB

**5. CLIENT-SIDE RENDERING (CSR) FOR STOREFRONTS**
- SEO requires server-rendered HTML
- Use Next.js SSR/SSG, not pure React SPA
- Mobile users need fast initial load

**6. REAL-TIME EVERYTHING**
- WebSockets/Server-Sent Events unnecessary
- Polling every 30s is fine
- Real-time sync adds complexity without user value

### 10.2 Code Anti-Patterns

**❌ FORBIDDEN:**

**1. PROP DRILLING BEYOND 2 LEVELS**
```tsx
// ❌ BAD
<Parent user={user}>
  <Child user={user}>
    <GrandChild user={user}>
      <GreatGrandChild user={user} />  // STOP
    </GrandChild>
  </Child>
</Parent>

// ✅ GOOD: Use Zustand or Context
const user = useUserStore(state => state.user);
```

**2. INLINE STYLES**
```tsx
// ❌ BAD
<div style={{ padding: '16px', backgroundColor: '#f3f4f6' }}>

// ✅ GOOD: Use Tailwind
<div className="p-4 bg-vio-gray-bg">
```

**3. MAGIC NUMBERS**
```typescript
// ❌ BAD
if (distance < 10000) { ... }

// ✅ GOOD
const MAX_SEARCH_RADIUS_METERS = 10_000;
if (distance < MAX_SEARCH_RADIUS_METERS) { ... }
```

**4. CALLBACK HELL**
```typescript
// ❌ BAD
fetchBusiness(id, (business) => {
  fetchProducts(business.id, (products) => {
    fetchReviews(business.id, (reviews) => {
      render(business, products, reviews);
    });
  });
});

// ✅ GOOD: Use async/await
const business = await fetchBusiness(id);
const [products, reviews] = await Promise.all([
  fetchProducts(business.id),
  fetchReviews(business.id)
]);
render(business, products, reviews);
```

**5. PREMATURE ABSTRACTION**
```typescript
// ❌ BAD: Abstracting before pattern is clear
class BusinessService {
  async getAll() {}
  async getById() {}
  async create() {}
  async update() {}
  async delete() {}
  async search() {}
  async filter() {}
  async sort() {}
  // 20 more methods...
}

// ✅ GOOD: Simple functions until pattern emerges
export async function getBusiness(id: string) { ... }
export async function searchBusinesses(query: string) { ... }
```

### 10.3 UI Anti-Patterns

**❌ FORBIDDEN:**

**1. INFINITE SCROLL ON MOBILE**
- Users lose their place
- "Load More" button is clearer
- Better for low-memory devices

**2. HOVER EFFECTS**
- Mobile has no hover
- Use touch states (active, pressed)
- Focus on tap feedback

**3. CAROUSELS/SLIDERS**
- Users ignore everything after slide 1
- Show top 4 items, "Xem thêm" button
- Carousels are for advertisers, not users

**4. MODALS FOR CRITICAL ACTIONS**
- Modals break back button
- Use full-screen pages for forms
- Modals only for: confirmations, alerts

**5. HAMBURGER MENU FOR CRITICAL NAV**
- Hide = users forget it exists
- Show top 3-4 actions in tab bar
- Reserve hamburger for secondary actions

### 10.4 Data Anti-Patterns

**❌ FORBIDDEN:**

**1. STORING DENORMALIZED DATA PREMATURELY**
- Start with normalized schema
- Denormalize only after measuring perf problems
- Don't optimize for reads you don't have yet

**2. SOFT DELETES FOR EVERYTHING**
- Soft delete: businesses, users, critical data
- Hard delete: sessions, temporary uploads, logs
- Don't bloat tables with "deleted" junk

**3. JSONB FOR STRUCTURED DATA**
- Use JSONB for: metadata, settings, flexible schemas
- Don't use JSONB for: core business data (name, category, price)
- If you need to query it, it should be a column

**4. STORING DERIVED DATA**
```sql
-- ❌ BAD: Storing calculated distance
CREATE TABLE businesses (
  id bigserial,
  name text,
  distance_from_user float  -- WRONG: varies per user
);

-- ✅ GOOD: Calculate on query
SELECT 
  b.*,
  ST_Distance(b.location, $userLocation) AS distance
FROM businesses b;
```

---

## 11. SCALABILITY RULES

### 11.1 Performance Optimization Strategy

**RULE: Measure before optimizing**

**OPTIMIZATION PRIORITY:**
```
1. Caching (80% performance gain, 5% effort)
2. Database indexes (60% gain, 10% effort)
3. Image optimization (40% gain, 10% effort)
4. Code splitting (30% gain, 20% effort)
5. CDN (50% gain, 15% effort)
6. Algorithm optimization (20% gain, 50% effort)
```

**CACHING STRATEGY:**
```
LAYER 1: Browser Cache
- Static assets: 1 year (immutable URLs)
- API responses: 5 minutes (stale-while-revalidate)

LAYER 2: CDN (Cloudflare)
- Images: 1 month
- HTML pages: 10 minutes
- API endpoints: 1 minute (for public data)

LAYER 3: Redis
- Business details: 1 hour (invalidate on update)
- Search results: 5 minutes
- Session data: 7 days

LAYER 4: Database Query Cache
- PostGIS queries: 30 seconds (geographic data changes slowly)
```

### 11.2 Database Scaling

**SCALING STAGES:**

**STAGE 1 (0-10k businesses): Single PostgreSQL instance**
- Vertical scaling (more RAM, faster CPU)
- Aggressive indexing
- Query optimization

**STAGE 2 (10k-100k businesses): Read replicas**
- Primary for writes
- 2-3 read replicas for queries
- Route search traffic to replicas

**STAGE 3 (100k-1M businesses): Geographic partitioning**
```sql
-- Partition by province
CREATE TABLE businesses_dong_nai PARTITION OF businesses
  FOR VALUES IN ('Đồng Nai');

CREATE TABLE businesses_binh_duong PARTITION OF businesses
  FOR VALUES IN ('Bình Dương');
```

**STAGE 4 (1M+ businesses): Dedicated search index**
- Move text search to Elasticsearch/Meilisearch
- Keep PostgreSQL for structured data + joins
- Sync via change data capture (CDC)

### 11.3 Image Scaling

**STORAGE STRATEGY:**
```
STAGE 1: S3-compatible (DigitalOcean Spaces, Cloudflare R2)
- Cost: ~$5/TB/month
- CDN included

STAGE 2: Dedicated CDN (Cloudflare Images)
- Automatic resizing on-the-fly
- WebP/AVIF conversion
- Cost: ~$1/100k images/month

STAGE 3: Multi-region storage
- Store images in Asia-Pacific region
- Replicate to Vietnam edge nodes
```

**IMAGE OPTIMIZATION:**
```javascript
// Auto-generate optimized variants on upload
const variants = [
  { width: 1200, quality: 85, format: 'webp', suffix: 'original' },
  { width: 600,  quality: 80, format: 'webp', suffix: 'thumbnail' },
  { width: 300,  quality: 75, format: 'webp', suffix: 'list' }
];

// Serve appropriate variant based on device
<img
  src="/images/business-123/hero-thumbnail.webp"
  srcset="
    /images/business-123/hero-list.webp 300w,
    /images/business-123/hero-thumbnail.webp 600w,
    /images/business-123/hero-original.webp 1200w
  "
  sizes="(max-width: 640px) 300px, (max-width: 1024px) 600px, 1200px"
  loading="lazy"
/>
```

### 11.4 Rate Limiting

**API RATE LIMITS:**
```
PUBLIC ENDPOINTS (no auth):
- Search: 30 requests/minute per IP
- Storefront view: 60 requests/minute per IP

AUTHENTICATED ENDPOINTS:
- Business updates: 10 requests/minute per user
- Image uploads: 5 requests/minute per user
- SMS sending: 3 requests/hour per phone number

IMPLEMENT WITH REDIS:
- Key: `rate_limit:{endpoint}:{identifier}`
- Value: request count
- Expiry: window duration (1 minute, 1 hour)
```

### 11.5 Monitoring & Alerts

**METRICS TO TRACK:**
```
BUSINESS METRICS:
- New businesses created/day
- Active businesses (updated in last 30 days)
- Storefronts viewed/day
- Search queries/day

PERFORMANCE METRICS:
- API response time (p50, p95, p99)
- Database query time
- Image load time
- Error rate (4xx, 5xx)

INFRASTRUCTURE METRICS:
- CPU usage
- Memory usage
- Disk usage
- Network throughput
```

**ALERTS:**
```yaml
# Example: Sentry + PagerDuty
alerts:
  - name: High Error Rate
    condition: error_rate > 5%
    severity: critical
    notify: on-call-engineer

  - name: Slow API Response
    condition: p95_latency > 2000ms
    severity: warning
    notify: engineering-channel

  - name: Database CPU High
    condition: cpu_usage > 80%
    severity: warning
    notify: engineering-channel
```

---

## 12. NO-REWRITE RULES

### 12.1 Evolution Over Revolution

**PRINCIPLE: Incremental improvement beats grand rewrites**

**FORBIDDEN:**
- "Let's rewrite the entire frontend in Next.js 15"
- "Let's migrate from PostgreSQL to MongoDB"
- "Let's switch from REST to GraphQL"

**ALLOWED:**
- "Let's refactor the business search component"
- "Let's add a Redis cache layer for hot queries"
- "Let's optimize this slow database query"

### 12.2 Feature Flags

**USE FEATURE FLAGS FOR:**
- New features (test with 5% of users first)
- Risky changes (database query refactors)
- A/B tests (compare performance)
- Gradual rollouts (10% → 50% → 100%)

**IMPLEMENTATION:**
```typescript
// Environment-based flags
const FEATURE_FLAGS = {
  useNewSearch: process.env.FEATURE_NEW_SEARCH === 'true',
  enableGoogleMaps: process.env.FEATURE_GOOGLE_MAPS === 'true',
  showProductReviews: process.env.FEATURE_REVIEWS === 'true',
};

// Usage
if (FEATURE_FLAGS.useNewSearch) {
  return <NewSearchComponent />;
} else {
  return <LegacySearchComponent />;
}
```

### 12.3 Deprecation Policy

**BEFORE REMOVING ANYTHING:**
1. Measure current usage (logs, analytics)
2. Announce deprecation (warning banner, email)
3. Provide migration path (documentation)
4. Wait 90 days minimum
5. Monitor errors after removal

**EXAMPLE:**
```typescript
// Step 1: Mark as deprecated (v1.0)
/**
 * @deprecated Use `searchBusinesses` instead. Will be removed in v2.0.
 */
export async function findBusinesses(query: string) {
  console.warn('findBusinesses is deprecated, use searchBusinesses');
  return searchBusinesses(query);
}

// Step 2: Remove in next major version (v2.0)
// Delete function, update imports
```

### 12.4 Backward Compatibility

**API VERSIONING:**
```
/api/v1/businesses  ← Keep supporting old version
/api/v2/businesses  ← New version with breaking changes

// Version selection via header or query param
?api_version=1
X-API-Version: 1
```

**DATABASE MIGRATIONS:**
```sql
-- ❌ BAD: Breaking change
ALTER TABLE businesses DROP COLUMN old_field;

-- ✅ GOOD: Non-breaking migration
-- Step 1: Add new field (optional)
ALTER TABLE businesses ADD COLUMN new_field text;

-- Step 2: Migrate data
UPDATE businesses SET new_field = transform(old_field);

-- Step 3: Make new field required
ALTER TABLE businesses ALTER COLUMN new_field SET NOT NULL;

-- Step 4: (Next release) Drop old field
ALTER TABLE businesses DROP COLUMN old_field;
```

---

## 13. NO-OVERENGINEERING RULES

### 13.1 YAGNI (You Aren't Gonna Need It)

**DON'T BUILD UNTIL NEEDED:**

**❌ WRONG:**
```typescript
// "We might need multi-currency support in the future"
interface Price {
  amount: number;
  currency: 'VND' | 'USD' | 'EUR' | 'JPY';
  exchangeRate?: number;
}
```

**✅ RIGHT:**
```typescript
// Build for Vietnam first, extend later if needed
interface Price {
  amount: number;  // VND only for now
}
```

### 13.2 Simplicity Checklist

**BEFORE ADDING ANY COMPLEXITY, ASK:**

1. **Can I solve this with existing code?**
   - Check if similar functionality already exists
   - Refactor existing code instead of duplicating

2. **What's the simpler alternative?**
   - Array.map() vs complex state management
   - SQL query vs in-memory processing

3. **What's the cost of this abstraction?**
   - More files to maintain
   - More cognitive load for team
   - Harder to debug

4. **Will this be used >3 times?**
   - Don't create reusable component until 3rd use
   - Duplication is cheaper than wrong abstraction

5. **Can I delete this later easily?**
   - Avoid tight coupling
   - Keep dependencies explicit

### 13.3 The Three Uses Rule

**RULE: Write it three times before abstracting**

**ITERATION 1: Inline code**
```tsx
// business-page-1.tsx
<div className="p-4 bg-white rounded-lg shadow">
  <h2>{business.name}</h2>
</div>
```

**ITERATION 2: Copy-paste with changes**
```tsx
// business-page-2.tsx (copy from page-1)
<div className="p-4 bg-white rounded-lg shadow">
  <h2>{business.name}</h2>
  <p>{business.category}</p>  // Added category
</div>
```

**ITERATION 3: Now abstract**
```tsx
// components/BusinessCard.tsx (after 3rd use)
export function BusinessCard({ business, showCategory = false }) {
  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <h2>{business.name}</h2>
      {showCategory && <p>{business.category}</p>}
    </div>
  );
}
```

### 13.4 Optimization Thresholds

**DON'T OPTIMIZE UNTIL:**

```
DATABASE QUERIES:
- Don't add indexes until queries are >100ms
- Don't denormalize until queries are >500ms
- Don't shard until queries are >2000ms

CACHING:
- Don't cache until requests are >1000/hour
- Don't use Redis until requests are >10k/hour
- Don't use CDN until requests are >100k/hour

CODE PERFORMANCE:
- Don't memoize until re-renders are visible (>16ms)
- Don't virtualize lists until >100 items
- Don't lazy-load components until bundle >500KB
```

### 13.5 The "Not Yet" List

**FEATURES TO NOT BUILD YET:**

**NOT IN MVP:**
- User reviews/ratings
- Business analytics dashboard
- Multi-user accounts (team management)
- Advanced search filters (>5 filters)
- Business messaging system
- Appointment booking
- Loyalty programs
- Inventory management
- Financial reporting
- Multi-language support (start Vietnamese-only)

**BUILD WHEN VALIDATED:**
- User reviews → When >1000 storefronts exist
- Analytics → When businesses ask for it 10+ times
- Multi-user → When businesses have >1 employee
- Advanced filters → When search queries show need

---

## 14. QUALITY GATES

### 14.1 Pre-Commit Checklist

**BEFORE COMMITTING CODE:**
- [ ] Code compiles without errors
- [ ] All tests pass
- [ ] Linter passes (no warnings allowed)
- [ ] No console.log (use proper logging)
- [ ] No commented-out code (delete or explain)
- [ ] TypeScript strict mode passes
- [ ] Mobile tested (Chrome DevTools device mode minimum)

### 14.2 Pre-Deploy Checklist

**BEFORE DEPLOYING TO PRODUCTION:**
- [ ] All tests pass (unit + integration + E2E critical paths)
- [ ] Performance budget met (Lighthouse CI)
- [ ] Database migrations tested (up + down)
- [ ] Feature flags configured correctly
- [ ] Monitoring alerts enabled
- [ ] Rollback plan documented
- [ ] Changelog updated

### 14.3 Code Review Requirements

**EVERY PR MUST HAVE:**
1. **Clear description** (what, why, how)
2. **Screenshots** (for UI changes)
3. **Performance impact** (bundle size, load time)
4. **Breaking changes** (if any, with migration guide)
5. **Tests** (for new functionality)

**REVIEWERS MUST CHECK:**
- Mobile-first design (test on 320px)
- Accessibility (keyboard nav, screen reader)
- Error handling (network failure, validation errors)
- Security (input validation, auth checks)
- Performance (no unnecessary re-renders)

---

## 15. SUCCESS METRICS

### 15.1 Platform Success Metrics

**PHASE 1 (First 6 months):**
- 1,000 businesses listed
- 10,000 storefronts viewed/month
- 50,000 search queries/month
- <2s average page load time
- >90% mobile traffic

**PHASE 2 (6-12 months):**
- 10,000 businesses listed
- 100,000 storefronts viewed/month
- 500,000 search queries/month
- >50% businesses update info monthly
- 20% businesses get contacted via platform daily

**PHASE 3 (12-24 months):**
- 50,000 businesses listed
- 1M storefronts viewed/month
- Top 3 search result for "cửa hàng [category] [district]"
- Recognized brand in rural Vietnam

### 15.2 Technical Health Metrics

**MAINTAIN ALWAYS:**
- Uptime: >99.5%
- API response time: p95 <500ms
- Page load time: p95 <3s (3G network)
- Error rate: <0.1%
- Test coverage: >75%
- Lighthouse score: >90 (mobile)

---

## 16. FINAL REMINDERS

**THIS PLATFORM EXISTS TO:**
1. Make rural Vietnamese businesses discoverable online
2. Provide free, permanent digital identities
3. Enable hyperlocal commerce through SEO
4. Bridge social commerce and web presence

**THIS PLATFORM DOES NOT:**
1. Facilitate transactions (no payments, no checkout)
2. Own customer relationships (direct contact to business)
3. Extract rent from commerce (free forever)
4. Complicate the user experience (mobile-first simplicity)

**WHEN IN DOUBT:**
- Choose simplicity over features
- Choose mobile over desktop
- Choose performance over animations
- Choose Vietnamese users over global expansion
- Choose working code over perfect architecture

---

**END OF MASTER RULES v1.0**

*These rules are living documentation. Update when learning contradicts assumptions. But never compromise on: mobile-first, simplicity, and user value.*