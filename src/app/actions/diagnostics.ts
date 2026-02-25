'use server';

import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
        auth: {
            autoRefreshToken: false,
            persistSession: false
        }
    }
);

export async function diagnoseAccount(targetEmail: string) {
    try {
        const { createClient: createServerClient } = await import('@/lib/supabase/server');
        const supabase = await createServerClient();
        const { data: { user: sessionUser } } = await supabase.auth.getUser();

        if (!sessionUser) return { error: 'No session' };

        // 1. Check Admin Profile
        const { data: adminProfile } = await supabase.from('profiles').select('*').eq('id', sessionUser.id).single();

        // 2. Check Target in Auth
        const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
        if (listError) throw listError;

        const targetAuth = users.find(u => u.email === targetEmail);

        // 3. Check Target in Profile (User Client - RLS applies)
        const { data: targetProfileUser } = await supabase.from('profiles').select('*').eq('email', targetEmail).maybeSingle();

        // 4. Check Target in Profile (Admin Client - RLS bypassed)
        const { data: targetProfileAdmin } = await supabaseAdmin.from('profiles').select('*').eq('email', targetEmail).maybeSingle();

        return {
            success: true,
            adminCompanyId: adminProfile?.company_id,
            adminRole: adminProfile?.role,
            targetInProfileUser: !!targetProfileUser,
            targetInProfileAdmin: !!targetProfileAdmin,
            targetProfile: targetProfileAdmin,
            targetAuthCompanyId: targetAuth?.user_metadata?.company_id,
            targetAuthMetadata: targetAuth?.user_metadata
        };
    } catch (error: any) {
        console.error('Diagnosis Error:', error);
        return { error: error.message };
    }
}
