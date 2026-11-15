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

if (!fs.existsSync(LOCAL_STORAGE_DIR)) {
  fs.mkdirSync(LOCAL_STORAGE_DIR, { recursive: true });
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
      }
    }

    // Local Disk Fallback
    const localFolder = path.join(LOCAL_STORAGE_DIR, bucket);
    fs.mkdirSync(localFolder, { recursive: true });
    const localFilePath = path.join(localFolder, storagePath);
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

    // Check local fallback
    const localFilePath = path.join(LOCAL_STORAGE_DIR, bucket, storagePath);
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
    return `/data/generated/${bucket}/${storagePath}`;
  }

  /**
   * Delete file
   */
  async deleteFile({ bucket = 'raghul-ai-documents', storagePath }) {
    if (this.isCloudConfigured()) {
      await this.client.storage.from(bucket).remove([storagePath]);
    }
    const localFilePath = path.join(LOCAL_STORAGE_DIR, bucket, storagePath);
    if (fs.existsSync(localFilePath)) {
      try { fs.unlinkSync(localFilePath); } catch (_) {}
    }
    return true;
  }
}

export const storageService = new StorageService();
