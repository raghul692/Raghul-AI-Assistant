import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const BUCKETS = [
  { name: 'raghul-ai-documents', public: true },
  { name: 'raghul-ai-reports', public: true },
  { name: 'raghul-ai-images', public: true }
];

async function provisionBuckets() {
  console.log('================================================================');
  console.log('🪣 PROVISIONING SUPABASE STORAGE BUCKETS');
  console.log('================================================================\n');

  try {
    const { data: existingBuckets, error: listError } = await supabase.storage.listBuckets();
    if (listError) {
      console.error('List error:', listError.message);
      return;
    }

    const existingNames = new Set(existingBuckets.map(b => b.name));

    for (const b of BUCKETS) {
      if (existingNames.has(b.name)) {
        console.log(`✅ Bucket "${b.name}" already exists.`);
      } else {
        console.log(`Creating bucket "${b.name}" (public: ${b.public})...`);
        const { error: createError } = await supabase.storage.createBucket(b.name, {
          public: b.public,
          fileSizeLimit: 52428800 // 50MB
        });
        if (createError) {
          console.error(`❌ Failed to create ${b.name}:`, createError.message);
        } else {
          console.log(`✅ Bucket "${b.name}" created successfully.`);
        }
      }
    }
  } catch (err) {
    console.error('Fatal storage provisioning error:', err.message);
  }
}

provisionBuckets();
