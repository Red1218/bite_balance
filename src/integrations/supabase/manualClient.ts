import { createClient } from '@supabase/supabase-js';
import type { Database } from './types';

// Manual Supabase client using the current Lovable Cloud backend
// This avoids relying on missing Vite env vars that caused `supabaseUrl is required`.

const SUPABASE_URL = 'https://ccxqhjoqwaftnojpjojt.supabase.co';
const SUPABASE_PUBLISHABLE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNjeHFoam9xd2FmdG5vanBqb2p0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjM5NTUyMzYsImV4cCI6MjA3OTUzMTIzNn0.kcmgYyBRiqmB0eeSCZN-MKXLuHbASoj-7LqtyxLD-3o';

export const supabase = createClient<Database>(
  SUPABASE_URL,
  SUPABASE_PUBLISHABLE_KEY,
  {
    auth: {
      storage: localStorage,
      persistSession: true,
      autoRefreshToken: true,
    },
  }
);
