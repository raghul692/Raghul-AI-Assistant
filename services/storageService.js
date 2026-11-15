/**
 * RAGHUL AI — PERSISTENT CLOUD OBJECT STORAGE SERVICE
 * 
 * Provides unified file storage via Supabase Storage:
 * - Buckets: raghul-ai-documents, raghul-ai-reports, raghul-ai-images
 * - Public & Signed URLs
 * - Metadata persistence in PostgreSQL
 * - Automatic local disk fallback for zero-dependency test execution
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const LOCAL_STORAGE_DIR = path.resolve(__dirname, '..', 'data', 'generated');
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
const ALLOWED_BUCKETS = new Set(['raghul-ai-documents', 'raghul-ai-reports', 'raghul-ai-images']);

if (!fs.existsSync(LOCAL_STORAGE_DIR)) {
  fs.mkdirSync(LOCAL_STORAGE_DIR, { recursive: true });
}

function assertSafeStoragePath(bucket, storagePath) {
  if (!storagePath || typeof storagePath !== 'string') {
    throw new Error('Invalid storage path');
  }
  if (storagePath.includes('..') || path.isAbsolute(storagePath)) {
    throw new Error('Directory traversal attempt blocked in storage path');
  }
  const localFolder = path.join(LOCAL_STORAGE_DIR, bucket);
  const resolved = path.resolve(localFolder, storagePath);
  if (!resolved.startsWith(path.resolve(LOCAL_STORAGE_DIR))) {
    throw new Error('Directory traversal attempt blocked in storage path');
  }
  return resolved;
}

export class StorageService {
  constructor() {
    this.supabaseUrl = process.env.SUPABASE_URL;
    this.serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    this.client = null;

    if (this.supabaseUrl && this.serviceRoleKey && !this.supabaseUrl.includes('<your-')) {
      try {
        this.client = createClient(this.supabaseUrl, this.serviceRoleKey);
      } catch (err) {
        console.warn('[StorageService] Supabase client init notice:', err.message);
      }
    }
  }

  isCloudConfigured() {
    return Boolean(this.client);
  }

  /**
   * Upload buffer to Supabase Storage (or local disk fallback)
   */
  async uploadBuffer({
    bucket = 'raghul-ai-documents',
    fileName,
    buffer,
    contentType = 'application/octet-stream',
    isPublic = true
  }) {
    if (!fileName || !buffer) {
      throw new Error('fileName and buffer are required for upload');
    }
    if (buffer.length > MAX_FILE_SIZE) {
      throw new Error(`File size ${buffer.length} bytes exceeds maximum permitted limit (${MAX_FILE_SIZE} bytes).`);
    }
    if (!ALLOWED_BUCKETS.has(bucket)) {
      throw new Error(`Invalid storage bucket "${bucket}". Allowed buckets: ${Array.from(ALLOWED_BUCKETS).join(', ')}`);
    }

    const cleanFileName = fileName.replace(/[^a-zA-Z0-9._-]/g, '_');
    const storagePath = `${Date.now()}_${cleanFileName}`;

    if (this.isCloudConfigured()) {
      try {
        const { data, error } = await this.client.storage
          .from(bucket)
          .upload(storagePath, buffer, {
            contentType,
            upsert: true
          });

        if (error) {
          throw error;
        }

        const publicUrlData = this.client.storage.from(bucket).getPublicUrl(storagePath);
        const publicUrl = publicUrlData?.data?.publicUrl || null;

        return {
          provider: 'supabase',
          bucket,
          storagePath,
          publicUrl,
          size: buffer.length,
          contentType
        };
      } catch (cloudErr) {
        console.warn(`[StorageService] Cloud upload notice for ${fileName}:`, cloudErr.message);
        if (process.env.NODE_ENV === 'production') {
          throw new Error(`Production cloud upload failed for bucket "${bucket}": ${cloudErr.message}`);
        }
      }
    } else if (process.env.NODE_ENV === 'production') {
      throw new Error('PRODUCTION STORAGE VIOLATION: SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in production.');
    }

    // Local Disk Fallback (local development and offline testing only)
    const localFilePath = assertSafeStoragePath(bucket, storagePath);
    const localFolder = path.dirname(localFilePath);
    fs.mkdirSync(localFolder, { recursive: true });
    fs.writeFileSync(localFilePath, buffer);

    return {
      provider: 'local',
      bucket,
      storagePath,
      localFilePath,
      publicUrl: `/data/generated/${bucket}/${storagePath}`,
      size: buffer.length,
      contentType
    };
  }

  /**
   * Upload local file from disk to cloud storage
   */
  async uploadFileFromDisk({
    bucket = 'raghul-ai-documents',
    fileName,
    localFilePath,
    contentType = 'application/octet-stream',
    isPublic = true
  }) {
    if (!fs.existsSync(localFilePath)) {
      throw new Error(`File does not exist on disk: ${localFilePath}`);
    }
    const buffer = fs.readFileSync(localFilePath);
    const targetName = fileName || path.basename(localFilePath);
    return await this.uploadBuffer({ bucket, fileName: targetName, buffer, contentType, isPublic });
  }

  /**
   * Download file buffer
   */
  async downloadBuffer({ bucket = 'raghul-ai-documents', storagePath }) {
    if (this.isCloudConfigured()) {
      try {
        const { data, error } = await this.client.storage.from(bucket).download(storagePath);
        if (error) throw error;
        const arrayBuf = await data.arrayBuffer();
        return Buffer.from(arrayBuf);
      } catch (err) {
        console.warn(`[StorageService] Cloud download notice for ${storagePath}:`, err.message);
      }
    }

    // Check local fallback with path traversal protection
    const localFilePath = assertSafeStoragePath(bucket, storagePath);
    if (fs.existsSync(localFilePath)) {
      return fs.readFileSync(localFilePath);
    }
    throw new Error(`File not found in storage: ${storagePath}`);
  }

  /**
   * Create signed URL with expiration
   */
  async getSignedUrl({ bucket = 'raghul-ai-documents', storagePath, expiresIn = 3600 }) {
    if (this.isCloudConfigured()) {
      const { data, error } = await this.client.storage
        .from(bucket)
        .createSignedUrl(storagePath, expiresIn);
      if (!error && data?.signedUrl) {
        return data.signedUrl;
      }
    }
    assertSafeStoragePath(bucket, storagePath);
    return `/data/generated/${bucket}/${storagePath}`;
  }

  /**
   * Delete file
   */
  async deleteFile({ bucket = 'raghul-ai-documents', storagePath }) {
    if (this.isCloudConfigured()) {
      await this.client.storage.from(bucket).remove([storagePath]);
    }
    const localFilePath = assertSafeStoragePath(bucket, storagePath);
    if (fs.existsSync(localFilePath)) {
      try { fs.unlinkSync(localFilePath); } catch (_) {}
    }
    return true;
  }
}

export const storageService = new StorageService();
