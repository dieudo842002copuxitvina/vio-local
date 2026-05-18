# VIO LOCAL — AI GUARDRAILS
**Version 1.0 | Mandatory Constraints for AI Coding Assistants**

---

## 0. AUTHORITY & PURPOSE

**THIS DOCUMENT IS LAW.**

This file MUST be included in every AI coding session for VIO LOCAL. It exists to prevent AI drift, over-engineering, and architectural inconsistency. Violations of these rules are bugs, regardless of how "clean" the code looks.

**HIERARCHY OF AUTHORITY:**
1. User's explicit instructions (highest)
2. AI_GUARDRAILS.md (this document)
3. MASTER_RULES.md
4. Existing codebase patterns
5. AI's training knowledge (lowest)

**WHEN IN CONFLICT, FOLLOW THE HIGHER AUTHORITY.**

---

## 1. MANDATORY PRE-FLIGHT CHECKS

**BEFORE WRITING ANY CODE, AI MUST:**

### 1.1 Read Before Writing
```
[ ] Read the existing file (if modifying)
[ ] Check related files for patterns
[ ] Verify the requested change scope
[ ] Confirm dependencies already exist
[ ] Check if similar code exists elsewhere
```

### 1.2 Confirm Before Acting
```
IF the task involves >50 lines of new code:
    → Show plan, ask for approval first

IF the task involves modifying >2 files:
    → List files, ask for approval first

IF the task involves new dependencies:
    → State dependency, ask for approval first

IF the task involves new architectural patterns:
    → Explain choice, ask for approval first

IF the task is unclear or ambiguous:
    → Ask clarifying questions, do not assume
```

### 1.3 Scope Lock
```
The AI executes EXACTLY what was requested.
Nothing more. Nothing less.

User asked: "Fix this bug"
AI does: Fix the bug. Period.
AI does NOT: Fix bug + refactor + add tests + improve types
```

---

## 2. HARD ARCHITECTURAL CONSTRAINTS

### 2.1 Technology Stack Lock

**APPROVED STACK (DO NOT CHANGE):**
```
Backend:        Node.js + TypeScript + Express/Fastify
Database:       PostgreSQL + PostGIS
Cache:          Redis
Frontend:       Next.js 14+ (App Router)
Styling:        Tailwind CSS
State:          Zustand
Forms:          React Hook Form + Zod
Maps:           Google Maps JavaScript API
ORM:            Prisma
Testing:        Jest + React Testing Library + Playwright
```

**FORBIDDEN SUBSTITUTIONS:**
```
❌ NestJS         → Use Express/Fastify (lightweight)
❌ MongoDB        → Use PostgreSQL (we need PostGIS + joins)
❌ Redux          → Use Zustand (simpler)
❌ GraphQL        → Use REST (cacheable, simpler)
❌ Styled-components → Use Tailwind (utility-first)
❌ Material-UI    → Use Tailwind components (custom)
❌ tRPC           → Use REST (universal)
❌ Drizzle ORM    → Use Prisma (mature)
❌ Vitest         → Use Jest (ecosystem)
❌ Mapbox         → Use Google Maps (Vietnamese POI)
```

**RULE: NEVER suggest stack changes. If the user requests one, ask for explicit confirmation and document the migration plan.**

### 2.2 Architectural Pattern Lock

**MANDATORY PATTERNS:**
- Monolith (NOT microservices)
- REST API (NOT GraphQL, NOT tRPC)
- Server-rendered HTML for storefronts (NOT pure SPA)
- Stateless authentication (JWT, NOT sessions)
- Mobile-first responsive (NOT desktop-first)

**FORBIDDEN PATTERNS:**
```
❌ Microservices architecture
❌ Event-driven architecture (until needed)
❌ CQRS / Event Sourcing
❌ Hexagonal architecture / Clean architecture (over-engineered)
❌ Repository pattern with generic abstractions
❌ Service layer for simple CRUD
❌ DI containers (manual injection is fine)
❌ Decorators for routing (use explicit registration)
❌ Reactive programming (RxJS, etc.)
❌ Real-time bidirectional anything (WebSockets, SSE)
```

### 2.3 File Structure Lock

**MANDATORY STRUCTURE:**
```
src/
├── app/                    # Next.js App Router pages
├── components/             # React components
│   ├── ui/                 # Reusable primitives
│   ├── business/           # Domain-specific
│   └── layout/             # Headers, footers
├── lib/
│   ├── api/                # API client functions
│   ├── utils/              # Utility functions
│   └── validation/         # Zod schemas
├── hooks/                  # Custom React hooks
├── stores/                 # Zustand stores
└── types/                  # TypeScript types
```

**RULES:**
- DO NOT create new top-level folders without approval
- DO NOT create `services/`, `repositories/`, `controllers/`, `models/`, `entities/`, `dto/`, `interfaces/` folders
- DO NOT reorganize existing folders
- Place files in the most obvious location, not the "most architecturally correct" location

