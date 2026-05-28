import { createBrowserClient } from '@supabase/ssr';

/**
 * Creates a browser-side Supabase client.
 * Safe to use in Next.js Client Components.
 */
export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !anonKey) {
    throw new Error('Supabase environment variables (NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY) are missing.');
  }

  return createBrowserClient(url, anonKey);
}
