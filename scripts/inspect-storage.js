import dotenv from 'dotenv';
dotenv.config();
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
  try {
    const { data: buckets, error } = await supabase.storage.listBuckets();
    if (error) {
      console.error('Storage error:', error);
    } else {
      console.log('Existing storage buckets:', buckets.map(b => ({ name: b.name, public: b.public })));
    }
  } catch (err) {
    console.error('Exception:', err.message);
  }
}

run();
