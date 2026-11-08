# NEXUS AI CONVERSATIONAL IMAGE ENGINE — PROVIDER CONFIGURATION GUIDE
**Engine Version:** 3.0 Production Standard  
**Supported Providers:** Google Gemini Image Generation & Cloudflare Workers AI  

---

## 1. Environment Variables

Configure the following credentials in your `.env` file:

```env
# 1. Google Gemini API (Text Planning & Primary Image Engine)
GEMINI_API_KEY=your_gemini_api_key_here

# 2. Cloudflare Workers AI (High-Speed Raster Fallback Engine)
CLOUDFLARE_ACCOUNT_ID=your_cloudflare_account_id_here
CLOUDFLARE_API_TOKEN=your_cloudflare_api_token_here

# 3. Server Configuration
PORT=3000
NODE_ENV=production
```

---

## 2. Provider Tiers & Priority Routing

### Primary Tier: Google Gemini Image Generation
- **Recommended Models:**
  - Standard: `gemini-3.1-flash-image`
  - High-Definition / Demanding: `gemini-3-pro-image`
- **Use Cases:**
  - Creative photorealism
  - Multimodal image-to-image editing
  - Contextual illustrations with complex visual metaphors
- **SDK & Request Structure:**
  - Powered by `@google/genai` (SDK v2.32.0+).
  - Uses `ai.models.generateContent({ model: 'gemini-3.1-flash-image', contents, config: { responseModalities: ['IMAGE'] } })`.
- **Quota Handling:**
  - On Google AI Studio free tier, requests may encounter HTTP 429 (`RESOURCE_EXHAUSTED`).
  - The `ImageProviderRouter` automatically detects 429 status codes and initiates seamless failover to Cloudflare FLUX.1 Schnell without crashing or exposing errors to the user.

### Secondary Tier: Cloudflare Workers AI FLUX.1 Schnell
- **Model:** `@cf/black-forest-labs/flux-1-schnell`
- **Use Cases:**
  - Photorealistic raster images (people, nature, landscapes, animals, cyberpunk concepts)
  - Ultra-fast creative visual generation (~3-5 seconds latency)
  - Automatic fallback when Gemini quota is exhausted
- **API Endpoint:**
  `POST https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/@cf/black-forest-labs/flux-1-schnell`
- **Request Body:**
  ```json
  {
    "prompt": "Photorealistic cyberpunk neon cat with glowing cybernetic visor, cinematic composition"
  }
  ```

---

## 3. Specialized Hybrid Educational Engine

### Hybrid Infographic Engine (`services/hybridInfographicRenderer.js`)
- **Use Cases:**
  - 30-Day Programming Roadmaps (Python, Full-Stack, React, Go, Rust, AI/ML)
  - Educational Cheat Sheets and Syllabi
  - Step-by-Step Technical Guides
- **How it Works:**
  1. Calls `gemini-2.5-flash` with structured JSON schema to generate a comprehensive 30-day curriculum.
  2. Runs deterministic validation to confirm that all 30 days (Day 1 to Day 30) are present.
  3. Uses programmatic SVG layout to render high-contrast glassmorphic cards, weekly milestone headers, progress badges, and readable typography.
  4. Saves the resulting vector asset to `/generated/` and registers it in SQLite `image_assets`.
  5. The web client renders the SVG with crisp vector scaling and provides a one-click button to download as a 1024×1024 PNG.

---

## 4. Operational Safety & Zero-Scraping Guarantee

1. **No External Image URLs:**
   Generation requests will NEVER scrape or return URLs from DuckDuckGo, Unsplash, Google Images, or third-party blogs.
2. **Deterministic File Validation:**
   Every generated buffer must pass magic byte validation (`validateImageBuffer`) before being saved or returned.
3. **Database Asset Lineage:**
   All edits link to the parent asset (`parent_asset_id`), incrementing `version` and recording complete generation briefs.

