# VIO LOCAL — PROJECT ROADMAP
**Version 1.0 | Implementation Phases & Technical Sequencing**

---

## 0. ROADMAP PHILOSOPHY

### 0.1 Sequencing Principles

**SEQUENTIAL OVER PARALLEL:**
Each phase builds on the previous. Phases are NOT parallel workstreams. Complete Phase N before starting Phase N+1.

**WORKING SOFTWARE AT EVERY MILESTONE:**
Every phase must end with a deployable, usable product. No "half-built" states between phases.

**DISCIPLINE OVER FEATURES:**
Every phase has an explicit **STOP LIST** — features that look tempting but belong to later phases (or never). When in doubt, defer.

### 0.2 The 5 Core Priorities (Locked Order)

```
1. STOREFRONT IDENTITY      → Phase 1
2. HYPERLOCAL SEO           → Phase 2
3. DISCOVERY ENGINE         → Phase 3
4. GEOGRAPHIC ARCHITECTURE  → Phase 4
5. CONTACT-FIRST UX         → Phase 5
```

### 0.3 Explicit Non-Priorities

**THESE ARE NOT PART OF THE ROADMAP:**

```
❌ Checkout / payment systems
❌ AI chatbots / conversational interfaces
❌ Recommendation algorithms (AI/ML)
❌ Livestream / video commerce
❌ Enterprise dashboards
❌ Multi-tenant management
❌ Inventory management
❌ Order management
❌ Loyalty programs
❌ Affiliate systems
❌ Subscription billing
❌ Ratings & reviews (Phase 7+)
❌ User-generated content moderation
❌ Multi-language (Vietnamese only)
❌ Mobile native apps (web-first)
```

**RULE:** If a feature request matches the above list, the answer is "not now."

### 0.4 Phase Timeline (Estimated)

```
Phase 0: Foundation              → Weeks 1-3
Phase 1: Storefront Identity     → Weeks 4-9    (MVP launch)
Phase 2: Hyperlocal SEO          → Weeks 10-13
Phase 3: Discovery Engine        → Weeks 14-18
Phase 4: Geographic Hardening    → Weeks 19-22
Phase 5: Contact-First UX        → Weeks 23-26
Phase 6: Production Hardening    → Weeks 27-30

Total: ~30 weeks to v1.0
```

**These are guidelines, not deadlines. Quality over speed.**

---

## 1. PHASE 0 — FOUNDATION

**Duration:** 3 weeks  
**Goal:** Establish project infrastructure with zero application features.

### 1.1 Bounded Context

This phase touches ONLY infrastructure. No business logic.

```
SCOPE:
├── Project scaffolding
├── Database schema (core tables only)
├── Authentication system (SMS OTP)
├── Base UI primitives
└── Geographic reference data seeding

OUT OF SCOPE:
├── Business creation flow → Phase 1
├── Storefront pages → Phase 1
├── Search functionality → Phase 3
└── Any user-facing features
```

### 1.2 Deliverables

**INFRASTRUCTURE:**
- [ ] Next.js 14+ project initialized
- [ ] TypeScript strict mode configured
- [ ] Tailwind CSS configured (with VIO color palette)
- [ ] Prisma + PostgreSQL connection
- [ ] PostGIS extension enabled
- [ ] Redis connection (for sessions/rate limiting)
- [ ] S3-compatible storage configured
- [ ] Environment variable management
- [ ] Linter + Prettier configured
- [ ] Git hooks (pre-commit checks)

**DATABASE:**
- [ ] `users` table (phone-based auth)
- [ ] `sessions` table (JWT refresh tokens)
- [ ] `addresses` table (PostGIS-enabled)
- [ ] `provinces` table (seeded with 63 Vietnamese provinces)
- [ ] `districts` table (seeded with all Vietnamese districts)
- [ ] `communes` table (seeded with all Vietnamese communes)
- [ ] Migration system tested (up/down)

**AUTHENTICATION:**
- [ ] SMS OTP endpoint (`POST /api/auth/request-otp`)
- [ ] OTP verification endpoint (`POST /api/auth/verify-otp`)
- [ ] JWT token issuance
- [ ] Refresh token rotation
- [ ] Rate limiting (5 OTP requests/hour per phone)
- [ ] SMS provider integration (VIETGUYS or Viettel)

**UI PRIMITIVES:**
- [ ] `<Button />` (primary, secondary, icon variants)
- [ ] `<Input />` (text, tel, number, with Vietnamese keyboard support)
- [ ] `<Select />` (native, no custom dropdown)
- [ ] `<Card />` (container component)
- [ ] `<Skeleton />` (loading state)
- [ ] `<ErrorBoundary />` (error handling)
- [ ] Root layout with mobile-first viewport

### 1.3 Architecture Milestones

```
M0.1: Database schema migrated and PostGIS verified
M0.2: SMS OTP flow working end-to-end (test phone)
M0.3: First protected API route returning data
M0.4: Vietnamese geographic hierarchy fully seeded
```

### 1.4 Deployment Milestones

- [ ] Staging environment deployed (Vercel + Railway/Fly.io)
- [ ] Production environment provisioned (not yet deployed)
- [ ] CI/CD pipeline running tests on PRs
- [ ] Sentry error monitoring connected
- [ ] Basic uptime monitoring (UptimeRobot or similar)

### 1.5 Technical Priorities

```
PRIORITY 1: Database is reliable
PRIORITY 2: Auth is secure
PRIORITY 3: Geographic data is accurate
PRIORITY 4: Mobile viewport works
```

### 1.6 Risk Areas

**RISK:** SMS provider integration delays  
**MITIGATION:** Sign contracts with VIETGUYS in Week 1. Have backup provider ready.

**RISK:** Vietnamese geographic data inaccuracy  
**MITIGATION:** Use official GSO data. Verify with Vietnamese team member.

**RISK:** PostGIS configuration issues on managed databases  
**MITIGATION:** Verify PostGIS support on hosting provider before committing.

### 1.7 STOP LIST (Phase 0 — Do NOT Build)

```
❌ Business creation forms
❌ Storefront pages
❌ Search functionality
❌ Image upload UI
❌ User profile pages
❌ Admin dashboard
❌ Email integration
❌ Analytics tracking
❌ Performance optimization
❌ Caching (besides default Redis)
❌ Dark mode
❌ Internationalization framework
```

### 1.8 Exit Criteria