---

## 3. UI CONSTRAINTS

### 3.1 Approved UI Patterns (LOCKED)

**LAYOUT:**
```
- Mobile-first design (320px baseline)
- Touch targets: ≥ 44px × 44px
- Body text: ≥ 16px
- Container max-width: 1280px
- Padding: 16px mobile, 24px tablet, 32px desktop
```

**COLORS (DO NOT CHANGE):**
```css
--vio-green-primary: #16a34a;
--vio-green-dark: #15803d;
--vio-green-light: #22c55e;
--vio-blue-info: #3b82f6;
--vio-yellow-warning: #f59e0b;
--vio-red-error: #ef4444;
--vio-gray-text: #374151;
--vio-gray-border: #d1d5db;
--vio-gray-bg: #f3f4f6;
```

**TYPOGRAPHY (LOCKED):**
```
Font: Inter, system-ui
Sizes: 12, 14, 16, 18, 20, 24, 30px ONLY
```

### 3.2 Forbidden UI Behaviors

**❌ AI MUST NEVER:**
- Redesign approved UI without explicit request
- Change colors that already exist in the codebase
- Replace existing components with "better" alternatives
- Add animations not requested by user
- Suggest UI libraries (shadcn, Material, Chakra, Ant Design)
- Introduce dark mode unless explicitly asked
- Add accessibility features beyond what's already there (unless asked)
- Modify CSS custom properties without permission
- Change font families
- Introduce gradients, shadows, or "modern" effects unsolicited
- Convert existing static UI to animated UI
- Replace native HTML inputs with custom components
- Add icons where none existed
- Modify spacing/padding values not directly relevant to the task

**❌ FORBIDDEN UI PATTERNS:**
- Carousels / sliders
- Infinite scroll
- Modal dialogs for critical actions
- Hamburger menus for primary navigation
- Hover-dependent interactions
- Loading spinners (use skeletons)
- Toast notifications for errors (use inline)
- Tooltips for critical info
- Accordion menus (use full pages)
- Tabbed interfaces (use separate pages)

### 3.3 Component Modification Rules

**WHEN ASKED TO MODIFY A COMPONENT:**
```
✅ DO:
- Change only what was requested
- Preserve existing prop interfaces
- Preserve existing class names
- Preserve existing accessibility attributes
- Keep the same component name

❌ DON'T:
- "Improve" the component while you're there
- Refactor JSX structure
- Rename variables for "clarity"
- Extract sub-components without permission
- Add new props "in case they're needed"
- Convert function to class or vice versa
- Change from controlled to uncontrolled (or reverse)
- Add useMemo/useCallback without proven need
```

---

## 4. SEO CONSTRAINTS

### 4.1 Mandatory SEO Elements

**EVERY STOREFRONT PAGE MUST INCLUDE:**
```typescript
// Required meta tags
<title>{businessName} - {district}, {province} | VIO LOCAL</title>
<meta name="description" content={businessDescription} />
<link rel="canonical" href={canonicalUrl} />

// Required Open Graph
<meta property="og:title" content={businessName} />
<meta property="og:description" content={businessDescription} />
<meta property="og:image" content={heroImageUrl} />
<meta property="og:url" content={canonicalUrl} />
<meta property="og:type" content="business.business" />

// Required structured data
<script type="application/ld+json">
  {JSON.stringify(localBusinessSchema)}
</script>
```

**URL STRUCTURE (LOCKED):**
```
/{province-slug}/{district-slug}/{business-slug}

Example:
/dong-nai/tan-phu/ca-tuoi-ba-nam

NEVER:
❌ /business/12345
❌ /stores/ca-tuoi-ba-nam
❌ /b/ca-tuoi-ba-nam-dong-nai-tan-phu
❌ /?id=12345
```

### 4.2 Vietnamese SEO Rules

**SLUG GENERATION:**
```typescript
// MUST normalize Vietnamese characters
function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')  // Remove diacritics
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

// "Cá Tươi Bà Năm" → "ca-tuoi-ba-nam"
```

**METADATA LANGUAGE:**
- Page titles: Vietnamese
- Meta descriptions: Vietnamese
- Alt text: Vietnamese
- Structured data: Vietnamese values, English keys (Schema.org)

### 4.3 Forbidden SEO Behaviors

**❌ AI MUST NEVER:**
- Use English slugs when Vietnamese is available
- Use numeric IDs in URLs
- Skip structured data on storefront pages
- Add `noindex` to public storefronts
- Implement client-side-only rendering for SEO pages
- Use generic meta descriptions (must be unique per page)
- Modify the URL structure without explicit approval
- Add tracking parameters to canonical URLs
- Suggest "SEO hacks" (keyword stuffing, hidden text, etc.)

---

## 5. DATABASE CONSTRAINTS

### 5.1 Schema Modification Rules

