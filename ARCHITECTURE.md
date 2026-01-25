# CUTOFF — Chrome Extension Architecture
**Version:** 1.0.0  
**Type:** Decision Enforcer (Anti-Productivity Tool)  
**Platform:** Chrome Extension (Manifest V3)

---

## 🎯 CORE PRINCIPLES

### Product Class: Decision Enforcer
- **NOT:** Productivity tool, knowledge manager, habit tracker
- **IS:** State machine that forces closure of open loops

### Brand Identity
```
Cutoff doesn't help you move forward.
It stops you from pretending you already did.
```

**Tone:** Cold, neutral, factual  
**Character:** Machine, not assistant  
**Metric:** Fewer avoided cutoffs (NOT engagement/retention)

---

## 🏗️ SYSTEM ARCHITECTURE

### 1. Domain Model (State Machine)

```typescript
// Card States (Finite State Machine)
type CardState = 
  | 'uncommitted'   // Attention captured, no decision
  | 'confronting'   // User entered confrontation gate
  | 'started'       // Execute chosen (≤15min action)
  | 'suspended'     // Schedule chosen (loop still open)
  | 'discarded'     // Discard chosen (loop closed)

// Character States (System Reflection)
type CharacterState = 
  | 'cluttered'     // Many uncommitted cards
  | 'overloaded'    // Many suspended cards
  | 'clear'         // Few open loops
  | 'focused'       // Active starts, minimal accumulation

// Decision Types
type Decision = 'start' | 'schedule' | 'discard'

// Source Types
type SourceType = 'url' | 'text' | 'file'
```

**State Transition Rules:**
```
uncommitted → confronting (user clicks card)
confronting → started | suspended | discarded (forced choice)
started → [removed after stop-rule]
suspended → [remains, increases pressure]
discarded → [removed immediately]
```

**Critical Constraints:**
- `uncommitted` ≠ progress
- `schedule` does NOT close loop
- `discard` ALWAYS closes loop
- Character reflects system state, NOT user effort

---

### 2. Chrome Extension Architecture (Manifest V3)

```
┌─────────────────────────────────────────────────────┐
│                  CHROME EXTENSION                    │
├─────────────────────────────────────────────────────┤
│                                                      │
│  ┌──────────────┐  ┌──────────────┐  ┌───────────┐ │
│  │   Popup      │  │  Side Panel  │  │  Context  │ │
│  │   (Capture)  │  │  (Character) │  │   Menu    │ │
│  └──────┬───────┘  └──────┬───────┘  └─────┬─────┘ │
│         │                 │                 │        │
│         └─────────────────┼─────────────────┘        │
│                           │                          │
│                  ┌────────▼────────┐                 │
│                  │ Background SW   │                 │
│                  │ (State Manager) │                 │
│                  └────────┬────────┘                 │
│                           │                          │
│         ┌─────────────────┼─────────────────┐        │
│         │                 │                 │        │
│  ┌──────▼───────┐  ┌──────▼──────┐  ┌──────▼─────┐ │
│  │ chrome.      │  │  chrome.    │  │   AI API   │ │
│  │ storage.     │  │  alarms     │  │  (Gemini)  │ │
│  │ local        │  │             │  │            │ │
│  └──────────────┘  └─────────────┘  └────────────┘ │
│                                                      │
└─────────────────────────────────────────────────────┘
                           │
                           │ (Optional sync)
                           ▼
                  ┌─────────────────┐
                  │  Backend API    │
                  │  (Neon + Prisma)│
                  │  (Reflection    │
                  │   Dashboard)    │
                  └─────────────────┘
```

**Components:**

#### A. Popup (Primary Entry Point)
- **Purpose:** Universal capture interface
- **Size:** 400x600px
- **Inputs:** URL paste, text paste, file drop
- **Output:** Creates `uncommitted` card
- **No modes, no tabs, no type selection**

#### B. Side Panel (Character Mirror)
- **Purpose:** Visualize system state
- **Display:** Character state (cluttered/overloaded/clear/focused)
- **Cards:** Unsortable, unfilterable, unorganized
- **Pressure:** Visual density increases with open loops

#### C. Context Menu
- **Trigger:** Right-click on page
- **Action:** "Save to Cutoff" → Opens popup with URL pre-filled

