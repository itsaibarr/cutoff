# Cutoff Extension - Installation Guide

## ✅ Build Status: SUCCESS

Extension successfully built in `dist/` folder.

---

## 📦 Loading Extension in Chrome

### Step 1: Open Chrome Extensions Page
1. Open Chrome browser
2. Navigate to `chrome://extensions/`
3. Enable **Developer mode** (toggle in top-right corner)

### Step 2: Load Unpacked Extension
1. Click **"Load unpacked"** button
2. Navigate to: `C:\Users\Smaiyl\Desktop\cutoff_ext\dist`
3. Click **"Select Folder"**

### Step 3: Verify Installation
- Extension icon should appear in Chrome toolbar
- **Click icon** → Side Panel should open automatically (Character Mirror + Card List)
- Right-click on any page → "Save to Cutoff" should appear in context menu

### Step 4: Pin Side Panel (Optional)
1. Click extension icon to open Side Panel
2. Side Panel will stay open while browsing
3. You can resize it by dragging the edge

---

## 🧪 Testing the Flow

### Test 1: Open Side Panel
1. Click extension icon in toolbar
2. Side Panel should open on the right side
3. Should see "STATE: CLEAR" and "0 loops open"
4. Should see "+ CAPTURE" button

### Test 2: Quick Capture from Side Panel
1. Click "+ CAPTURE" button
2. Paste any URL (e.g., `https://youtube.com/watch?v=test`)
3. Click "SAVE"
4. Should see 1 card appear in the list
5. State should update to show "1 loops open"

### Test 3: Context Menu Capture
1. Right-click anywhere on a page
2. Select "Save to Cutoff"
3. Side Panel should open automatically
4. New card should appear in the list

### Test 4: Confrontation Flow
1. Click on any card in the list
2. Should see "WARNING: This will require a decision. There is no exit."
3. Click "ENTER CUTOFF"
4. Wait 2 seconds (Reality Check)
5. Should see 3 buttons: START, SCHEDULE, DISCARD
6. Click DISCARD
7. Card should disappear from list
8. Should return to main Side Panel view

---

## 🐛 Known Issues (MVP)

1. **No icons**: Extension uses default Chrome puzzle icon
2. **No AI integration**: Reality Check is mock text (needs Gemini API key)
3. **No persistent settings**: API key storage not implemented yet
4. **Context Menu**: May need page refresh to appear

---

## 🔧 Development Mode

To run in dev mode with hot reload:

```powershell
npm run dev
```

Then load `dist/` folder as unpacked extension. Changes will auto-reload.

---

## 📋 Next Steps (Phase 4-5)

- [ ] Add placeholder icons (or generate with AI)
- [ ] Implement Gemini API integration
- [ ] Add Settings UI for API key
- [ ] Test all state transitions
- [ ] Polish UI animations
- [ ] Add keyboard shortcuts

---

**Status:** ✅ Core MVP functional  
**Ready for:** Manual testing in Chrome
