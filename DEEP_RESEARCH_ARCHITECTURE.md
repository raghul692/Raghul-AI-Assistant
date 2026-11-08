# RAGHUL AI — TIER-1 AUTONOMOUS DEEP RESEARCH ENGINE
## ARCHITECTURE SPECIFICATION & TECHNICAL BLUEPRINT

### 1. Executive Overview

The Raghul AI Deep Research Engine is an evidence-first, autonomous multi-agent investigative system designed to match and exceed the research capabilities of ChatGPT Deep Research, Claude Research, and Gemini Deep Research. It does not generate content based solely on generative model priors; instead, it enforces an empirical research lifecycle:

```
USER INQUIRY
    │
    ▼
1. INTENT & CONSTRAINT ANALYSIS (Domain, Time-sensitivity, Geographic, Entity Mapping)
    │
    ▼
2. AUTONOMOUS RESEARCH PLANNER (10-Step Decomposition & Plan Approval Gate)
    │
    ▼
3. MULTI-CHANNEL SOURCE DISCOVERY (Gemini Grounding, Tavily, Exa, GitHub, Academic APIs)
    │
    ▼
4. ORIGINAL DOCUMENT EXTRACTION (Cheerio, Readability, SSRF-Guarded Fetch, PDF Parser)
    │
    ▼
5. CENTRALIZED EVIDENCE LEDGER (Source Registry, Credibility Scoring, Content Hashing)
    │
    ▼
6. ATOMIC CLAIM EXTRACTION & VERIFICATION (SUPPORTED, DISPUTED, CONTRADICTED, UNVERIFIED)
    │
    ▼
7. COUNTER-RESEARCH ENGINE (Adversarial Search for Falsification & Divergent Views)
    │
    ▼
8. MULTI-AGENT COLLABORATION (12 Specialized Research & Analysis Agents)
    │
    ▼
9. ORIGINAL SYNTHESIS & CATEGORIZATION (FACT, ANALYSIS, OPINION, FORECAST, RECOMMENDATION)
    │
    ▼
10. INDEPENDENT QUALITY GATE AUDIT (Citation Verification, Coverage & Consistency)
    │
    ▼
11. PROFESSIONAL PUBLISHING ENGINE (Semantic HTML, Print CSS, A4 Layout, Headers/Footers)
    │
    ▼
12. PDF VALIDATION & INTEGRITY INSPECTION (pdf-parse Text, Page Count, Layout Verification)
    │
    ▼
FINAL VERIFIED PDF DELIVERABLE & LIVE WORKSPACE
```

---

### 2. Multi-Agent Team (12 Specialized Roles)

1. **Research Planner Agent**: Decomposes complex topics, formulates hypotheses, constructs multi-vector research trees, and requests plan approval.
2. **Web Researcher Agent**: Orchestrates multi-query web exploration using Tavily, Exa, and Google search channels.
3. **Primary Source Researcher Agent**: Identifies, retrieves, and extracts original documentation, official releases, regulatory filings, and whitepapers.
4. **GitHub Researcher Agent**: Inspects repository architecture, commits, releases, code quality, dependency health, and contributor velocity.
5. **Market Analyst Agent**: Analyzes competitive landscapes, pricing models, market positioning, and verifiable traction metrics.
6. **Academic Researcher Agent**: Discovers scientific papers via OpenAlex, Crossref, Semantic Scholar, arXiv, and PubMed.
7. **Counter-Researcher Agent**: Actively searches for contradictions, failure cases, negative reviews, and opposing empirical data.
8. **Fact Checker Agent**: Cross-corroborates statistics, dates, and claims against multiple independent sources.
9. **Synthesis Analyst Agent**: Unifies verified findings into original analytical narratives, separating facts from projections.
10. **Report Editor Agent**: Formats the dossier into domain-adaptive executive chapters with comparative tables and insights.
11. **Citation Auditor Agent**: Ensures 100% citation traceability, eliminates orphan references, and formats IEEE/Harvard bibliographies.
12. **PDF Quality Inspector Agent**: Performs automated post-compilation inspection of PDF page counts, headings, tables, links, and layout integrity.

---

### 3. Source Discovery & Multi-Channel Tools

| Channel | Adapter | Capabilities |
| :--- | :--- | :--- |
| **Google Search** | `GoogleSearchAdapter` | Built-in Gemini Grounding, real-time web retrieval |
| **Tavily** | `TavilySearchAdapter` | Search, page content extraction, advanced deep search (`tvly-...`) |
| **Exa** | `ExaSearchAdapter` | Neural/semantic search, full-page contents, highlights |
| **GitHub** | `GitHubSearchAdapter` | Official GitHub REST API: repositories, releases, commits, README, files, issues |
| **Academic** | `AcademicSearchAdapter` | OpenAlex, Crossref, Semantic Scholar, arXiv, PubMed E-utilities |
| **Web Extractor**| `WebExtractor` | SSRF-safe HTTP client, Cheerio structured extraction, PDF parser |

---

### 4. Database Schema (13 Additive SQLite Tables)

All tables use SQLite WAL mode via `better-sqlite3` and enforce foreign keys:
- `research_jobs`: Root job state, user prompt, mode, budget, progress, status, timestamps.
- `research_plans`: Structured research plan, subtopics, questions, approval status.
- `research_queries`: Executed queries per channel, result counts, duration.
- `research_sources`: Normalized registry of discovered URLs, domains, titles, credibility scores.
- `source_fetches`: Extracted content, raw text, clean text, content hashes (`sha256`), extraction status.
- `evidence_items`: Granular evidence snippets with relevance scores and timestamps.
- `research_claims`: Atomic claims extracted from evidence with verification status.
- `claim_evidence`: Many-to-many mapping between claims and supporting/contradicting evidence.
- `research_sections`: Generated chapters and subheadings with Markdown and table content.
- `research_citations`: Inline numbered citations linking text claims directly to registered sources.
- `research_artifacts`: Output documents (Markdown, HTML, PDF) with file metadata and hashes.
- `research_runs`: Run execution logs, provider token counts, and cost accounting.
- `research_quality_checks`: Automated quality gate evaluation scores and blocking failure reports.

---

### 5. Security & Governance

1. **SSRF Guard**: Strict validation of target URLs, private IP range blocking (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`, `127.0.0.0/8`, `169.254.0.0/16`, `::1`), and redirect limits.
2. **Untrusted Input Isolation**: Webpage contents, PDF text, and GitHub READMEs are sanitized and strictly demarcated as external evidence, preventing prompt injection into agent directives.
3. **Secret Isolation**: Provider keys are managed strictly on the server; zero API tokens or internal credentials are leaked to the client.
4. **Plan Approval Gate**: When configured (`RESEARCH_REQUIRE_PLAN_APPROVAL=true`), expensive multi-vector searches pause at `AWAITING_APPROVAL` until confirmed.

---

### 6. Professional PDF Publishing & Automated Validation

1. **Publishing Engine**: Generates semantic HTML with print-optimized CSS (`@page { size: A4; margin: 20mm; }`, page-break rules, running headers/footers, table styling).
2. **Headless Chrome PDF Compilation**: Uses local Chrome/Edge executable via `--headless=new --print-to-pdf`.
3. **Automated Inspection (`pdf-parse`)**:
   - Confirms physical file generation and non-zero size.
   - Parses document text stream to verify chapter headings exist.
   - Verifies bibliography and references are present.
   - Validates page count and structural integrity.