**ADDING TABLES:**
```
✅ ALLOWED with approval:
- Adding new tables for new entities
- Adding new columns to existing tables

❌ FORBIDDEN without explicit approval:
- Dropping tables
- Dropping columns
- Renaming tables/columns
- Changing column types (especially narrowing)
- Removing indexes
- Removing foreign keys
- Changing primary keys
```

**MANDATORY COLUMN PATTERNS:**
```sql
-- Every table MUST have:
id          bigserial PRIMARY KEY,
created_at  timestamp NOT NULL DEFAULT now(),
updated_at  timestamp NOT NULL DEFAULT now(),

-- Soft-deletable tables MUST have:
deleted_at  timestamp,  -- NULL = active

-- Audit-required tables MUST have:
created_by  bigint REFERENCES users(id),
updated_by  bigint REFERENCES users(id)
```

### 5.2 Query Constraints

**MANDATORY:**
- Use parameterized queries (Prisma handles this)
- Use indexes for `WHERE`, `ORDER BY`, `JOIN` columns
- Use `LIMIT` on all list queries (default 20, max 100)
- Use `EXPLAIN ANALYZE` for queries that might be slow

**FORBIDDEN:**
```
❌ SELECT * (specify columns)
❌ String concatenation for SQL (use parameters)
❌ N+1 queries (use joins or batched queries)
❌ Querying inside loops
❌ Loading entire tables into memory
❌ Subqueries when joins work
❌ Stored procedures (logic in app layer)
❌ Triggers (explicit application code)
❌ Database views (materialize when needed)
```

### 5.3 Migration Rules

**EVERY MIGRATION MUST:**
- Be reversible (have a `down` function)
- Be tested locally before commit
- Be backward-compatible (no breaking changes)
- Be small and focused (one logical change)
- Be in chronological order (no editing past migrations)

**MIGRATION ANTI-PATTERNS:**
```
❌ Editing a committed migration
❌ Combining unrelated changes in one migration
❌ Migrations that take >10 seconds (use background jobs)
❌ Migrations that lock tables for long periods
❌ Migrations without rollback plan
❌ Data migrations mixed with schema migrations
```

### 5.4 Forbidden Database Behaviors

**❌ AI MUST NEVER:**
- Suggest migrating to NoSQL (MongoDB, DynamoDB, etc.)
- Suggest sharding before 1M records
- Suggest read replicas before 100k records
- Add columns "for future use"
- Use JSONB for data that should be relational
- Use ENUMs (use lookup tables for extensibility)
- Use UUIDs unless explicitly required (bigserial is faster)
- Suggest ORMs other than Prisma
- Bypass Prisma with raw SQL unless absolutely necessary
- Create indexes preemptively (only after measuring)

---

## 6. GEOGRAPHIC DATA CONSTRAINTS

### 6.1 Address Hierarchy Lock

**MANDATORY STRUCTURE:**
```
country     (Việt Nam - always)
↓
province    (Tỉnh - required)
↓
district    (Huyện - required)
↓
commune     (Xã/Phường - required)
↓
village     (Ấp/Thôn - optional)
↓
street      (Đường - optional)
↓
building    (Số nhà - optional)
```

**FORBIDDEN MODIFICATIONS:**
- Adding new hierarchy levels
- Skipping hierarchy levels
- Using ZIP codes (not relevant in rural Vietnam)
- Using state/region (use province only)
- Combining province + district in single field

### 6.2 Coordinate Storage

**MANDATORY:**
```sql
-- Use PostGIS geography type
location geography(Point, 4326) NOT NULL

-- Use GIST index for spatial queries
CREATE INDEX idx_location ON addresses USING GIST(location);
```

**FORBIDDEN:**
```
❌ Storing lat/lng as separate columns
❌ Storing as VARCHAR or TEXT
❌ Using geometry instead of geography type
❌ Using SRID other than 4326 (WGS84)
❌ Storing coordinates as JSON
❌ Storing without PostGIS index
```

### 6.3 Geographic Query Patterns

**APPROVED PATTERNS:**
```sql
-- Nearby search (use this)
ST_DWithin(
  location,
  ST_SetSRID(ST_MakePoint($lng, $lat), 4326)::geography,
  $radius_meters
)

-- Distance calculation (use this)
ST_Distance(
  location,
  ST_SetSRID(ST_MakePoint($lng, $lat), 4326)::geography
) / 1000 AS distance_km
```

**FORBIDDEN PATTERNS:**
```
❌ Manual Haversine formula in SQL
❌ Distance calculation in application layer
❌ Bounding box without spatial index
❌ Calculating distance for every row (use ST_DWithin first)
❌ Storing pre-calculated distances
```

### 6.4 Province/District Data Source

**APPROVED:** Vietnam GSO (General Statistics Office) administrative codes

**LOCKED PROVINCE/DISTRICT LIST:**
- Use the official 63 provinces (do not invent)
- Use official district names (do not abbreviate)
- Store reference data in seeded tables (not hardcoded)

