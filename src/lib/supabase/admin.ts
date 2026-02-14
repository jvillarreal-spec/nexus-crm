
import { createClient } from '@supabase/supabase-js'

export function createAdminClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseUrl.startsWith('http') || !supabaseServiceRoleKey || supabaseServiceRoleKey === 'your-service-role-key') {
        throw new Error('Missing or invalid SUPABASE_SERVICE_ROLE_KEY');
    }

    return createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    })
}