```
✅ A test user can sign up via phone OTP
✅ A test user can log out and log back in
✅ Database queries return geographic data
✅ All migrations run cleanly on a fresh database
✅ Linter passes, all tests pass
✅ Staging environment is publicly accessible
```

---

## 2. PHASE 1 — STOREFRONT IDENTITY (MVP)

**Duration:** 6 weeks  
**Goal:** Business owners can create, edit, and publish a public storefront.

**THIS IS THE MVP. After this phase, the platform has core value.**

### 2.1 Bounded Context

```
SCOPE:
├── Business creation flow (8-step wizard)
├── Business management (edit, update, delete)
├── Public storefront pages
├── Product/service catalog (basic)
├── Image upload & storage
└── Contact information display

OUT OF SCOPE:
├── SEO optimization (basic only) → Phase 2
├── Search functionality → Phase 3
├── Discovery features → Phase 3
├── QR codes & social bridges → Phase 5
└── Analytics dashboard → Phase 6
```

### 2.2 Bounded Domain Model

```
Business (Aggregate Root)
├── BusinessProfile     (name, category, description)
├── BusinessAddress     (location, hierarchy)
├── BusinessContact     (phone, Zalo, Facebook)
├── BusinessHours       (operating schedule)
├── BusinessMedia       (photos)
└── BusinessProducts    (catalog items)

User (Aggregate Root)
├── Phone (identity)
└── OwnedBusinesses (1:many)
```

### 2.3 Deliverables

**DATABASE EXTENSIONS:**
- [ ] `businesses` table (core entity)
- [ ] `business_hours` table (day-of-week schedule)
- [ ] `business_media` table (image references)
- [ ] `products` table (catalog items)
- [ ] `categories` table (seeded with ~30 rural business categories)
- [ ] Soft-delete columns on businesses
- [ ] Audit columns (created_by, updated_by)

**API ENDPOINTS:**
```
POST   /api/businesses              Create business
GET    /api/businesses/:id          Get business (authenticated owner view)
PATCH  /api/businesses/:id          Update business
DELETE /api/businesses/:id          Soft delete

GET    /api/businesses/:slug        Public storefront data
GET    /api/users/me/businesses     List user's businesses

POST   /api/businesses/:id/products Add product
PATCH  /api/products/:id            Update product
DELETE /api/products/:id            Remove product

POST   /api/uploads/image           Upload image (returns CDN URL)
GET    /api/categories              List all categories
```

**BUSINESS CREATION WIZARD (8 STEPS):**
- [ ] Step 1: Phone verification (re-uses Phase 0 OTP)
- [ ] Step 2: Category selection (icon grid, 30 options)
- [ ] Step 3: Business name input (Vietnamese)
- [ ] Step 4: Location (map pin + address autocomplete)
- [ ] Step 5: Contact info (phone, Zalo, Facebook URLs)
- [ ] Step 6: Operating hours (per-day time picker)
- [ ] Step 7: Photo upload (1-5 photos)
- [ ] Step 8: Review & publish

**STOREFRONT PAGE (PUBLIC):**
- [ ] Hero image section
- [ ] Business name + category
- [ ] Quick action bar (Call | Zalo | Directions)
- [ ] Map preview (Google Maps embed)
- [ ] Operating hours display (with "Open Now" indicator)
- [ ] Products grid (basic, no filtering)
- [ ] About section (description)
- [ ] Contact info section
- [ ] Footer (powered by VIO LOCAL)

**OWNER DASHBOARD:**
- [ ] List of owned businesses (cards)
- [ ] Quick edit access
- [ ] Status indicator (active/draft)
- [ ] Recent updates timeline (last 5 changes)

### 2.4 Architecture Milestones

```
M1.1: Business entity model finalized and migrated
M1.2: 8-step wizard complete and tested on mobile
M1.3: Public storefront page renders with all sections
M1.4: Image upload pipeline working (with auto-resize)
M1.5: 10 test businesses created and verified
```

### 2.5 SEO Milestones (Basic — Full SEO in Phase 2)

```
M1.6: Storefront URLs use slug format (/{slug})
M1.7: Each storefront has unique <title> and <meta description>
M1.8: Each storefront is server-rendered (no client-side data fetching)
M1.9: Images have alt text
```

**NOTE:** Full SEO (structured data, geographic URLs, sitemaps) comes in Phase 2.

### 2.6 Deployment Milestones

- [ ] Production environment deployed
- [ ] Custom domain configured (`violocal.vn`)
- [ ] SSL certificates installed
- [ ] CDN configured for images
- [ ] Initial 10 pilot businesses onboarded manually
- [ ] Beta launch with limited users

### 2.7 Technical Priorities

```
PRIORITY 1: Wizard completion rate > 80%
PRIORITY 2: Storefront page load < 2.5s on 3G
PRIORITY 3: Mobile UX is friction-free
PRIORITY 4: Image uploads work reliably
PRIORITY 5: Vietnamese text input works correctly
```

### 2.8 Risk Areas

**RISK:** Wizard abandonment (too complex)  
**MITIGATION:** User testing with 5 rural users in Week 6. Iterate based on feedback. Save drafts at every step.

**RISK:** Image upload failures on slow networks  
**MITIGATION:** Resumable uploads, optimistic UI, retry logic.

**RISK:** Vietnamese keyboard input issues  
**MITIGATION:** Test on actual Vietnamese Android devices. Use native `<input>` (no custom components).

**RISK:** Google Maps API costs  
**MITIGATION:** Set budget alerts. Use cached map tiles where possible.

**RISK:** Storefront page slow on rural networks  
**MITIGATION:** Server-render everything. Lazy-load images. Use lightweight map preview.

### 2.9 STOP LIST (Phase 1 — Do NOT Build)

```
❌ Search functionality (Phase 3)
❌ Filtering / sorting (Phase 3)
❌ Browse by category page (Phase 3)
❌ Browse by location page (Phase 4)
❌ Schema.org structured data (Phase 2)
❌ Geographic URL structure (Phase 2)
❌ Sitemap (Phase 2)
❌ QR codes (Phase 5)
❌ Short links (Phase 5)
❌ Social embed cards (Phase 5)
❌ Analytics for owners (Phase 6)
❌ Multiple owners per business (Phase 7+)
❌ Business verification system (Phase 7+)
❌ Reviews / ratings (Phase 7+)
❌ Messaging system (never)
❌ Online ordering (never)
❌ Payment processing (never)
```

### 2.10 Exit Criteria

