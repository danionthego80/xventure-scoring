import { createClient } from '@supabase/supabase-js';

// Public client for front-end use
export const supabasePublic = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    // Service client for server-side use (full access)
    export const supabaseAdmin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
        );