#### D. Background Service Worker
- **State Management:** Zustand store (persisted to chrome.storage.local)
- **AI Coordination:** Sends requests to Gemini API
- **Alarms:** Triggers delayed confrontations (optional)

#### E. Storage Layer
- **Primary:** `chrome.storage.local` (unlimited, local-first)
- **Sync:** Optional backend for web dashboard reflection
- **Schema:** See Data Model below

---

### 3. Tech Stack

```yaml
Core:
  - TypeScript 5.7+
  - React 19 (for UI components)
  - Zustand 5 (state management)
  - Vite 6 (build tool with @crxjs/vite-plugin)

Chrome APIs:
  - chrome.storage.local (primary storage)
  - chrome.sidePanel (character display)
  - chrome.contextMenus (right-click capture)
  - chrome.alarms (delayed confrontation)

AI:
  - Google Gemini API (cloud-based)
  - Model: gemini-2.0-flash-exp (fast, cheap)

Styling:
  - CSS Modules (scoped, no Tailwind)
  - Design tokens from design-inspo
  - Colors: #000000, #BFFF00 (lime), gradients

Backend (Optional):
  - Next.js 15 (reflection dashboard)
  - Neon (PostgreSQL)
  - Prisma 7
  - Better-Auth (if user accounts needed)

Testing:
  - Vitest (unit tests)
  - Playwright (E2E for extension)
```

---

### 4. Data Model

```typescript
// Card (Primary Entity)
interface Card {
  id: string                    // UUID
  state: CardState              // FSM state
  sourceType: SourceType        // url | text | file
  sourceContent: string         // Raw input
  platformName?: string         // YouTube, Instagram, etc.
  extractedTitle?: string       // From URL metadata
  createdAt: number             // Unix timestamp
  confrontedAt?: number         // When user entered confrontation
  decidedAt?: number            // When decision was made
  decision?: Decision           // start | schedule | discard
  
  // Start-specific fields
  startAction?: string          // AI-generated single step
  startDuration?: number        // ≤ 15 minutes
  stopRule?: string             // AI-generated completion criteria
  
  // Reality Check (computed)
  daysWithoutAction?: number    // Computed from createdAt
}

// Character State (Computed)
interface CharacterMetrics {
  state: CharacterState         // cluttered | overloaded | clear | focused
  uncommittedCount: number      // Cards in uncommitted state
  suspendedCount: number        // Cards in suspended state
  totalOpenLoops: number        // uncommitted + suspended
  lastDiscardedAt?: number      // Last successful closure
}

// Settings
interface Settings {
  apiKey: string                // Gemini API key
  enableDelayedConfrontation: boolean
  confrontationDelayHours: number
}
```

---

### 5. AI Integration Points

**AI is ONLY used for:**
1. **Source Validation** (format check, NOT value judgment)
2. **Reality Check Generation** (time-based, factual)
3. **Start Action Generation** (single step, ≤15min, stop-rule)

**AI is NEVER used for:**
- Content summarization
- Motivation
- Explanation
- Recommendations

#### AI Prompt Templates

**A. Source Validation**
```typescript
const prompt = `
Format validation only. No value judgment.

Source: ${sourceContent}
Type: ${sourceType}

Respond in JSON:
{
  "isSupported": boolean,
  "platformName": string | null,
  "extractedTitle": string | null,
  "systemMessage": string // Cold, factual
}

Example messages:
- "This source can be stored. It cannot be acted on without a decision."
- "This format has no actionable outcome. Discard is likely."
`
```

**B. Reality Check**
```typescript
const prompt = `
Generate Reality Check. Cold, factual, no empathy.

Card created: ${daysAgo} days ago
Source: ${extractedTitle || sourceContent}
Action taken: None

Rules:
- State time without action
- State effect of saving (reduced anxiety)
- No motivation, no support
- 2-3 sentences max

Tone: "This was saved. No decision followed. Cutoff reached."
`
```

**C. Start Action**
```typescript
const prompt = `
Generate single executable step. ≤15 minutes.

Source: ${sourceContent}

Output JSON:
{
  "action": string,        // One concrete step
  "duration": number,      // Minutes (≤15)
  "stopRule": string       // How to know it's done
}