```
✅ A new user can create a business in < 10 minutes
✅ A storefront page loads in < 2.5s on slow 4G
✅ A business owner can update any field of their business
✅ 10 pilot businesses successfully onboarded
✅ Storefront pages are publicly accessible and shareable
✅ Mobile creation flow works on Vietnamese Android devices
✅ Zero critical bugs in 1 week of pilot use
```

---

## 3. PHASE 2 — HYPERLOCAL SEO INFRASTRUCTURE

**Duration:** 4 weeks  
**Goal:** Make every storefront maximally discoverable on Google.

**This phase is about machines (Google crawlers), not humans.**

### 3.1 Bounded Context

```
SCOPE:
├── URL structure redesign (geographic hierarchy)
├── Schema.org structured data
├── Sitemap generation (dynamic)
├── Meta tag optimization
├── Open Graph & Twitter cards
├── Vietnamese slug generation
├── Canonical URLs
├── robots.txt
└── SEO-friendly redirects

OUT OF SCOPE:
├── User-facing search → Phase 3
├── Discovery pages (category, location) → Phase 3-4
├── Performance optimization → Phase 6
└── Analytics integration → Phase 6
```

### 3.2 Deliverables

**URL STRUCTURE MIGRATION:**

```
OLD (Phase 1):
/{business-slug}

NEW (Phase 2):
/{province-slug}/{district-slug}/{business-slug}

Examples:
/dong-nai/tan-phu/ca-tuoi-ba-nam
/binh-duong/thu-dau-mot/com-tam-co-hai
```

- [ ] Update Next.js routing (`app/[province]/[district]/[business]/page.tsx`)
- [ ] Implement 301 redirects from old URLs
- [ ] Update internal links
- [ ] Update share buttons to use new URLs

**SLUG GENERATION:**
- [ ] Vietnamese normalization library
- [ ] Slug uniqueness within district scope
- [ ] Reserved slug protection (admin, api, etc.)
- [ ] Slug history table (for redirects after rename)

**STRUCTURED DATA (Schema.org):**

Every storefront page must include:
```json
{
  "@context": "https://schema.org",
  "@type": "LocalBusiness",
  "name": "...",
  "description": "...",
  "address": { "@type": "PostalAddress", ... },
  "geo": { "@type": "GeoCoordinates", ... },
  "telephone": "...",
  "openingHoursSpecification": [...],
  "priceRange": "...",
  "image": "...",
  "url": "..."
}
```

- [ ] Schema generation service (server-side)
- [ ] Validation against Schema.org spec
- [ ] Testing with Google Rich Results Test

**META TAGS:**

Every page must include:
```
- <title> (unique, 50-60 chars)
- <meta name="description"> (unique, 150-160 chars)
- <link rel="canonical">
- <meta name="robots">
- <meta property="og:title">
- <meta property="og:description">
- <meta property="og:image">
- <meta property="og:url">
- <meta property="og:type">
- <meta name="twitter:card">
```

- [ ] Meta tag generation utilities
- [ ] Per-page meta customization
- [ ] Open Graph image generation (1200×630)
- [ ] Fallback meta tags for missing data

**SITEMAP:**
- [ ] Dynamic sitemap generation (`sitemap.xml`)
- [ ] Sitemap index (split by province if > 50k URLs)
- [ ] Last-modified timestamps
- [ ] Change frequency hints
- [ ] Priority weights (1.0 for businesses, 0.8 for categories)
- [ ] Submit to Google Search Console

**ROBOTS.TXT:**
```
User-agent: *
Allow: /

Sitemap: https://violocal.vn/sitemap.xml

Disallow: /api/
Disallow: /dashboard/
Disallow: /admin/
```

**HREFLANG (Future-proofing):**
```html
<link rel="alternate" hreflang="vi-VN" href="..." />
```

### 3.3 Architecture Milestones

```
M2.1: URL migration complete, no broken links
M2.2: All storefronts have valid structured data
M2.3: Sitemap accessible and indexed by Google
M2.4: All meta tags pass SEO audit (Lighthouse)
M2.5: Open Graph previews work on Facebook, Zalo, Telegram
```

### 3.4 SEO Milestones

```
M2.6: First storefront indexed by Google
M2.7: First storefront appears in Google search results
M2.8: 100 storefronts indexed within 2 weeks
M2.9: Lighthouse SEO score > 95 on all pages
M2.10: Google Rich Results Test passes for all storefronts
```

### 3.5 Deployment Milestones

- [ ] Google Search Console verified
- [ ] Bing Webmaster Tools verified
- [ ] Sitemap submitted to search engines
- [ ] SEO monitoring tool configured (e.g., Ahrefs, SEMrush, or free alternative)

### 3.6 Technical Priorities

```
PRIORITY 1: Every public page is crawlable
PRIORITY 2: Every storefront has unique meta tags
PRIORITY 3: Structured data validates without errors
PRIORITY 4: URLs are stable (no future restructuring)
PRIORITY 5: Vietnamese characters render correctly in slugs
```

### 3.7 Risk Areas

**RISK:** URL migration breaks existing inbound links  
**MITIGATION:** 301 redirects from old to new URLs. Maintain old URL table for 1 year.

**RISK:** Slug collisions in popular districts  
**MITIGATION:** Append number suffix on collision (`ca-tuoi-ba-nam-2`). Show in admin UI for resolution.

**RISK:** Vietnamese diacritics break URL encoding  
**MITIGATION:** Normalize to ASCII-safe slugs. Test on all major browsers.

**RISK:** Schema.org changes spec  
**MITIGATION:** Use stable types only. Avoid experimental schemas.

**RISK:** Google crawl budget exhausted on large sitemaps  
**MITIGATION:** Split sitemaps by province. Prioritize high-value pages.

### 3.8 STOP LIST (Phase 2 — Do NOT Build)

```
❌ User-facing search (Phase 3)
❌ Category browse pages (Phase 3)
❌ Location browse pages (Phase 4)
❌ AMP pages (not needed for our use case)
❌ JSON-LD beyond LocalBusiness (overengineering)
❌ FAQ schema (Phase 7+)
❌ Review schema (Phase 7+)
❌ Article schema (we don't have articles)
❌ Multi-language hreflang variants (Vietnamese only)
❌ A/B testing meta tags (premature)
```

### 3.9 Exit Criteria

