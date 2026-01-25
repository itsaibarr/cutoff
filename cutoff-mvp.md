# Implement Cutoff MVP Extension

## Goal
Build a functional MVP of "Cutoff" Chrome Extension (Manifest V3) with Capture, Confrontation, and Character Mirror mechanics.

---

## Phase 1: Foundation & Setup ✅ COMPLETED
- [x] Initialize Project: `npm create vite@latest cutoff_ext -- --template react-ts` → Verify: `npm run dev` works
- [x] Install Extension Deps: `npm i @crxjs/vite-plugin zustand clsx lucide-react uuid` → Verify: `package.json`
- [x] Configure Manifest V3: Create `manifest.json` with `sidePanel`, `storage`, `activeTab` permissions → Verify: Load unpacked extension in Chrome
- [x] Setup CRXJS in Vite: Configure `vite.config.ts` for extension build → Verify: `npm run build` produces valid extension
- [x] Setup File Structure: Replicate structure from `ARCHITECTURE.md` → Verify: Folders exist

## Phase 2: Core State Machine (FSM) ✅ COMPLETED
- [x] Implement Types: Define `Card`, `CardState`, `Decision` in `src/lib/types.ts`
- [x] Implement Storage Adapter: Wrapper for `chrome.storage.local` in `src/lib/storage.ts`
- [x] Build Zustand Store: Create `src/store/card-store.ts` with FSM logic (uncommitted -> confronting -> ...) → Verify: Store updates in console
- [x] Add Persistence: Connect Zustand to `chrome.storage.local`
- [ ] Test FSM: Write unit test `src/store/card-store.test.ts` for all transitions → Verify: `npm test` passes

## Phase 3: UI - Capture & Character ✅ COMPLETED
- [x] Design Tokens: Create `src/styles/tokens.css` (Black/Lime/Inter)
- [x] Capture Popup: Build `src/popup/Popup.tsx` (Universal Input) → Verify: Can input text/url
- [x] Side Panel: Build `src/sidepanel/SidePanel.tsx` (Character Mirror) → Verify: Panel opens in Chrome
- [x] Context Menu: Add `chrome.contextMenus` in `background.ts` → Verify: Right-click "Save to Cutoff" works
- [x] Connect Store to UI: Bind `cards` to Side Panel list

## Phase 4: Confrontation & AI
- [ ] Confrontation Gate: Create "No Exit" UI in Side Panel → Verify: Overlay blocks interaction
- [ ] AI Service: Implement `src/background/ai-service.ts` (Call Gemini API)
- [ ] Reality Check: Connect AI to generate "Days without action" text → Verify: Mock response works
- [ ] Forced Choice: Implement Start/Schedule/Discard buttons → Verify: Buttons change state
- [ ] Background SW: Handle Alarms for delayed confrontation

## Phase 5: Design & Polish
- [ ] Apply "Design Inspo": Styling `src/styles/global.css` (Neon/Dark)
- [ ] Character Visuals: Implement `CharacterState.tsx` (Text-based mirror)
- [ ] Final Manual Test: Go through "Discovery -> False Progress -> Confrontation" flow
- [ ] Run Checklists: `python .agent/scripts/lint_runner.py`

---

## Done When
- [ ] Extension loads in Chrome without errors
- [ ] User can capture URL via Popup
- [ ] User sees "Character" in Side Panel
- [ ] "Confrontation" blocks user until decision
- [ ] State persists across logic