**FORBIDDEN:**
```
❌ Hardcoding province/district lists in code
❌ Using English names ("Ho Chi Minh" → use "Hồ Chí Minh")
❌ Allowing free-text province input (must be dropdown)
❌ Mixing province formats (with/without "Tỉnh" prefix)
```

---

## 7. MOBILE-FIRST CONSTRAINTS

### 7.1 Mandatory Mobile Rules

**EVERY UI CHANGE MUST:**
```
✅ Work on 320px width minimum
✅ Have touch targets ≥ 44px
✅ Use 16px+ font for body text
✅ Avoid hover-dependent interactions
✅ Load < 500KB initial bundle
✅ First contentful paint < 1.5s on slow 4G
```

### 7.2 Performance Budget (HARD LIMITS)

```
FCP (First Contentful Paint):    < 1.5s
LCP (Largest Contentful Paint):  < 2.5s
TTI (Time to Interactive):       < 3.5s
CLS (Cumulative Layout Shift):   < 0.1
Initial JS bundle (gzipped):     < 150KB
Initial page weight:             < 500KB
```

**IF YOUR CHANGE EXCEEDS THESE LIMITS, IT IS REJECTED.**

### 7.3 Forbidden Mobile Anti-Patterns

**❌ NEVER:**
- Use viewport widths that break < 320px
- Implement features that require >3.5s to load
- Add libraries that increase bundle by >50KB
- Use horizontal scroll for primary content
- Stack >5 inputs vertically without progressive disclosure
- Use `position: fixed` for primary navigation on mobile
- Implement parallax scrolling
- Use full-screen images that take >200KB
- Auto-play video or audio
- Disable zoom (`user-scalable=no`)

### 7.4 Image Handling Rules

**MANDATORY:**
```html
<!-- All images must have: -->
<img
  src="..."
  alt="..." 
  loading="lazy"
  width="..."
  height="..."
/>
```

**REQUIREMENTS:**
- Lazy load below-fold images
- Specify width/height (prevent CLS)
- Provide alt text in Vietnamese
- Use WebP with JPEG fallback
- Use responsive srcset for storefront heroes
- Max 5MB upload, auto-resize on server

**FORBIDDEN:**
- Loading full-size images on mobile
- Using `<img>` without dimensions
- Background images for content (use `<img>`)
- SVGs >50KB (use raster instead)

---

## 8. FORBIDDEN IMPLEMENTATION PATTERNS

### 8.1 Over-Engineering Patterns

**❌ NEVER IMPLEMENT WITHOUT EXPLICIT REQUEST:**

```typescript
// ❌ Generic repository pattern
class GenericRepository<T> { ... }

// ❌ Abstract factory
class BusinessFactory {
  static create(type: string): Business { ... }
}

// ❌ Observer pattern for simple state
class EventEmitter { ... }

// ❌ Command pattern for CRUD
class CreateBusinessCommand { ... }

// ❌ Strategy pattern for two cases
interface SearchStrategy { ... }

// ❌ Builder pattern for simple objects
class BusinessBuilder { ... }

// ❌ Dependency injection containers
container.register('businessService', ...);
```

### 8.2 Premature Abstraction Patterns

**❌ DO NOT CREATE:**

```typescript
// ❌ "Reusable" components used once
// ❌ Generic types used in only one place
// ❌ Wrapper functions around stdlib
// ❌ Custom hooks for one-time logic
// ❌ Higher-order components instead of hooks
// ❌ Utility functions used 1-2 times
// ❌ Type aliases that obscure types
// ❌ Configuration objects for simple functions
// ❌ Plugin systems for static features
// ❌ Event bus for direct function calls
```

### 8.3 Premature Optimization Patterns

**❌ DO NOT OPTIMIZE UNTIL MEASURED:**

```typescript
// ❌ useMemo/useCallback without proven re-render issue
const memoized = useMemo(() => simpleValue, [dep]);

// ❌ React.memo without proven render cost
export default React.memo(SimpleComponent);

// ❌ Lazy loading single components
const Component = lazy(() => import('./Component'));

// ❌ Code splitting for small features
import('./feature').then(...)

// ❌ Virtualization for short lists
<VirtualList items={shortList} />

// ❌ Debouncing for infrequent events
const debouncedFn = debounce(fn, 300);

// ❌ Memoizing pure calculations
const total = useMemo(() => a + b, [a, b]);
```

### 8.4 Business Logic Duplication

**❌ NEVER DUPLICATE:**

```typescript
// ❌ Phone number validation in multiple places
// ❌ Slug generation in client AND server
// ❌ Distance calculation in JS AND SQL
// ❌ Vietnamese text normalization
// ❌ Address formatting
// ❌ Business status logic
// ❌ Permission checks
// ❌ Error messages
```

**RULE: One source of truth per piece of logic. Place in `/lib/` and import everywhere.**

### 8.5 Type System Abuse

**❌ FORBIDDEN:**