Rules:
- No explanations
- No resources
- No "open this link"
- Action must be completable without system help
`
```

---

### 6. Security & Privacy

**Principles:**
- Local-first: All cards stored in `chrome.storage.local`
- No tracking: Zero analytics, zero telemetry
- API key: User-provided, stored locally
- Permissions: Minimal (activeTab, storage, contextMenus, sidePanel)

**Manifest V3 Permissions:**
```json
{
  "permissions": [
    "storage",
    "contextMenus",
    "sidePanel"
  ],
  "host_permissions": [
    "https://generativelanguage.googleapis.com/*"
  ]
}
```

**Data Flow:**
```
User Input → Local Storage → AI API (ephemeral) → Local Storage
                ↓
         (Optional) Backend Sync (reflection only)
```

---

## 🎨 DESIGN SYSTEM

### Visual Language (from design-inspo)

**Colors:**
```css
--color-bg: #000000;
--color-primary: #BFFF00;      /* Neon lime */
--color-text: #FFFFFF;
--color-text-dim: #888888;
--color-gradient-start: #1A1A1A;
--color-gradient-end: #000000;
```

**Typography:**
```css
--font-family: 'Inter', -apple-system, sans-serif;
--font-weight-normal: 300;
--font-weight-bold: 500;
--font-size-xs: 11px;
--font-size-sm: 13px;
--font-size-base: 15px;
--font-size-lg: 24px;
--font-size-xl: 48px;
```

**Spacing:**
```css
--space-xs: 4px;
--space-sm: 8px;
--space-md: 16px;
--space-lg: 24px;
--space-xl: 48px;
```

**Principles:**
- Minimal UI elements
- No decorative elements
- High contrast (black + lime)
- Monospace for system messages
- Sans-serif for UI text

---

## 📁 FILE STRUCTURE

```
cutoff_extension/
├── manifest.json                 # Manifest V3 config
├── package.json
├── tsconfig.json
├── vite.config.ts                # Vite + @crxjs/vite-plugin
│
├── src/
│   ├── background/
│   │   ├── service-worker.ts     # Background service worker
│   │   └── ai-service.ts         # Gemini API integration
│   │
│   ├── popup/
│   │   ├── index.html
│   │   ├── Popup.tsx             # Main capture interface
│   │   ├── Popup.module.css
│   │   └── components/
│   │       ├── CaptureInput.tsx  # Universal input field
│   │       ├── SourceValidator.tsx
│   │       └── ConfrontationGate.tsx
│   │
│   ├── sidepanel/
│   │   ├── index.html
│   │   ├── SidePanel.tsx         # Character mirror
│   │   ├── SidePanel.module.css
│   │   └── components/
│   │       ├── CharacterState.tsx
│   │       ├── CardEnvironment.tsx
│   │       └── Card.tsx
│   │
│   ├── confrontation/
│   │   ├── index.html
│   │   ├── Confrontation.tsx     # Full-screen decision UI
│   │   ├── Confrontation.module.css
│   │   └── components/
│   │       ├── RealityCheck.tsx
│   │       ├── ForcedChoice.tsx
│   │       └── StartAction.tsx
│   │
│   ├── store/
│   │   ├── index.ts              # Zustand store
│   │   ├── card-store.ts         # Card state machine
│   │   ├── character-store.ts    # Character state computation
│   │   └── settings-store.ts     # User settings
│   │
│   ├── lib/
│   │   ├── storage.ts            # chrome.storage wrapper
│   │   ├── state-machine.ts      # FSM logic
│   │   └── types.ts              # TypeScript types
│   │
│   └── styles/
│       ├── tokens.css            # Design tokens
│       └── global.css            # Reset + base styles
│
├── public/
│   ├── icons/
│   │   ├── icon-16.png
│   │   ├── icon-48.png
│   │   └── icon-128.png
│   └── fonts/
│       └── Inter-VariableFont.woff2
│
└── docs/
    ├── ARCHITECTURE.md           # This file
    ├── STATE_MACHINE.md          # FSM documentation
    └── AI_PROMPTS.md             # AI prompt templates
```

---

## 🔄 USER FLOWS

