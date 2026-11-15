# 🗄️ Raghul AI — Cloud Object Storage Architecture & Guide (Supabase Storage)

## 1. Storage Architecture Overview

The Raghul AI platform requires persistent binary storage for user file uploads, generated deep research PDF reports, analytical whitepapers, and exported visual assets.

In modern cloud deployments (e.g., Render containers and Vercel edge functions), the local file system is ephemeral and vanishes on each deploy, restart, or dyno recycling. Consequently:
- Local filesystem persistence is strictly forbidden for production assets.
- All persistent blobs are routed through `services/storageService.js` to cloud-managed **Supabase Storage**.
- Public reports and images receive permanent public CDNs, while sensitive user documents use cryptographic, time-limited signed URLs.

```
+-------------------------------------------------------------------+
|                     Application Layer                             |
|           (server.js / worker.js / research engines)              |
+---------------------------------+---------------------------------+
                                  |
                                  v
+-------------------------------------------------------------------+
|               services/storageService.js Wrapper                  |
|  - Automatic bucket initialization                                |
|  - Binary buffer upload / Stream upload                           |
|  - Signed URL generation with expiration                          |
|  - Graceful fallback for offline local testing                    |
+---------------------------------+---------------------------------+
                                  |
                                  v
+-------------------------------------------------------------------+
|                 Supabase Cloud Storage (S3 API)                   |
|  - raghul-ai-documents (private, user context)                    |
|  - raghul-ai-reports   (public, published PDFs & whitepapers)     |
|  - raghul-ai-images    (public, diagrams & visualizations)        |
+-------------------------------------------------------------------+
```

---

## 2. Bucket Provisioning & Configuration

The application configures three dedicated buckets in Supabase Storage:

| Bucket Name | Visibility | Allowed Content Types | Primary Use Case |
| :--- | :--- | :--- | :--- |
| `raghul-ai-documents` | **Private** | `application/pdf`, `text/*`, `application/json` | User document uploads for RAG and context analysis |
| `raghul-ai-reports` | **Public** | `application/pdf`, `application/vnd.openxmlformats` | Published Deep Research memos, whitepapers, DOCX |
| `raghul-ai-images` | **Public** | `image/png`, `image/jpeg`, `image/webp` | Audio visualizer waveforms, charts, portfolio screenshots |

### Automatic Provisioning
On service startup, `storageService.initBuckets()` checks for the presence of each bucket and creates it automatically using the `SUPABASE_SERVICE_ROLE_KEY` if it does not yet exist.

---

## 3. Storage Service API Reference (`services/storageService.js`)

### 1. Upload Buffer directly to Cloud Storage
```javascript
import storageService from './services/storageService.js';

const buffer = Buffer.from('Report content...');
const uploadResult = await storageService.uploadBuffer(
  'raghul-ai-reports',
  'deep_research_report_102.pdf',
  buffer,
  'application/pdf'
);

console.log('File available at:', uploadResult.publicUrl);
```

### 2. Upload File from Local Path
```javascript
const result = await storageService.uploadFile(
  'raghul-ai-documents',
  'source_contracts.pdf',
  '/tmp/source_contracts.pdf',
  'application/pdf'
);
```

### 3. Generate Time-Limited Signed URL (For Private Files)
```javascript
// Generates a URL valid for 3600 seconds (1 hour)
const signedUrl = await storageService.createSignedUrl(
  'raghul-ai-documents',
  'source_contracts.pdf',
  3600
);
```

### 4. Download File Buffer
```javascript
const fileBuffer = await storageService.downloadFile('raghul-ai-reports', 'deep_research_report_102.pdf');
```

### 5. Delete File
```javascript
await storageService.deleteFile('raghul-ai-documents', 'obsolete_contract.pdf');
```

---

## 4. Security & Access Control Policies (RLS)

1. **Service Role Security:** The Backend Web Service and Background Worker interact with Supabase Storage using the administrative `SUPABASE_SERVICE_ROLE_KEY`. This key must never be exposed to the browser or client bundle.
2. **Read Policy for Public Reports:**
   ```sql
   CREATE POLICY "Public Reports are readable by all"
   ON storage.objects FOR SELECT
   TO public
   USING (bucket_id = 'raghul-ai-reports');
   ```
3. **Private Document Protection:**
   The `raghul-ai-documents` bucket enforces row-level security. Direct anonymous access is rejected with HTTP 403. Clients must request a temporary signed URL through the authenticated Backend API.

---

## 5. Verification & Testing

Verify that cloud storage operations work correctly:
```bash
node tests/test-production-storage.js
```
*Expected output:* Confirms buffer upload, signed URL generation, byte-for-byte download verification, and clean deletion.