```typescript
// ❌ `any` type (use unknown or proper type)
function process(data: any) { ... }

// ❌ Type assertions without validation
const business = data as Business;

// ❌ Non-null assertions
const id = business.id!;

// ❌ ts-ignore / ts-expect-error
// @ts-ignore
brokenCode();

// ❌ Overly complex generics
type Complex<T extends U & V, U = T['key'], V = ...> = ...

// ❌ Type gymnastics (conditional types for simple cases)
type Result<T> = T extends string ? T[] : T extends number ? ... 

// ❌ Enum types (use const objects)
enum Status { Active, Inactive }
```

---

## 9. FORBIDDEN AI BEHAVIORS

### 9.1 Scope Creep Behaviors

**❌ AI MUST NEVER:**

1. **Refactor while fixing**
   - User asks: "Fix this bug"
   - AI does: Only fixes the bug
   - AI does NOT: Refactor the surrounding function

2. **Improve unrelated code**
   - User asks: "Add a button here"
   - AI does: Adds the button
   - AI does NOT: Notice and "improve" the navbar

3. **Add unrequested features**
   - User asks: "Show business name"
   - AI does: Shows the business name
   - AI does NOT: Also add rating, distance, hours

4. **Modernize code style**
   - User asks: "Add a new function"
   - AI does: Matches existing style
   - AI does NOT: Convert nearby code to "modern" patterns

5. **Add tests unprompted**
   - User asks: "Implement this feature"
   - AI does: Implements the feature
   - AI does NOT: Add 50 tests unless asked

6. **Add documentation unprompted**
   - User asks: "Write this function"
   - AI does: Writes the function with minimal comments
   - AI does NOT: Add JSDoc, README updates, etc.

### 9.2 Hallucination Prevention

**❌ AI MUST NEVER:**

1. **Invent dependencies that don't exist**
   - Verify package exists before importing
   - Check package.json before assuming version
   - Don't suggest packages without verifying

2. **Invent API endpoints**
   - Check the actual API routes
   - Don't assume endpoints exist
   - Ask if unsure

3. **Invent database columns**
   - Check the actual schema
   - Don't assume fields exist
   - Verify with Prisma schema

4. **Invent file paths**
   - Verify files exist before importing
   - Use absolute paths from project root
   - Don't guess at structure

5. **Invent Vietnamese text**
   - Don't auto-translate to Vietnamese
   - Use existing strings from codebase
   - Ask user for proper Vietnamese phrasing

### 9.3 Suggestion Drift

**❌ AI MUST NEVER SUGGEST:**

```
"While we're here, we should also..."
"Consider refactoring this to..."
"This would be cleaner with..."
"Best practice would be to..."
"For better performance..."
"For type safety..."
"For maintainability..."
"In modern React/Node..."
```

**UNLESS THE USER EXPLICITLY ASKS FOR SUGGESTIONS.**

### 9.4 Architecture Drift

**❌ AI MUST NEVER:**

1. Suggest changing the framework (Next.js → Remix, etc.)
2. Suggest changing the database (PostgreSQL → MongoDB)
3. Suggest changing the styling system (Tailwind → CSS modules)
4. Suggest changing the state management (Zustand → Redux)
5. Suggest splitting the monolith into services
6. Suggest adding event-driven architecture
7. Suggest adding queues for synchronous operations
8. Suggest adding GraphQL "for flexibility"
9. Suggest WebSockets for non-real-time features
10. Suggest server-side state management libraries

### 9.5 Verbose Behaviors

**❌ AI MUST NEVER:**

- Add comments explaining obvious code
- Add console.log for "debugging" in final code
- Add TODO comments instead of asking
- Write long explanations when code is self-explanatory
- Repeat the user's request back at length
- Provide multiple implementations when one was asked for
- Show before/after of every change unprompted
- Apologize repeatedly for misunderstandings
- Pad responses with disclaimers
- Suggest "let me know if you need..." after every response

---

## 10. CODE MODIFICATION RULES

### 10.1 The Minimum Change Principle

**RULE: Make the smallest change that solves the problem.**

```
TASK: "The button color is wrong, should be green"

✅ CORRECT MODIFICATION:
- Find the button
- Change color from X to green
- DONE.

❌ INCORRECT MODIFICATION:
- Find the button
- Change color from X to green
- "While I'm here, let me also..."
- ...refactor the click handler
- ...extract a Button component
- ...add accessibility improvements
- ...migrate to a design system
- ...add hover effects
- ...add a loading state
```

### 10.2 Diff-Friendly Changes

**RULES:**
- Don't reformat unrelated code
- Don't reorder imports unless asked
- Don't reorder functions in a file
- Don't change quote styles (single ↔ double)
- Don't change semicolon usage
- Don't change indentation style
- Don't change line endings (CRLF ↔ LF)

**REASON:** Every unrelated change makes code review harder and obscures intent.

### 10.3 Existing Pattern Preservation

**BEFORE WRITING NEW CODE:**

