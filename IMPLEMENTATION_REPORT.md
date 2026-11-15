# RAGHUL AI ASSISTANT — IMPLEMENTATION REPORT
**Document Version:** 2.0.0  
**Implementation Date:** November 2026  
**Subject:** Engineering Upgrades, Architectural Additions, and Security Implementations  
**Status:** Deployed & Verified

---

## 1. 5-TIER CoALA PERSISTENT MEMORY ARCHITECTURE

### Architecture Overview
The memory subsystem was refactored in [services/persistentMemoryEngine.js](file:///c:/Users/acer/.gemini/antigravity/scratch/ai-chatbot/services/persistentMemoryEngine.js) following the Cognitive Architectures for Language Agents (CoALA) specification:

```
[Incoming User Query]
         │
         ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ 1. Intent & Reference Resolution                            │
 │    - Detects pronouns ("it", "they", "that architecture")   │
 │    - Expands query using active conversation context        │
 │    - Identifies cross-session inquiry intent                │
 └──────────────────────────────┬──────────────────────────────┘
                                │
         ┌──────────────────────┴──────────────────────┐
         ▼                                             ▼
 [In-Session Deep Recall]                   [Cross-Session Past Recall]
 - Pruned turn search                       - FTS5 BM25 search across
 - Sub-millisecond lookup                     `messages_fts` virtual table
         │                                             │
         └──────────────────────┬──────────────────────┘
                                │
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ 2. Context Synthesis & Assembly                             │
 │    - Tier 1: Sliding Window (Last 8 turns verbatim)         │
 │    - Tier 2: Rolling Working Summary (from SQLite)          │
 │    - Tier 3: In-Session Deep Recall (pruned turns)          │
 │    - Tier 4: Long-Term User Facts & Preferences             │
 │    - Tier 5: Cross-Session Past Conversation Context        │
 └──────────────────────────────┬──────────────────────────────┘
                                │
                                ▼
                   [Unified Prompt Dispatched to LLM]
                                │
                                ▼
 ┌─────────────────────────────────────────────────────────────┐
 │ 3. Asynchronous Post-Turn Processing (Non-Blocking)         │
 │    - Async Fact Distillation: Extracts tech stack/facts     │
 │    - Rolling Summarization: Refreshes working memory        │
 │    - Deduplication: Eliminates redundant user preferences   │
 └─────────────────────────────────────────────────────────────┘
```

### Database Schema Additions
Two specialized tables manage long-term state inside `data/nexus.db`:
```sql
-- Structured working memory for active conversations
CREATE TABLE IF NOT EXISTS conversation_summaries (
  conversation_id TEXT PRIMARY KEY,
  summary TEXT NOT NULL,
  key_entities TEXT,
  open_questions TEXT,
  updated_at INTEGER NOT NULL
);

-- Distilled persistent facts about the user
CREATE TABLE IF NOT EXISTS user_facts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  fact_key TEXT UNIQUE,
  fact_value TEXT NOT NULL,
  category TEXT DEFAULT 'general',
  confidence REAL DEFAULT 1.0,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
```

---

## 2. SSRF GUARDRAILS & INPUT VALIDATION

### Implementation Details
The URL extraction routine in `server.js` was bound to `validateSafeUrl()` from [research/security/guardrails.js](file:///c:/Users/acer/.gemini/antigravity/scratch/ai-chatbot/research/security/guardrails.js).

```javascript
// server.js - fetchWebPage()
async function fetchWebPage(url) {
  try {
    const safeCheck = validateSafeUrl(url);
    if (!safeCheck || !safeCheck.valid) {
      console.warn('[Security] Blocked potentially unsafe / SSRF URL in Deep Web Reader:', safeCheck?.reason || 'Invalid URL');
      return null;
    }
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;

    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      signal: AbortSignal.timeout(9000)
    });
    ...
```

### Guardrail Constraints Enforced
1. **Loopback Blocked:** Rejects `localhost`, `127.0.0.1`, `::1`.
2. **Cloud Metadata Blocked:** Rejects `169.254.169.254` (AWS, GCP, Azure metadata endpoints).
3. **Private Networks Blocked:** Rejects Class A (`10.0.0.0/8`), Class B (`172.16.0.0/12`), and Class C (`192.168.0.0/16`) subnets.
4. **Protocol Whitelist:** Allows strictly `http:` and `https:`; rejects `file:`, `gopher:`, `ftp:`.

---

## 3. NON-BLOCKING TELEMETRY ENGINE

### Implementation Details
In [services/portfolioTelemetryService.js](file:///c:/Users/acer/.gemini/antigravity/scratch/ai-chatbot/services/portfolioTelemetryService.js), all background tasks were configured with `.unref()`:

```javascript
const broadcastInterval = setInterval(() => {
  broadcastLiveState();
}, 2000);
if (broadcastInterval && typeof broadcastInterval.unref === 'function') {
  broadcastInterval.unref();
}

const syncInterval = setInterval(() => {
  syncMetricsToDisk();
}, 45000);
if (syncInterval && typeof syncInterval.unref === 'function') {
  syncInterval.unref();
}
```
**Outcome:** Allows the Node.js event loop to terminate cleanly when tests complete, eliminating zombie runner processes.

---

## 4. UI/UX HUBS POPOVER INTEGRATION

### Implementation Details
In [public/index.html](file:///c:/Users/acer/.gemini/antigravity/scratch/ai-chatbot/public/index.html), explicit quick-launch elements were incorporated into `#hubsPopoverMenu`:

```html
<div class="hubs-popover-item" id="headerPortfolioBadgeBtn" role="menuitem" tabindex="0">
  <div class="hubs-popover-icon">📊</div>
  <div class="hubs-popover-text">
    <div class="hubs-popover-title">Portfolio OS Dashboard</div>
    <div class="hubs-popover-desc">Traffic, telemetry & visitor analytics</div>
  </div>
</div>
<div class="hubs-popover-item" id="headerResearchHubBtn" role="menuitem" tabindex="0">
  <div class="hubs-popover-icon">🔬</div>
  <div class="hubs-popover-text">
    <div class="hubs-popover-title">Deep Research Hub</div>
    <div class="hubs-popover-desc">Autonomous multi-agent research workspace</div>
  </div>
</div>
```
When clicked, the items navigate directly to `/os` or trigger the `#researchHubBtn` modal without requiring manual URL navigation.
