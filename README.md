# ⚔️ CUTOFF // Decision Enforcer

[![Version](https://img.shields.io/badge/version-1.0.0-blueviolet?style=for-the-badge)](https://github.com/itsaibarr/cutoff)
[![Tech](https://img.shields.io/badge/stack-React%20%7C%20Supabase%20%7C%20Gemini-green?style=for-the-badge)](https://github.com/itsaibarr/cutoff)
[![License](https://img.shields.io/badge/license-MIT-lightgrey?style=for-the-badge)](https://github.com/itsaibarr/cutoff)

> **"An AI that forces you to choose: start, schedule, or let go."**

Cutoff is not just another bookmark manager or TODO list. It is a **Decision Enforcer** designed to eliminate "Open Loops"—the half-finished thoughts and "save for later" tabs that clutter your mind and drain your cognitive energy. 

Through AI-powered analysis and a forced decision matrix, Cutoff transforms passive consumption into active execution.

---

## 🧠 The Philosophy: Closing the Loops

Modern digital life is a constant stream of "open loops." Each saved tab, video, or article is a promise you made to your future self that you likely won't keep. These loops create background tension (Tension Debt).

**Cutoff forces you to confront these promises.**
- **Execute:** Do it now (15-min commitment).
- **Shadow:** Defer it (acknowledge the loop as a burden).
- **Discard:** Close it forever (release the tension).

---

## 🚀 Key Features

### 1. Smart Capture [Extension]
Capture anything without breaking your flow.
- **URL Context:** Analyzes page metadata and JSON-LD for YouTube/GitHub.
- **AI Analysis:** Uses `Gemini 1.5 Flash` to generate dry, factual recognition summaries.
- **Zero Friction:** Right-click context menu or side panel quick-save.

### 2. The Confrontation Gate
When you re-open a captured item, you enter the **Gate**.
- **Reality Check:** AI reminds you exactly what the item is and how long it's been sitting in your stack.
- **No Exit:** To leave the gate, you *must* make a decision. No more "I'll look at this later."

### 3. Execute Mode & Focus Enforcer
Choosing to "Execute" locks you into a **15-minute focused sprint**.
- **Boundaries:** Define allowed domains for your task.
- **Focus Enforcer:** Active tab monitoring blocks distracting sites during the sprint.
- **Micro-Commitment:** Focused on the *first concrete step*, not the whole project.

### 4. Shadow Mode
Some loops can't be closed today. "Shadowing" them acknowledges their weight on your system without letting them clutter your primary view. High shadow counts increase system "Tension" levels.

### 5. The Reflection Mirror [Dashboard]
A centralized web dashboard synchronized with your extension.
- **System Metrics:** Real-time visualization of your cognitive load (Void -> Stable -> Turbulent -> Critical).
- **History Archive:** Track your execution vs. discard ratio.
- **Secure Sync:** End-to-end pairing with Supabase for cross-device awareness.

---

## 🎨 Design Aesthetic: The Void System
Cutoff features a premium, industrial aesthetic designed for focus.
- **Atmospheres:** Switch between `Void` (True Black), `Dark` (Gunmetal), and `Flux` (Animated Gradients).
- **System States:** The UI shifts colors (LIME to RED) based on your open loop count.
- **Minimalist Motion:** Subtle micro-animations and glassmorphism.

---

## 🛠️ Tech Stack

- **Framework:** React 18 + Vite
- **Language:** TypeScript
- **AI Intelligence:** Google Gemini 1.5 API
- **Backend/Realtime:** Supabase (Auth, Postgres, Realtime Sync)
- **Styling:** Vanilla CSS (Modern Design Tokens, Variable-driven)
- **Icons:** Lucide React
- **Extension:** Chrome Manifest V3 (SidePanel API, Scripting API)

---

## 📦 Getting Started

### Prerequisites
- Chrome (or Chromium-based browser)
- Node.js (for local development)
- [Google Gemini API Key](https://aistudio.google.com/)

### Installation (User)
1. Download the [latest release](https://github.com/itsaibarr/cutoff).
2. Go to `chrome://extensions/`.
3. Enable **Developer Mode**.
4. Click **Load Unpacked** and select the `dist` folder.
5. Click the Extension Icon and enter your Gemini API Key in the "Setup AI" prompt.

### Quick Start (Dev)
1. Clone the repository: `git clone https://github.com/itsaibarr/cutoff.git`
2. Install dependencies: `npm install`
3. Create `.env` file with your credentials:
   ```env
   VITE_SUPABASE_URL=your_url
   VITE_SUPABASE_ANON_KEY=your_key
   VITE_GEMINI_API_KEY=your_key (optional, can be set in UI)
   ```
4. Start dev server: `npm run dev`
5. Load the generated `dist/` folder in Chrome.

---

## 🔒 Security & Privacy
- **Local First:** Most data is stored in `chrome.storage.local`.
- **API Keys:** Your Gemini API key is stored securely in your browser and never reaches our servers.
- **Encrypted Sync:** Supabase Row Level Security (RLS) ensures only you can see your data.

---

## 📜 License
Distributed under the MIT License. See `LICENSE` for more information.

---

<p align="center">
  <i>Built to kill procrastination through intentional confrontation.</i>
</p>