```
1. Find similar functionality in the codebase
2. Match its patterns:
   - Same file structure
   - Same import order
   - Same naming conventions
   - Same error handling style
   - Same logging approach
   - Same test patterns
3. Deviate ONLY if the user requests it
```

**EXAMPLE:**
```typescript
// If existing code uses:
export async function getBusiness(id: string) { ... }

// Then new code should use:
export async function getProduct(id: string) { ... }

// NOT:
export const getProduct = async (id: string) => { ... }
// NOT:
class ProductService {
  async get(id: string) { ... }
}
```

### 10.4 No-Touch Zones

**AI MUST NOT MODIFY (without explicit request):**

```
❌ package.json (unless adding requested dependency)
❌ tsconfig.json
❌ next.config.js
❌ tailwind.config.js
❌ .env files
❌ Migration files (after creation)
❌ Generated files (Prisma client, etc.)
❌ README.md
❌ MASTER_RULES.md
❌ AI_GUARDRAILS.md (THIS FILE)
❌ CI/CD configuration
❌ Docker files
❌ Database seed files (unless explicitly working on them)
```

### 10.5 Refactoring Rules

**REFACTORING IS A SEPARATE TASK.**

```
✅ ALLOWED: User says "refactor this function"
✅ ALLOWED: User says "extract this into a hook"
✅ ALLOWED: User says "improve the structure of X"

❌ FORBIDDEN: AI decides to refactor during a different task
❌ FORBIDDEN: AI refactors "for clarity" or "best practices"
❌ FORBIDDEN: AI splits files because they're "too long"
❌ FORBIDDEN: AI extracts components because they're "complex"
```

---

## 11. DEPENDENCY RULES

### 11.1 Adding Dependencies

**BEFORE ADDING ANY DEPENDENCY:**

```
1. Check if functionality exists in current stack
2. Check if standard library can do it
3. Check bundle size impact (must be < 50KB gzipped)
4. Check maintenance status (last commit < 6 months)
5. Check security advisories
6. Ask user for explicit approval
```

### 11.2 Forbidden Dependencies

**❌ NEVER ADD WITHOUT APPROVAL:**

```
UI Libraries:
❌ Material-UI / MUI
❌ Ant Design
❌ Chakra UI
❌ Mantine
❌ Bootstrap
❌ Semantic UI

State Management:
❌ Redux / Redux Toolkit
❌ MobX
❌ Recoil
❌ Jotai
❌ Valtio

Forms:
❌ Formik
❌ Final Form

Routing:
❌ React Router (Next.js has its own)

HTTP Clients:
❌ Axios (use fetch)
❌ SWR (use React Query if needed)

Date Libraries:
❌ Moment.js (use date-fns if needed)
❌ Day.js

CSS-in-JS:
❌ Styled-components
❌ Emotion
❌ Linaria

Misc:
❌ Lodash (use native + targeted imports)
❌ Ramda
❌ jQuery
❌ Underscore
```

### 11.3 Approved Dependencies Only

**STANDARD STACK:**
```json
{
  "next": "^14.0.0",
  "react": "^18.0.0",
  "react-dom": "^18.0.0",
  "typescript": "^5.0.0",
  "tailwindcss": "^3.4.0",
  "zustand": "^4.4.0",
  "react-hook-form": "^7.45.0",
  "zod": "^3.22.0",
  "@prisma/client": "^5.0.0",
  "prisma": "^5.0.0",
  "lucide-react": "^0.290.0",
  "@googlemaps/js-api-loader": "^1.16.0",
  "date-fns": "^2.30.0",
  "redis": "^4.6.0",
  "express": "^4.18.0",
  "fastify": "^4.24.0",
  "jest": "^29.7.0",
  "playwright": "^1.40.0"
}
```

**NO OTHER DEPENDENCIES WITHOUT EXPLICIT APPROVAL.**

---

## 12. AUTHENTICATION & SECURITY CONSTRAINTS

### 12.1 Authentication Pattern Lock

**APPROVED:**
- SMS OTP for login (Vietnamese phone numbers)
- JWT for session tokens
- Refresh tokens stored in httpOnly cookies
- Rate limiting on auth endpoints

**FORBIDDEN:**
```
❌ Password-based authentication
❌ Social login (Google, Facebook OAuth)
❌ Magic links (rural users prefer phone)
❌ TOTP / 2FA apps (smartphone-dependent)
❌ Biometric authentication
❌ Server-side sessions with cookies
❌ Auth0 / Clerk / Supabase Auth (vendor lock-in)
```

### 12.2 Security Mandatory

**EVERY API ENDPOINT MUST:**
```typescript
// Validate inputs with Zod
const schema = z.object({ ... });
const data = schema.parse(input);

// Check authentication for protected routes
const user = await requireAuth(req);

// Check authorization
if (!canAccessBusiness(user, businessId)) {
  throw new UnauthorizedError();
}

// Rate limit
await rateLimit(req, 'endpoint-name');

// Log security events
logger.info('action', { user: user.id, action: '...' });
```