### Flow 1: Capture (Popup)
```
1. User clicks extension icon OR right-clicks → "Save to Cutoff"
2. Popup opens (400x600px)
3. Universal input field:
   - Paste URL
   - Paste text
   - Drop file
4. System validates format (AI: Source Validation)
5. System message: "This source can be stored. It cannot be acted on without a decision."
6. Card created in `uncommitted` state
7. Popup closes
8. Side panel updates (if open)
```

### Flow 2: Confrontation Gate
```
1. User opens Side Panel
2. Sees cards in environment (unsortable, unfilterable)
3. Clicks on card
4. Warning: "This will require a decision. There is no exit."
5. User confirms
6. Card state: uncommitted → confronting
7. Full-screen confrontation UI opens
8. No close button, no back button
```

### Flow 3: Reality Check + Forced Choice
```
1. Confrontation UI displays:
   - Source reference
   - Days without action
   - Reality Check (AI-generated)
2. Text stops
3. Buttons appear (delayed 2s):
   - Execute
   - Schedule
   - This isn't important
4. User must choose (no exit)
5. Decision recorded
6. State transition:
   - Execute → started
   - Schedule → suspended
   - Discard → discarded (removed)
```

### Flow 4: Start (Execute)
```
1. User chooses Execute
2. AI generates:
   - Single step
   - Duration (≤15min)
   - Stop-rule
3. System displays action
4. Symbolic timer starts (not enforced)
5. User responsible for execution
6. After stop-rule: card removed
```

---

## 🚫 ANTI-PATTERNS (FORBIDDEN)

**DO NOT implement:**
- Card sorting/filtering/grouping
- Summary generation
- Content explanation
- Motivation messages
- Progress tracking (beyond state)
- Analytics/telemetry
- Onboarding tutorial
- Help documentation
- "Next step" suggestions
- Comfort-inducing UI

**If a feature:**
- Reduces pressure → Forbidden
- Provides comfort → Forbidden
- Explains content → Forbidden
- Tracks behavior → Forbidden

---

## 📊 SUCCESS METRICS

**Primary Metric:**
- Fewer avoided cutoffs (cards in `uncommitted` or `suspended` state)

**Secondary Metrics:**
- Discard rate (honest closure)
- Start completion rate (action taken)
- Time to decision (confrontation → choice)

**Anti-Metrics (DO NOT optimize for):**
- Daily active users
- Session duration
- Retention rate
- User satisfaction

---

## 🔐 PRIVACY & COMPLIANCE

**Data Storage:**
- All cards: Local (`chrome.storage.local`)
- No server-side storage (unless user opts into reflection dashboard)
- No third-party analytics

**API Usage:**
- Gemini API: Ephemeral requests only
- No conversation history
- No user profiling

**User Control:**
- API key: User-provided
- Data export: JSON download
- Data deletion: One-click clear

---

## 🛠️ DEVELOPMENT ROADMAP

### Phase 1: Core State Machine (Week 1)
- [ ] Zustand store with FSM logic
- [ ] chrome.storage.local persistence
- [ ] TypeScript types
- [ ] Unit tests for state transitions

### Phase 2: Capture Interface (Week 2)
- [ ] Popup UI (universal input)
- [ ] Context menu integration
- [ ] Source validation (AI)
- [ ] Card creation flow

### Phase 3: Confrontation System (Week 3)
- [ ] Side panel (character mirror)
- [ ] Confrontation gate
- [ ] Reality Check generation (AI)
- [ ] Forced choice UI

### Phase 4: Decision Execution (Week 4)
- [ ] Start action generation (AI)
- [ ] Schedule handling
- [ ] Discard flow
- [ ] Character state computation

### Phase 5: Polish & Security (Week 5)
- [ ] Design system implementation
- [ ] Security audit
- [ ] E2E tests (Playwright)
- [ ] Chrome Web Store submission

---

## 📚 REFERENCES

- **Brand Book:** See project docs
- **Design Inspo:** `concept/design-inspo/image.png`
- **Manifest V3:** https://developer.chrome.com/docs/extensions/mv3/
- **Gemini API:** https://ai.google.dev/gemini-api/docs

---

**Last Updated:** 2026-01-25  
**Status:** Architecture Locked ✅
