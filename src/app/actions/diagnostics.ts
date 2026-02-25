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

        // 5. Check Company Bot Config
        const { data: company } = await supabaseAdmin
            .from('companies')
            .select('*')
            .eq('id', adminProfile?.company_id)
            .single();

        return {
            success: true,
            adminCompanyId: adminProfile?.company_id,
            adminRole: adminProfile?.role,
            targetInProfileUser: !!targetProfileUser,
            targetInProfileAdmin: !!targetProfileAdmin,
            targetProfile: targetProfileAdmin,
            targetAuthCompanyId: targetAuth?.user_metadata?.company_id,
            targetAuthMetadata: targetAuth?.user_metadata,
            targetEmail,
            companyName: company?.name,
            botTokenConfigured: !!company?.telegram_token,
            botSecretConfigured: !!company?.telegram_secret_token,
            expectedWebhook: company ? `https://nexus-crm-ulmv.vercel.app/api/webhooks/telegram/${company.id}` : null
        };
    } catch (error: any) {
        console.error('Diagnosis Error:', error);
        return { error: error.message };
    }
}

export async function repairProfile(email: string) {
    try {
        console.log(`[repairProfile] Starting repair for ${email}...`);

        // 1. Get Auth User
        const { data: { users }, error: authError } = await supabaseAdmin.auth.admin.listUsers();
        if (authError) throw authError;

        const user = users.find(u => u.email === email);
        if (!user) throw new Error('Usuario no encontrado en la base de datos de autenticación.');

        const metadata = user.user_metadata;
        if (!metadata?.company_id) throw new Error('El usuario no tiene una empresa (company_id) asignada en sus metadatos.');

        // 2. Perform Upsert
        console.log(`[repairProfile] Attempting upsert for ${user.id} with company ${metadata.company_id}`);
        const { error: upsertError } = await supabaseAdmin.from('profiles').upsert({
            id: user.id,
            email: user.email,
            full_name: metadata.full_name || 'Nuevo Comercial',
            role: metadata.role || 'agent',
            company_id: metadata.company_id,
            updated_at: new Date().toISOString()
        });

        if (upsertError) {
            console.error('[repairProfile] Upsert failed:', upsertError);
            throw upsertError;
        }

        console.log(`[repairProfile] Success for ${email}`);
        return { success: true };
    } catch (error: any) {
        console.error('[repairProfile] Final error:', error);
        return { success: false, error: error.message || 'Error desconocido al reparar el perfil.' };
    }
}

export async function getBotInfo(companyId: string) {
    try {
        const { data: company } = await supabaseAdmin
            .from('companies')
            .select('telegram_token, name')
            .eq('id', companyId)
            .single();

        if (!company?.telegram_token) {
            return { error: 'No hay token configurado para esta empresa.' };
        }

        const response = await fetch(`https://api.telegram.org/bot${company.telegram_token}/getWebhookInfo`);
        const webhookInfo = await response.json();

        const meResponse = await fetch(`https://api.telegram.org/bot${company.telegram_token}/getMe`);
        const meInfo = await meResponse.json();

        return {
            success: true,
            companyName: company.name,
            botInfo: meInfo.result,
            webhookInfo: webhookInfo.result
        };
    } catch (error: any) {
        console.error('Error getting bot info:', error);
        return { error: error.message };
    }
}
