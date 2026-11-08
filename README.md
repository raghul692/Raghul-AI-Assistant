# Nexus AI • Intelligent Agent Chatbot

A production-ready Full-Stack conversational chatbot built using **Node.js**, **Google Gemini 3.8 Flash (`@google/genai`)**, and **Agent Memory Architecture (Sliding Window Context Buffer)**.

---

## 🚀 Quick Start

### 1. Start the server
In the project directory (`C:\Users\acer\.gemini\antigravity\scratch\ai-chatbot`), run:
```bash
npm start
```
Or for live auto-reload during development:
```bash
npm run dev
```

### 2. Open in Browser
Open your browser and navigate to:
```
http://localhost:3000
```

---

## 🔑 Adding your Gemini API Key
You can configure your Google Gemini API Key in two easy ways:

1. **Directly in the Web UI (Recommended):**
   - Click the **⚙️ API Settings** button in the sidebar or top header.
   - Paste your free Gemini API key from [Google AI Studio](https://aistudio.google.com/).
   - Click **Save & Apply** (Saved safely in your browser's `localStorage`).

2. **Via `.env` file:**
   - Copy `.env.example` to `.env`:
     ```bash
     cp .env.example .env
     ```
   - Set your key:
     ```env
     GEMINI_API_KEY=your_actual_key_here
     PORT=3000
     MAX_MEMORY_TURNS=14
     ```

*(Note: Even without an API key, the chatbot includes a simulated interactive mode so you can test the UI and memory features immediately!)*

---

## 🧠 Key Features & Architecture

- **⚡ Real-Time Token Streaming (SSE):** Like ChatGPT and Claude, words stream to your screen instantaneously word-by-word with zero waiting for the full response.
- **🚀 High-Speed Low-Latency Models:**
  - `gemini-3.5-flash-lite`: Sub-second Time to First Token (TTFT), optimized for rapid chat without queue delays.
  - `gemini-3.8-flash`: High reasoning model with automatic fallback.
- **🧠 Agent Memory Architecture:**
  - Implements an **Episodic Context Buffer** with sliding window pruning.
  - Automatically preserves conversation continuity while adhering to strict context/token budgets.
  - Shows real-time turn counts and provides one-click context clearing.
- **Persona Switching:**
  - ✨ **AI Assistant:** General-purpose, clear, and structured assistant with native bilingual (Tamil + English) fluency.
  - 💻 **Code Architect:** Principal software engineer for clean architecture, zero-placeholder code, and root-cause diagnostics.
  - 🧠 **Deep Researcher:** In-depth analytical breakdown with comparative matrices, citations, and critical trade-offs.
- **Customizable System Instructions:** Override agent behavior on the fly from the Settings modal.
- **Sleek Modern UI:** Glassmorphism, dark theme, smooth typing animations, markdown parsing, code blocks, responsive mobile sidebar.

---

## 📂 Project Structure

```
ai-chatbot/
├── package.json          # Dependencies & scripts
├── server.js             # Express backend, GenAI interaction API, Memory manager
├── .env.example          # Sample environment configuration
├── README.md             # Documentation
└── public/
    ├── index.html        # Modern chat interface
    ├── style.css         # Responsive styling & themes
    └── app.js            # Frontend state, API connector & markdown renderer
```