```
✅ All storefronts use geographic URL structure
✅ All storefronts have valid Schema.org LocalBusiness data
✅ Sitemap is dynamically generated and accessible
✅ Lighthouse SEO score ≥ 95 on storefront pages
✅ Google Rich Results Test passes on all storefronts
✅ Open Graph preview works on Facebook, Zalo, Messenger
✅ 100+ storefronts indexed by Google
✅ At least 1 storefront ranking for hyperlocal queries
```

---

## 4. PHASE 3 — DISCOVERY ENGINE

**Duration:** 5 weeks  
**Goal:** Users can find businesses through text search and category browsing.

### 4.1 Bounded Context

```
SCOPE:
├── Text search (Vietnamese-aware)
├── Category browsing
├── Result list view
├── Result map view
├── Filter & sort (basic)
├── Search autocomplete
├── Recently viewed
└── Empty states & no-results handling

OUT OF SCOPE:
├── AI-powered recommendations → Never (out of scope)
├── Personalized results → Phase 7+
├── Voice search → Phase 7+
├── Image search → Never
├── Location-based browse pages → Phase 4
└── Saved searches / alerts → Phase 7+
```

### 4.2 Deliverables

**SEARCH BACKEND:**

```
GET /api/search?q={query}&lat={lat}&lng={lng}&radius={km}&category={slug}

Response:
{
  results: [
    {
      id, name, category, slug, hero_image,
      distance_km, address, phone,
      is_open_now
    }
  ],
  total: 156,
  facets: {
    categories: [{ slug, name, count }],
    distance: [{ range, count }]
  }
}
```

**SEARCH IMPLEMENTATION:**

**Option A (MVP):** PostgreSQL full-text search
- Use `tsvector` columns
- Vietnamese language configuration
- Trigram similarity for typos
- Combined with PostGIS for geographic filtering

**Option B (If needed):** Meilisearch
- Only if PostgreSQL becomes slow at > 50k businesses
- Sync via background jobs
- Defer decision until Phase 6

**INITIAL IMPLEMENTATION:** PostgreSQL only. Re-evaluate at 10k businesses.

**SEARCH FEATURES:**
- [ ] Text search (name, description, products)
- [ ] Vietnamese diacritic-insensitive matching
- [ ] Trigram fuzzy matching (handle typos)
- [ ] Category filter (single select)
- [ ] Distance filter (1km, 5km, 10km, 25km, 50km)
- [ ] Sort by: distance (default), name, newest
- [ ] Pagination (20 per page, "Load More" button)

**SEARCH UI:**
- [ ] Search bar (mobile-first, sticky)
- [ ] Search suggestions (autocomplete)
- [ ] Recent searches (localStorage)
- [ ] Filter chips (category, distance)
- [ ] Toggle: List View ↔ Map View
- [ ] Empty state ("Không tìm thấy kết quả")
- [ ] Loading skeletons

**BUSINESS CARD (LIST VIEW):**
```
┌──────────────────────────────────┐
│ [Photo]  Business Name           │
│  80×80   Category tag            │
│          📍 2.3km · Tân Phú       │
│          🟢 Đang mở · 06:00-18:00 │
│          📞 Tap to call           │
└──────────────────────────────────┘
```

**MAP VIEW:**
- [ ] Google Maps with custom markers
- [ ] Marker clustering for dense areas
- [ ] Click marker → preview card overlay
- [ ] "List View" toggle button
- [ ] Pan to refresh results
- [ ] Current location indicator

**CATEGORY BROWSE:**
- [ ] `/danh-muc/{category-slug}` URLs
- [ ] Category page with description
- [ ] Top businesses in category (by relevance + distance)
- [ ] Sub-category navigation (if applicable)

### 4.3 Architecture Milestones

```
M3.1: Search API returns relevant results in < 200ms
M3.2: Search handles Vietnamese diacritics correctly
M3.3: Geographic filter works with PostGIS
M3.4: Map view renders 100 markers without lag
M3.5: Search autocomplete responds in < 100ms
```

### 4.4 SEO Milestones

```
M3.6: Category pages have unique meta tags
M3.7: Category pages indexed by Google
M3.8: Search results pages are NOT indexed (noindex)
M3.9: Category pages rank for "{category} {region}" queries
```

### 4.5 Deployment Milestones

- [ ] Search indexed on all existing businesses
- [ ] Search analytics tracking (queries, no-results)
- [ ] A/B test ready (default sort: distance vs. relevance)
- [ ] Map API quotas monitored

### 4.6 Technical Priorities

```
PRIORITY 1: Search returns relevant results
PRIORITY 2: Mobile UX is fast and responsive
PRIORITY 3: Geographic filtering is accurate
PRIORITY 4: Vietnamese text search works correctly
PRIORITY 5: No-results state guides user to alternatives
```

### 4.7 Risk Areas

**RISK:** Search relevance is poor  
**MITIGATION:** Define quality criteria. Test with 50 real queries. Iterate based on observed behavior.

**RISK:** Vietnamese full-text search is unreliable  
**MITIGATION:** Combine `tsvector` + `pg_trgm` similarity. Test edge cases (typos, partial matches).

**RISK:** Map view is slow with many markers  
**MITIGATION:** Server-side clustering. Lazy load markers on viewport change.

**RISK:** Google Maps API costs spike  
**MITIGATION:** Use static map images for previews. Only load interactive map on user action.

**RISK:** No-results experience is dead-end  
**MITIGATION:** Show nearby alternatives, suggest broader filters, encourage business creation if relevant.

### 4.8 STOP LIST (Phase 3 — Do NOT Build)

```
❌ Personalized recommendations
❌ AI / ML ranking models
❌ "People also searched" suggestions
❌ Voice search input
❌ Image-based search
❌ Saved searches / favorites (Phase 7+)
❌ Compare businesses side-by-side
❌ Search filters > 3 facets
❌ Advanced operators (AND/OR/NOT in search)
❌ Real-time search-as-you-type (use debouncing only)
❌ Search history sync across devices (Phase 7+)
```

### 4.9 Exit Criteria

```
✅ A user can find a business by name in < 5 seconds
✅ A user can browse businesses by category
✅ A user can filter by distance and see results on a map
✅ Search handles common Vietnamese typos
✅ Search results load in < 1s on slow 4G
✅ Map view works smoothly on mobile
✅ Category pages are SEO-optimized and indexed
```

---

## 5. PHASE 4 — GEOGRAPHIC ARCHITECTURE HARDENING

**Duration:** 4 weeks  
**Goal:** Make geography a first-class citizen with SEO-rich location pages.

### 5.1 Bounded Context

