
import { createBrowserClient } from '@supabase/ssr'

export function createClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseUrl.startsWith('http') || !supabaseAnonKey || supabaseAnonKey === 'your-anon-key') {
    // Return a placeholder client during build time if environment variables are missing or are placeholders.
    return createBrowserClient(
      'https://placeholder-url.supabase.co',
      'placeholder-key'
    );
  }

  return createBrowserClient(
    supabaseUrl,
    supabaseAnonKey
  )
}
