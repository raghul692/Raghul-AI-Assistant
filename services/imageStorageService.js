import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import {
  saveDbImageAsset,
  getDbImageAsset,
  getLatestDbImageAssetBySession,
  listDbImageAssetsBySession,
  listAllDbImageAssets,
  getDbImageAssetLineage
} from '../db.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const GENERATED_DIR = path.join(__dirname, '..', 'public', 'generated');

if (!fs.existsSync(GENERATED_DIR)) {
  fs.mkdirSync(GENERATED_DIR, { recursive: true });
}

function getExtensionForMimeType(mimeType) {
  switch (mimeType?.toLowerCase()) {
    case 'image/png':
      return 'png';
    case 'image/jpeg':
    case 'image/jpg':
      return 'jpg';
    case 'image/webp':
      return 'webp';
    case 'image/svg+xml':
      return 'svg';
    default:
      return 'png';
  }
}

/**
 * Saves a generated image buffer to persistent storage and records it in SQLite.
 */
export async function saveImageAsset({
  buffer,
  sessionId = null,
  messageId = null,
  mimeType = 'image/png',
  width = 1024,
  height = 1024,
  provider = 'native',
  model = 'gemini-3.1-flash-image',
  prompt = '',
  imageBrief = null,
  parentAssetId = null,
  version = 1
}) {
  if (!buffer || !Buffer.isBuffer(buffer)) {
    throw new Error('Valid Image Buffer is required for storage');
  }

  const timestamp = Date.now();
  const randomSuffix = crypto.randomBytes(4).toString('hex');
  const ext = getExtensionForMimeType(mimeType);
  const filename = `img_${timestamp}_${randomSuffix}.${ext}`;
  const absolutePath = path.join(GENERATED_DIR, filename);

  fs.writeFileSync(absolutePath, buffer);

  const assetId = `asset_${timestamp}_${randomSuffix}`;
  const relativeUrl = `/generated/${filename}`;
  const fileSize = buffer.length;

  // If this is an edit and version wasn't explicitly bumped, find parent version and increment
  let calculatedVersion = version;
  if (parentAssetId && version === 1) {
    const parent = getDbImageAsset(parentAssetId);
    if (parent) {
      calculatedVersion = (parent.version || 1) + 1;
    }
  }

  const record = {
    id: assetId,
    session_id: sessionId,
    message_id: messageId,
    file_path: absolutePath,
    url: relativeUrl,
    mime_type: mimeType,
    width,
    height,
    file_size: fileSize,
    provider,
    model,
    prompt,
    image_brief: imageBrief,
    parent_asset_id: parentAssetId,
    version: calculatedVersion,
    created_at: timestamp
  };

  saveDbImageAsset(record);

  return {
    assetId,
    url: relativeUrl,
    filePath: absolutePath,
    filename,
    mimeType,
    fileSize,
    width,
    height,
    provider,
    model,
    version: calculatedVersion,
    parentAssetId,
    createdAt: timestamp
  };
}

export function getImageAsset(id) {
  return getDbImageAsset(id);
}

export function getLatestImageAssetForSession(sessionId) {
  return getLatestDbImageAssetBySession(sessionId);
}

export const getImageAssetBySession = getLatestImageAssetForSession;


export function getImageAssetsForSession(sessionId, limit = 50) {
  return listDbImageAssetsBySession(sessionId, limit);
}

export function getAllImageAssets(limit = 100) {
  return listAllDbImageAssets(limit);
}

export function getImageAssetLineage(id) {
  return getDbImageAssetLineage(id);
}