### 12.3 Forbidden Security Patterns

```
❌ Storing passwords (we don't use them)
❌ Storing JWT in localStorage (use httpOnly cookies)
❌ Logging sensitive data (phone numbers, OTPs)
❌ Returning internal errors to clients
❌ Trusting client-side validation only
❌ Skipping CSRF protection on mutations
❌ Using HTTP (always HTTPS)
❌ Allowing CORS from any origin
❌ Storing secrets in code (use env vars)
```

---

## 13. ERROR HANDLING CONSTRAINTS

### 13.1 Error Response Format Lock

**ALL ERRORS MUST USE THIS FORMAT:**
```typescript
{
  success: false,
  error: {
    code: 'ERROR_CODE_HERE',     // Machine-readable
    message: 'Vietnamese message', // User-facing
    details?: { ... }             // Optional context
  }
}
```

**ERROR CODES MUST BE:**
- SCREAMING_SNAKE_CASE
- Descriptive (`BUSINESS_NOT_FOUND` not `ERR_404`)
- Consistent across endpoints
- Documented in a central location

### 13.2 User-Facing Messages

**RULES:**
- ALWAYS in Vietnamese
- NEVER expose internal errors
- ALWAYS actionable ("Vui lòng thử lại" not "Database error")
- NEVER include stack traces
- NEVER include SQL errors

### 13.3 Forbidden Error Patterns

```
❌ throw new Error('something went wrong')  // Too generic
❌ res.status(500).send(error.stack)          // Information leak
❌ console.error(error)                       // Use proper logger
❌ try { ... } catch {}                       // Silent failures
❌ Promise.catch(() => {})                    // Swallowed errors
❌ if (error) return null                     // Hide errors
```

---

## 14. TESTING CONSTRAINTS

### 14.1 When to Add Tests

**AI WRITES TESTS ONLY WHEN:**
- User explicitly asks for tests
- The task is "write tests for X"
- Bug fix requires regression test
- Critical path is being implemented

**AI DOES NOT WRITE TESTS WHEN:**
- Not asked
- For simple components
- For trivial functions
- "Just in case"

### 14.2 Test Style Lock

**MATCH EXISTING PATTERNS:**
- Use Jest + React Testing Library
- One test file per source file (`X.test.ts` next to `X.ts`)
- Describe block per function/component
- Test names: `should [expected behavior] when [condition]`

**FORBIDDEN:**
```
❌ Mocha / Chai
❌ Cypress (use Playwright)
❌ Snapshot tests (brittle)
❌ Testing implementation details
❌ 100% coverage as a goal
❌ Tests that test the framework
```

---

## 15. SELF-VERIFICATION PROTOCOL

### 15.1 Before Submitting Any Code

**AI MUST VERIFY:**

```
[ ] Did I do EXACTLY what was asked?
[ ] Did I avoid scope creep?
[ ] Did I match existing patterns?
[ ] Did I avoid adding unrequested abstractions?
[ ] Did I avoid suggesting alternatives unprompted?
[ ] Did I preserve existing code style?
[ ] Did I avoid touching unrelated files?
[ ] Did I avoid adding unnecessary dependencies?
[ ] Did I avoid premature optimization?
[ ] Did I avoid premature abstraction?
[ ] Is mobile-first respected?
[ ] Is the Vietnamese language used correctly?
[ ] Are existing conventions followed?
```

### 15.2 Compliance Statement

**EVERY CODE RESPONSE SHOULD END WITH:**

If significant changes were made, AI confirms:
```
✓ Scope: Only modified [specific files/sections]
✓ Patterns: Matched existing [pattern type]
✓ No changes to: [unrelated systems]
```

If the task was simple, this can be omitted.

### 15.3 Escalation Triggers

**STOP AND ASK USER IF:**

```
- The task requires changing >3 files
- The task requires adding a dependency
- The task conflicts with existing patterns
- The task requires database migration
- The task affects authentication/security
- The task affects SEO/URL structure
- The task could break existing functionality
- The task is ambiguous or has multiple interpretations
- The task suggests architectural changes
- The user's request contradicts these guardrails
```

**HOW TO ASK:**
```
"This task requires [specific action]. 
Before proceeding, I want to confirm:
1. [Specific question]
2. [Specific question]
Is this the approach you want?"
```

---

## 16. COMMUNICATION CONSTRAINTS

### 16.1 Response Format

**FOR CODE TASKS:**
```
1. Brief acknowledgment (1 sentence max)
2. Plan (if non-trivial, 2-3 bullet points)
3. Code (the actual implementation)
4. Compliance note (if significant changes)
```

**DO NOT:**
- Restate the user's request
- Provide lengthy preambles
- Explain what you're about to do at length
- Provide tutorials on the technology
- Suggest "improvements" after delivering

### 16.2 When Uncertain

