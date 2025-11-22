// Supabase configuration
import { createClient } from '@supabase/supabase-js';

// Get environment variables (injected by webpack)
// These are defined in .env file
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_STORAGE_BUCKET = process.env.SUPABASE_STORAGE_BUCKET || 'screenshots';

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing Supabase configuration. Please set SUPABASE_URL and SUPABASE_ANON_KEY in .env file');
}

export const supabase = SUPABASE_URL && SUPABASE_ANON_KEY
  ? createClient(SUPABASE_URL, SUPABASE_ANON_KEY)
  : createClient('', ''); // Fallback to prevent errors

// Storage bucket name for screenshots (from .env or default to 'screenshots')
export const SCREENSHOT_BUCKET = SUPABASE_STORAGE_BUCKET || 'screenshots';

// Log bucket name for debugging
console.log('Screenshot bucket configured:', SCREENSHOT_BUCKET);