```
SCOPE:
├── Province landing pages
├── District landing pages
├── Commune landing pages (top 100 communes only)
├── Geographic data optimization
├── Reverse geocoding accuracy
├── Address normalization
└── Map performance optimization

OUT OF SCOPE:
├── Custom map tiles → Never
├── Offline maps → Phase 7+
├── Turn-by-turn directions → Use Google Maps app
└── Indoor maps → Never
```

### 5.2 Deliverables

**LOCATION LANDING PAGES:**

**Province Page (`/dong-nai/`):**
```
- Hero: Province name + business count
- Top categories in province
- Featured businesses (newest 20)
- Districts list (clickable)
- Map view of province
- SEO content: "Khám phá doanh nghiệp tại Đồng Nai"
```

**District Page (`/dong-nai/tan-phu/`):**
```
- Hero: District name + business count
- Top categories in district
- All businesses (paginated, 20 per page)
- Communes list (clickable)
- Map view of district
- SEO content: "Doanh nghiệp tại Huyện Tân Phú, Đồng Nai"
```

**Commune Page (`/dong-nai/tan-phu/xa-tan-phu/`):**
```
- Hero: Commune name + business count
- All businesses in commune
- Map view of commune
- SEO content: "Cửa hàng tại Xã Tân Phú, Tân Phú, Đồng Nai"

Only built for top 100 communes by business count.
Lower-traffic communes redirect to district page.
```

**GEOGRAPHIC DATA OPTIMIZATION:**
- [ ] Verify all province/district/commune coordinates
- [ ] Add commune boundaries (polygon data, GeoJSON)
- [ ] Create `regions` summary table (cached counts)
- [ ] Background job: recalculate region statistics nightly
- [ ] PostGIS spatial index optimization

**REVERSE GEOCODING:**
- [ ] Improved address auto-fill from GPS coordinates
- [ ] District/commune inference from coordinates
- [ ] Confidence scoring (high/medium/low)
- [ ] Manual correction UI for low-confidence addresses

**MAP PERFORMANCE:**
- [ ] Static map images for preview (low-bandwidth)
- [ ] Interactive map only on user interaction
- [ ] Marker clustering at zoom levels > 10
- [ ] Lazy load Google Maps SDK
- [ ] Cache map tiles where legal

### 5.3 Architecture Milestones

```
M4.1: 63 province pages generated
M4.2: ~700 district pages generated  
M4.3: Top 100 commune pages generated
M4.4: Region statistics auto-updated nightly
M4.5: Reverse geocoding accuracy > 95% for rural addresses
```

### 5.4 SEO Milestones

```
M4.6: Province pages rank for "{category} {province}" queries
M4.7: District pages indexed by Google
M4.8: Internal linking structure creates SEO graph
M4.9: Featured snippets appear for "doanh nghiệp tại {province}"
```

### 5.5 Deployment Milestones

- [ ] Sitemap updated with location pages
- [ ] Geographic data backup strategy in place
- [ ] Map cost monitoring dashboard
- [ ] Search Console performance tracking by location

### 5.6 Technical Priorities

```
PRIORITY 1: Location pages are SEO-strong
PRIORITY 2: Reverse geocoding is accurate
PRIORITY 3: Map performance is excellent
PRIORITY 4: Geographic queries are fast
PRIORITY 5: Internal linking flows authority correctly
```

### 5.7 Risk Areas

**RISK:** Location pages create thin content (few businesses)  
**MITIGATION:** Don't generate pages for empty communes. Redirect to parent district. Minimum 3 businesses per page.

**RISK:** Vietnamese administrative reorganization (provinces merge/split)  
**MITIGATION:** Use stable internal IDs. Slug history table. Adapt within 30 days of any change.

**RISK:** Polygon data (commune boundaries) is huge  
**MITIGATION:** Simplify polygons (Douglas-Peucker algorithm). Serve as compressed GeoJSON.

**RISK:** Map costs scale with traffic  
**MITIGATION:** Use static map images by default. Interactive map opt-in. Monitor MAU spend.

### 5.8 STOP LIST (Phase 4 — Do NOT Build)

```
❌ Custom map tile rendering
❌ Hand-drawn maps
❌ 3D map visualizations
❌ Offline map support (Phase 7+)
❌ AR-based navigation
❌ Geo-fencing for notifications
❌ Heatmap visualization
❌ Real-time location sharing
❌ "Find businesses near my friend"
❌ Travel route planning
❌ Public transit integration
```

### 5.9 Exit Criteria

```
✅ Every province has a landing page
✅ Every district with > 10 businesses has a page
✅ Top 100 communes have pages
✅ Location pages rank in Google search results
✅ Reverse geocoding correctly fills 95% of addresses
✅ Map performance is smooth on mobile
✅ Geographic queries return in < 100ms
```

---

## 6. PHASE 5 — CONTACT-FIRST UX BRIDGE

**Duration:** 4 weeks  
**Goal:** Bridge digital discovery to physical/social commerce (Zalo, Facebook, phone).

### 6.1 Bounded Context

```
SCOPE:
├── QR code generation
├── Shareable short links
├── Social media embed optimization
├── Print-ready business cards
├── Deep linking to Zalo/Facebook/Messenger
├── Click tracking (privacy-respecting)
└── Business sharing tools

OUT OF SCOPE:
├── Built-in messaging → Never (users have Zalo/FB)
├── Push notifications → Phase 7+
├── Email marketing → Phase 7+
├── SMS marketing → Phase 7+
└── In-app calling → Phase 7+
```

### 6.2 Deliverables

**QR CODE SYSTEM:**

Every business gets:
- [ ] Unique QR code linking to storefront URL
- [ ] Branded QR code (with VIO LOCAL logo in center)
- [ ] Multiple sizes: small (100×100), medium (300×300), large (1000×1000)
- [ ] Download formats: PNG, SVG, PDF
- [ ] Print-ready templates (A4, A5, business card)

**API:**
```
GET /api/businesses/:id/qr?size={size}&format={format}
```

**SHORT LINKS:**

```
violocal.vn/s/{7-char-code}
            ↓
violocal.vn/dong-nai/tan-phu/ca-tuoi-ba-nam
```

- [ ] Short link generation (per business)
- [ ] Click tracking (anonymized)
- [ ] Source attribution (utm parameters)
- [ ] Custom short codes (premium feature, deferred)

**SOCIAL EMBED OPTIMIZATION:**

When pasted in Facebook/Zalo/Messenger:
- [ ] Optimized Open Graph image (auto-generated)
- [ ] Business info in preview card
- [ ] Hero image, name, category, location
- [ ] Branded watermark on OG images