**AI MUST:**
```
✅ Ask specific clarifying questions
✅ State assumptions explicitly
✅ Offer to research/verify before proceeding
✅ Acknowledge uncertainty

❌ DON'T:
❌ Guess and hope
❌ Provide multiple "options" to dodge decisions
❌ Make architectural decisions without input
❌ Add safety features "just in case"
```

### 16.3 Language Rules

**FOR USER-FACING CONTENT (in code):**
- Vietnamese only
- Match existing tone (formal "Quý khách" or casual "Bạn")
- No mixed English-Vietnamese
- No machine translation

**FOR DEVELOPER-FACING CONTENT (comments, docs):**
- English is fine for technical comments
- Vietnamese is fine for business logic comments
- Be consistent within a file

---

## 17. THE 10 COMMANDMENTS

**SIMPLIFIED RULES FOR QUICK REFERENCE:**

1. **DO EXACTLY WHAT WAS ASKED** — No more, no less.
2. **PRESERVE EXISTING PATTERNS** — Don't introduce new ones.
3. **ASK BEFORE EXPANDING SCOPE** — Even small expansions.
4. **MOBILE-FIRST ALWAYS** — Test at 320px width.
5. **VIETNAMESE USERS FIRST** — Not generic global users.
6. **NO NEW DEPENDENCIES** — Without explicit approval.
7. **NO PREMATURE OPTIMIZATION** — Measure first.
8. **NO PREMATURE ABSTRACTION** — Three uses minimum.
9. **NO ARCHITECTURE CHANGES** — Stack is locked.
10. **NO REFACTORING IN BUG FIXES** — Separate concerns.

---

## 18. VIOLATION CONSEQUENCES

**WHEN AI VIOLATES THESE RULES:**

The user will:
1. Point out the violation
2. Reject the change
3. Request a corrected version

**WHEN AI VIOLATES REPEATEDLY:**

The user should:
1. Re-share this document
2. Quote specific rules
3. Request explicit acknowledgment

**AI SHOULD:**
- Acknowledge the violation specifically
- Not be defensive
- Not provide excuses
- Make the corrected change
- Be more careful going forward

---

## 19. EXAMPLES OF GOOD vs BAD AI BEHAVIOR

### 19.1 Bug Fix Request

**TASK:** "Fix the bug where the phone number isn't displaying"

**❌ BAD AI RESPONSE:**
```
I noticed several issues with this code. Let me fix them all:
1. The phone number display bug
2. The component should be memoized
3. The phone formatting should use a utility
4. I'll extract a usePhone hook
5. I'll add proper TypeScript types
6. I'll add tests for all the cases

[100 lines of changes touching 8 files]
```

**✅ GOOD AI RESPONSE:**
```
The bug: phone number was checking `phone.value` but the prop is `phone`.

[5-line change in 1 file]

Tested: Phone now displays correctly.
```

### 19.2 New Feature Request

**TASK:** "Add a 'Hours Today' display to business cards"

**❌ BAD AI RESPONSE:**
```
I'll add this with a few enhancements:
1. A reusable BusinessHours component
2. A useBusinessHours hook
3. Support for multi-day display
4. Holiday handling
5. Time zone support
6. Animation when hours change

Also, I noticed the card layout could be improved...
```

**✅ GOOD AI RESPONSE:**
```
Adding "Hours Today" to the business card.

[Modification to BusinessCard.tsx only, ~15 lines]

The hours are pulled from existing business.hours data, 
filtered to today's day of week, and displayed below 
the category tag.
```

### 19.3 Refactoring Request

**TASK:** "The search function is slow, can you investigate?"

**❌ BAD AI RESPONSE:**
```
I see several issues. Let me rewrite this with:
- Elasticsearch integration
- A new caching layer
- Redux for state management
- Suspense for loading
- Code splitting

[Massive rewrite]
```

**✅ GOOD AI RESPONSE:**
```
Let me investigate first.

Looking at the search function, I see:
1. It runs the query without an index on `location`
2. It doesn't use `ST_DWithin` (filters all rows first)
3. It loads full business data when it only needs summaries

Suggested fixes (smallest to largest impact):
1. Add GIST index on location column [database migration]
2. Use ST_DWithin in the WHERE clause [SQL change]
3. Select only needed columns [SQL change]

Which would you like me to implement?
```

---

## 20. FINAL DIRECTIVE

**THE AI'S JOB IS TO:**
- Solve the specific problem given
- Match existing patterns
- Preserve working code
- Ask when uncertain
- Be concise in communication
- Respect the user's architectural decisions

**THE AI'S JOB IS NOT TO:**
- Improve the codebase generally
- Demonstrate best practices
- Show off architectural knowledge
- Optimize prematurely
- Abstract prematurely
- Modernize legacy code unprompted
- Add features the user might want

**WHEN IN DOUBT, DO LESS, NOT MORE.**

---

**END OF AI GUARDRAILS v1.0**

*This document is to be included in every AI coding session for VIO LOCAL. Violations are bugs. The AI's restraint is more valuable than the AI's creativity in this project.*