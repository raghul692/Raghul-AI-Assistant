/**
 * TEST SUITE: PERSISTENT OBJECT STORAGE (SUPABASE STORAGE INTEGRATION)
 */

import assert from 'assert';
import crypto from 'crypto';
import { storageService } from '../services/storageService.js';

async function runTest() {
  console.log('================================================================');
  console.log('🧪 VERIFY PERSISTENT OBJECT STORAGE (SUPABASE STORAGE)');
  console.log('================================================================\n');

  console.log(`Cloud Storage Configured: ${storageService.isCloudConfigured()}`);

  // Test 1: Upload Buffer to raghul-ai-documents
  console.log('--- Test 1: Buffer Upload to Storage ---');
  const payloadStr = JSON.stringify({
    timestamp: Date.now(),
    framework: 'Supabase Storage',
    service: 'raghul-ai'
  });
  const buf = Buffer.from(payloadStr, 'utf8');
  const fileName = `test_artifact_${crypto.randomBytes(3).toString('hex')}.json`;

  const uploadResult = await storageService.uploadBuffer({
    bucket: 'raghul-ai-documents',
    fileName,
    buffer: buf,
    contentType: 'application/json',
    isPublic: true
  });

  assert(uploadResult.storagePath, 'Must return assigned storagePath');
  assert(uploadResult.publicUrl, 'Must return publicUrl');
  assert.strictEqual(uploadResult.size, buf.length, 'Size must match');
  console.log('✅ [PASS] Buffer upload verified:', uploadResult.publicUrl, '\n');

  // Test 2: Download Buffer and Verify Integrity
  console.log('--- Test 2: Storage Download & Integrity Validation ---');
  const downloadedBuf = await storageService.downloadBuffer({
    bucket: 'raghul-ai-documents',
    storagePath: uploadResult.storagePath
  });

  assert.strictEqual(downloadedBuf.toString('utf8'), payloadStr, 'Downloaded content must match uploaded buffer');
  console.log('✅ [PASS] Downloaded content matches byte-for-byte.\n');

  // Test 3: Signed URL Generation
  console.log('--- Test 3: Signed URL Generation ---');
  const signedUrl = await storageService.getSignedUrl({
    bucket: 'raghul-ai-documents',
    storagePath: uploadResult.storagePath,
    expiresIn: 300
  });

  assert(signedUrl && signedUrl.length > 10, 'Must generate valid signed URL');
  console.log('✅ [PASS] Signed URL generation verified.\n');

  // Test 4: Delete File Cleanup
  console.log('--- Test 4: File Deletion Cleanup ---');
  const deleteRes = await storageService.deleteFile({
    bucket: 'raghul-ai-documents',
    storagePath: uploadResult.storagePath
  });
  assert(deleteRes, 'File deletion should succeed');
  console.log('✅ [PASS] File deletion cleanup verified.\n');

  console.log('🎉 Persistent Object Storage verification completed successfully!');
  process.exit(0);
}

runTest().catch((err) => {
  console.error('❌ Storage test failed:', err);
  process.exit(1);
});
