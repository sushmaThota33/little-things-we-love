import { createClient } from '@supabase/supabase-js';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
}

// Server-side only. Never expose this client to the browser.
export const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