**OPEN GRAPH IMAGE GENERATION:**
- [ ] Server-side image generation (Satori or @vercel/og)
- [ ] Template: business photo + name + location + VIO branding
- [ ] 1200×630 (Facebook standard)
- [ ] Cache for 24 hours

**PRINT MATERIALS:**

Generate downloadable:
- [ ] **Business card** (A6, double-sided)
  - Front: Business name, category, QR code
  - Back: Address, phone, Zalo, Facebook
- [ ] **Storefront sign** (A4, color)
  - Large QR code
  - "Quét mã để xem cửa hàng online"
- [ ] **Product tag** (small label)
  - QR code linking to specific product

**DEEP LINKING:**

```typescript
// Phone (universal)
href="tel:+84912345678"

// Zalo (Vietnam-specific)
href="https://zalo.me/{phone-or-id}"

// Facebook Messenger
href="https://m.me/{page-id}"

// Facebook page
href="https://facebook.com/{page-slug}"

// Google Maps directions
href="https://www.google.com/maps/dir/?api=1&destination={lat},{lng}"
```

- [ ] Smart contact buttons (auto-detect platform)
- [ ] Fallback for browsers without app installed
- [ ] Mobile vs. desktop behavior differences

**CLICK TRACKING:**

Privacy-respecting tracking:
- [ ] Anonymized event tracking
- [ ] No personal data stored
- [ ] No third-party trackers
- [ ] Aggregate analytics per business

Events to track:
```
- storefront_viewed (with source attribution)
- contact_clicked (phone, zalo, facebook, directions)
- qr_code_downloaded
- short_link_clicked
```

### 6.3 Architecture Milestones

```
M5.1: QR code generation working for all businesses
M5.2: Short link service deployed and tested
M5.3: OG image generation < 500ms
M5.4: Print templates downloadable
M5.5: Click tracking respects privacy
```

### 6.4 SEO Milestones

```
M5.6: Social previews show correctly on Facebook
M5.7: Social previews show correctly on Zalo
M5.8: Short links redirect with 301 status
M5.9: Branded social presence established
```

### 6.5 Deployment Milestones

- [ ] CDN configured for QR codes and OG images
- [ ] Print materials downloadable in production
- [ ] Click analytics dashboard for business owners (basic)
- [ ] Marketing campaign: "Take your business online"

### 6.6 Technical Priorities

```
PRIORITY 1: QR codes are reliable and scannable
PRIORITY 2: Social embeds look professional
PRIORITY 3: Deep links work across platforms
PRIORITY 4: Print materials are high quality
PRIORITY 5: Privacy is respected in tracking
```

### 6.7 Risk Areas

**RISK:** QR codes don't scan reliably  
**MITIGATION:** Test on common Vietnamese phones. Use high error correction. Logo overlay limited to 20% of QR area.

**RISK:** OG image generation is slow  
**MITIGATION:** Cache aggressively (24 hours). Pre-generate for popular businesses. Use edge functions.

**RISK:** Zalo deep linking varies by version  
**MITIGATION:** Test on multiple Zalo versions. Provide fallback to phone number.

**RISK:** Print quality is poor  
**MITIGATION:** Use 300 DPI minimum. Provide PDF (vector) and PNG (raster) formats.

**RISK:** Click tracking violates privacy expectations  
**MITIGATION:** No cookies. No personal data. Use aggregate metrics only.

### 6.8 STOP LIST (Phase 5 — Do NOT Build)

```
❌ In-app messaging system
❌ In-app calling (VoIP)
❌ Live chat widget
❌ Email marketing tools
❌ SMS campaign tools
❌ Push notifications
❌ Loyalty card features
❌ Coupon / discount system
❌ Booking / appointment system (Phase 7+)
❌ Newsletter signup
❌ Pop-up forms
❌ Exit-intent modals
❌ Lead capture forms
```

### 6.9 Exit Criteria

```
✅ Every business has a downloadable QR code
✅ QR codes scan reliably on Vietnamese phones
✅ Social media previews look professional
✅ Short links work and track clicks anonymously
✅ Print materials are production-ready
✅ Business owners can share their storefront in 1 tap
✅ Deep links to Zalo/Facebook work on mobile
```

---

## 7. PHASE 6 — PRODUCTION HARDENING

**Duration:** 4 weeks  
**Goal:** Make the platform production-grade for scale and reliability.

### 7.1 Bounded Context

```
SCOPE:
├── Performance optimization
├── Caching infrastructure
├── Monitoring & alerting
├── Analytics for business owners
├── Admin tooling (internal)
├── Backup & disaster recovery
├── Security audit
└── Documentation

OUT OF SCOPE:
├── New features
├── Architectural changes
├── Stack changes
└── Refactoring beyond performance needs
```

### 7.2 Deliverables

**PERFORMANCE OPTIMIZATION:**

Measure first. Optimize only what's slow.

- [ ] Run Lighthouse on top 20 pages
- [ ] Identify Top 5 performance issues
- [ ] Fix in priority order
- [ ] Re-measure after each fix
- [ ] Document performance budget

**CACHING LAYERS:**

```
Layer 1: Browser Cache
├── Static assets: 1 year
├── HTML pages: stale-while-revalidate
└── API responses: per endpoint

Layer 2: CDN (Cloudflare)
├── Images: 1 month
├── Storefront HTML: 10 minutes
└── API responses: 1 minute (selective)

Layer 3: Redis
├── Business details: 1 hour
├── Search results: 5 minutes
├── Geographic queries: 30 seconds
└── Sessions: 7 days

Layer 4: Database Query Cache
└── PostgreSQL native caching
```

- [ ] Cache invalidation on business updates
- [ ] Cache warming for popular pages
- [ ] Monitoring cache hit rates

**MONITORING:**

- [ ] Sentry: Error tracking (frontend + backend)
- [ ] Application metrics: response time, error rate, throughput
- [ ] Database metrics: query time, connection pool, slow queries
- [ ] Infrastructure: CPU, memory, disk, network
- [ ] Business metrics: signups, storefront views, contact clicks

**ALERTING:**

```yaml
critical_alerts:
  - error_rate > 5% for 5 minutes
  - api_p95_latency > 2000ms for 5 minutes
  - database_cpu > 90% for 5 minutes
  - uptime < 99% for 1 hour

warning_alerts:
  - error_rate > 1% for 15 minutes
  - api_p95_latency > 1000ms for 15 minutes
  - cache_hit_rate < 80% for 30 minutes
```

**BUSINESS ANALYTICS:**

Per-business dashboard (basic):
- [ ] Storefront views (last 7/30 days)
- [ ] Contact clicks (phone, Zalo, Facebook)
- [ ] QR code scans
- [ ] Search appearances (where their business showed up)
- [ ] Top referrers (Google, Facebook, direct)

**ADMIN TOOLING:**

Internal-only admin panel:
- [ ] Business search & view
- [ ] User management
- [ ] Content moderation (flag inappropriate businesses)
- [ ] Geographic data management
- [ ] Category management
- [ ] System health dashboard

**BACKUP & DISASTER RECOVERY:**

- [ ] Daily automated database backups
- [ ] Point-in-time recovery (PITR) enabled
- [ ] Backup restoration tested monthly
- [ ] Disaster recovery plan documented
- [ ] RTO (Recovery Time Objective): 4 hours
- [ ] RPO (Recovery Point Objective): 1 hour

**SECURITY AUDIT:**

- [ ] OWASP Top 10 checklist
- [ ] SQL injection testing (Prisma helps)
- [ ] XSS testing
- [ ] CSRF protection verification
- [ ] Rate limiting on all endpoints
- [ ] Secrets rotation procedure
- [ ] Dependency vulnerability scan
- [ ] Penetration test (external vendor, optional)

**DOCUMENTATION:**

- [ ] API documentation (OpenAPI/Swagger)
- [ ] Internal architecture docs
- [ ] Onboarding guide for new developers
- [ ] Runbook for common operations
- [ ] Incident response playbook

### 7.3 Architecture Milestones

```
M6.1: All caching layers operational
M6.2: Monitoring covers all critical paths
M6.3: Alerts tested and working
M6.4: Backup restoration tested
M6.5: Security audit passed
```

### 7.4 SEO Milestones

```
M6.6: Average page rank improving month-over-month
M6.7: Top 5 ranking for "{category} {district}" in pilot regions
M6.8: 10,000+ pages indexed by Google
M6.9: Featured snippets for hyperlocal queries
```

### 7.5 Deployment Milestones

- [ ] Production-grade monitoring deployed
- [ ] On-call rotation established
- [ ] Incident response procedures tested
- [ ] Launch readiness review completed
- [ ] Public launch announcement

### 7.6 Technical Priorities

```
PRIORITY 1: 99.5% uptime
PRIORITY 2: < 2.5s page load on slow 4G
PRIORITY 3: < 0.5% error rate
PRIORITY 4: Backup/restore reliable
PRIORITY 5: Security posture strong
```

### 7.7 Risk Areas

**RISK:** Scale issues with rapid growth  
**MITIGATION:** Load testing before launch. Auto-scaling configured. Performance budgets enforced.

**RISK:** Data loss from infrastructure failure  
**MITIGATION:** Multi-region backups. Regular restoration testing. Documented procedures.

**RISK:** Security incident  
**MITIGATION:** Security audit. Penetration test. Incident response plan. Sentry monitoring.

**RISK:** Costs scale with usage  
**MITIGATION:** Cost monitoring. Reserved capacity where applicable. Optimization before scaling.

### 7.8 STOP LIST (Phase 6 — Do NOT Build)

```
❌ New user-facing features
❌ Refactoring not driven by performance
❌ Architecture changes
❌ Stack migrations
❌ "Modernization" of working code
❌ Internationalization
❌ Mobile native apps
❌ API versioning (only one version exists)
❌ Microservices split
```

### 7.9 Exit Criteria

```
✅ 99.5% uptime over 4 weeks
✅ All performance budgets met
✅ Backup restoration tested successfully
✅ Security audit passed (no critical findings)
✅ Business analytics dashboard functional
✅ Monitoring catches issues before users report them
✅ Documentation complete and reviewed
```

---

## 8. POST-V1 ROADMAP (PHASES 7+)

**These are POSSIBLE future phases, NOT committed roadmap items.**

Each requires:
- Validation from production usage
- User research with rural businesses
- Architectural review
- Explicit approval to begin

### 8.1 Potentially in Phase 7+

```
🟡 Business verification system (manual review)
🟡 Reviews & ratings (with moderation)
🟡 Business owner team accounts (multi-user)
🟡 Premium features (featured listings)
🟡 SMS marketing tools for businesses
🟡 Advanced analytics
🟡 API for cooperatives / aggregators
🟡 White-label for province governments
🟡 Mobile native apps (iOS/Android)
🟡 Offline support (PWA enhancements)
🟡 Push notifications
🟡 Booking/appointment system
🟡 Multi-language support
```

### 8.2 Explicitly NEVER

```
🚫 Online checkout
🚫 Payment processing
🚫 Order management
🚫 Inventory tracking
🚫 Logistics integration
🚫 AI chatbots
🚫 Recommendation algorithms
🚫 Livestream commerce
🚫 In-app messaging
🚫 Virtual currency / wallets
🚫 Social network features (feeds, follows, likes)
```

---

## 9. CROSS-PHASE DEPENDENCIES

### 9.1 Dependency Graph

```
Phase 0 (Foundation)
    ↓
Phase 1 (Storefront Identity)
    ↓
    ├──→ Phase 2 (SEO) ──┐
    │                     ↓
    └──→ Phase 3 (Discovery) ──→ Phase 4 (Geographic)
                                       ↓
                                  Phase 5 (Contact UX)
                                       ↓
                                  Phase 6 (Production)
```

**Critical Path:**
Foundation → Storefront → SEO → Discovery → Geographic → Contact → Hardening

**Parallelizable (within phase):**
- Database work & UI work can happen in parallel
- Backend API & Frontend UI can be developed in parallel
- Testing & Documentation can run alongside feature work

**NOT Parallelizable (across phases):**
- Cannot start Phase 3 (Discovery) before Phase 2 (SEO) URL structure is locked
- Cannot start Phase 4 (Geographic) before Phase 3 (Discovery) reveals usage patterns

### 9.2 Technical Dependencies

```
PostGIS (Phase 0) → Required for all geographic features
SMS OTP (Phase 0) → Required for all user actions
Business entity (Phase 1) → Required for all subsequent phases
URL structure (Phase 2) → Locks for entire product life
Search infrastructure (Phase 3) → Determines scale strategy
```

---

## 10. RISK REGISTER (Cross-Phase)

### 10.1 Critical Risks

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| SMS provider outage | Medium | Critical | Backup provider contracts |
| Google Maps cost explosion | High | High | Static maps default, monitoring |
| Vietnamese text edge cases | High | Medium | Native speaker testing |
| Slow rural network adoption | Medium | High | Field testing, mobile optimization |
| SEO penalty from Google | Low | Critical | Follow guidelines, avoid hacks |
| Data loss / corruption | Low | Critical | Backups, PITR, testing |
| Competitor cloning UI | High | Low | Move fast, focus on infrastructure |
| Regulatory changes | Medium | Medium | Monitor laws, maintain compliance |

### 10.2 Mitigation Strategies

**FOR ALL RISKS:**
1. Document the risk in this register
2. Define a trigger (when does it become real?)
3. Define a response (what do we do?)
4. Review monthly

---

## 11. SUCCESS METRICS (By Phase)

### 11.1 Phase 1 (Storefront Identity)

```
✅ 10 pilot businesses created
✅ < 10 minute average creation time
✅ 0 critical bugs in 1 week
✅ Storefront page < 2.5s load time
```

### 11.2 Phase 2 (SEO)

```
✅ 100 businesses indexed by Google
✅ Lighthouse SEO > 95
✅ First Google search ranking
✅ Social previews work on FB/Zalo
```

### 11.3 Phase 3 (Discovery)

```
✅ Search returns relevant results
✅ < 200ms search response time
✅ Map view smooth on mobile
✅ 50% of users find businesses via search (vs. direct URL)
```

### 11.4 Phase 4 (Geographic)

```
✅ All 63 province pages live
✅ Location pages indexed by Google
✅ Ranking for "{category} {province}" queries
✅ 95% reverse geocoding accuracy
```

### 11.5 Phase 5 (Contact UX)

```
✅ QR codes downloaded by 80% of businesses
✅ 20% of businesses share their VIO LOCAL link
✅ Social previews professional on all platforms
✅ Contact click-through rate > 30%
```

### 11.6 Phase 6 (Production)

```
✅ 99.5% uptime
✅ < 0.5% error rate
✅ Security audit passed
✅ 1,000+ businesses listed
✅ 10,000+ monthly storefront views
```

---

## 12. PHASE TRANSITION RULES

### 12.1 When to Move to Next Phase

**ALL of the following must be true:**

```
[ ] All deliverables in current phase complete
[ ] Exit criteria met
[ ] No critical bugs open
[ ] Performance budgets met
[ ] Documentation updated
[ ] Pilot users (if applicable) satisfied
[ ] Team retrospective held
```

### 12.2 When NOT to Move Forward

**HOLD if:**
- Any deliverable is incomplete
- Any exit criteria is unmet
- Critical bugs exist
- Performance is regressing
- Team is burning out

**Quality over speed. Always.**

### 12.3 When to Skip a Phase

**NEVER.** Phases are dependencies, not options.

If a phase seems unnecessary, the priorities are wrong. Re-read MASTER_RULES.md.

---

## 13. RESOURCE ALLOCATION GUIDANCE

### 13.1 Effort Distribution per Phase

```
PHASE 0 (Foundation):
- Backend: 60%
- Frontend: 20%
- DevOps: 20%

PHASE 1 (Storefront):
- Backend: 30%
- Frontend: 50%
- UX/Design: 20%

PHASE 2 (SEO):
- Backend: 30%
- Frontend: 30%
- SEO/Content: 40%

PHASE 3 (Discovery):
- Backend: 40%
- Frontend: 40%
- UX/Design: 20%

PHASE 4 (Geographic):
- Backend: 50%
- Frontend: 30%
- SEO/Content: 20%

PHASE 5 (Contact UX):
- Backend: 30%
- Frontend: 40%
- Design: 30%

PHASE 6 (Production):
- DevOps: 40%
- Backend: 30%
- Documentation: 30%
```

### 13.2 Minimum Team Composition

```
PHASE 0-1: 2-3 engineers (1 backend, 1 frontend, 1 versatile)
PHASE 2-3: 3-4 engineers (add 1 SEO/content specialist)
PHASE 4-5: 3-4 engineers + 1 designer (for print materials)
PHASE 6:   2-3 engineers + 1 DevOps specialist
```

---

## 14. FEATURE CREEP DEFENSE

### 14.1 The "Not Yet" Response Template

When asked to add something not in current phase:

```
"This feature is valuable but belongs to Phase [N].
Adding it now would delay [current priority] and risk
scope creep. Let's document it and revisit when we
reach Phase [N]. Current focus: [current deliverable]."
```

### 14.2 Common Creep Requests (and Responses)

```
"Can we add reviews?" → Phase 7+, after MVP validation
"Can we add chat?" → NEVER, users have Zalo
"Can we add payments?" → NEVER, we don't touch money
"Can we add AI recommendations?" → NEVER, out of scope
"Can we add a mobile app?" → Phase 7+, web works fine
"Can we add ratings?" → Phase 7+, after moderation strategy
"Can we add a feed?" → NEVER, not a social network
"Can we add livestream?" → NEVER, out of scope
"Can we add inventory?" → NEVER, not a marketplace
```

### 14.3 Decision Framework

```
Ask: Does this feature serve one of the 5 core priorities?
    1. Storefront identity?
    2. Hyperlocal SEO?
    3. Discovery?
    4. Geographic architecture?
    5. Contact-first UX?

YES → Schedule in appropriate phase
NO  → Defer to "Phase 7+" or "Never" list
```

---

## 15. FINAL DIRECTIVES

**THE ROADMAP IS A CONTRACT.**

Phases are sequential. Priorities are locked. Non-priorities are forbidden.

**THE GOAL IS NOT FEATURES. THE GOAL IS:**
1. Rural businesses are discoverable
2. They have permanent digital identities
3. Their information is structured for SEO
4. Customers can find them via Google/search
5. Customers can contact them directly

**EVERYTHING ELSE IS NOISE.**

When making roadmap decisions:
- Choose discipline over features
- Choose quality over speed
- Choose simplicity over flexibility
- Choose user value over technical elegance
- Choose long-term over short-term

**SUCCESS LOOKS LIKE:**
A farmer in rural Đồng Nai gets a phone call from a Saigon buyer who found them on Google through VIO LOCAL.

That's it. That's the whole product.

---

**END OF PROJECT ROADMAP v1.0**

*This roadmap is a living document but the priorities are not. Phases may shift in timing. Phase ordering is locked. Non-priorities remain non-priorities.*