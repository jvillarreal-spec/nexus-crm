'use server';

import { createClient } from '@supabase/supabase-js';
import { TelegramAdapter } from '@/lib/channels/telegram/telegram.adapter';


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

export async function createCompanyWithAdmin(formData: any) {
    const { companyName, companySlug, adminEmail, adminPassword, adminName } = formData;

    try {
        // 1. Create Company
        const { data: company, error: compError } = await supabaseAdmin
            .from('companies')
            .insert({ name: companyName, slug: companySlug })
            .select()
            .single();

        if (compError) throw compError;

        // 2. Create Admin User in Auth
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email: adminEmail,
            password: adminPassword,
            email_confirm: true,
            user_metadata: {
                full_name: adminName,
                role: 'org_admin',
                company_id: company.id
            }
        });

        if (authError) throw authError;

        // 3. Profiles table is updated automatically by the trigger we created in migration!

        return { success: true, company };
    } catch (error: any) {
        console.error('Error creating company:', error);
        return { success: false, error: error.message };
    }
}

export async function createAgent(formData: any, companyId: string) {
    const { email, password, fullName } = formData;

    try {
        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: {
                full_name: fullName,
                role: 'agent',
                company_id: companyId
            }
        });

        if (authError) throw authError;

        return { success: true };
    } catch (error: any) {
        console.error('Error creating agent:', error);
        return { success: false, error: error.message };
    }
}

export async function toggleAgentStatus(userId: string, active: boolean) {
    // This could involve updating a column 'is_active' in profiles or using auth.admin.updateUserById
    // For now, let's assume we update the profile.
    const { error } = await supabaseAdmin
        .from('profiles')
        .update({ updated_at: new Date() }) // Placeholder for status logic
        .eq('id', userId);

    return { success: !error };
}

export async function transferConversation(conversationId: string, contactId: string, newAgentId: string) {
    try {
        const { error: convError } = await supabaseAdmin
            .from('conversations')
            .update({ assigned_to: newAgentId, updated_at: new Date().toISOString() })
            .eq('id', conversationId);

        if (convError) throw convError;

        const { error: contError } = await supabaseAdmin
            .from('contacts')
            .update({ assigned_to: newAgentId, updated_at: new Date().toISOString() })
            .eq('id', contactId);

        if (contError) throw contError;

        return { success: true };
    } catch (error: any) {
        console.error('Error transferring conversation:', error);
        return { success: false, error: error.message };
    }
}

export async function updateCompanyBot(companyId: string, token: string, secret: string) {
    try {
        // 1. Update Database
        const { error: dbError } = await supabaseAdmin
            .from('companies')
            .update({
                telegram_token: token,
                telegram_secret_token: secret,
                updated_at: new Date().toISOString()
            })
            .eq('id', companyId);

        if (dbError) throw dbError;

        // 2. Register Webhook with Telegram
        // In local development, you might need a tunnel (ngrok). In production, NEXT_PUBLIC_APP_URL should be set.
        const host = process.env.NEXT_PUBLIC_APP_URL || 'https://nexuscrm.ai';
        const webhookUrl = `${host}/api/webhooks/telegram/${companyId}`;

        const response = await fetch(`https://api.telegram.org/bot${token}/setWebhook`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                url: webhookUrl,
                secret_token: secret
            })
        });

        const result = await response.json();

        if (!result.ok) {
            throw new Error(result.description || 'Failed to set Telegram webhook');
        }

        return { success: true };
    } catch (error: any) {
        console.error('Error updating company bot:', error);
        return { success: false, error: error.message };
    }
}

export async function updateSupportEmail(companyId: string, email: string) {
    try {
        const { error } = await supabaseAdmin
            .from('companies')
            .update({ support_email: email, updated_at: new Date().toISOString() })
            .eq('id', companyId);

        if (error) throw error;
        return { success: true };
    } catch (error: any) {
        console.error('Error updating support email:', error);
        return { success: false, error: error.message };
    }
}
export async function closeConversation(conversationId: string) {
    try {
        // 1. Get conversation and contact details to send the message
        const { data: conversation, error: fetchError } = await supabaseAdmin
            .from('conversations')
            .select('contact_id, contacts(channel_id, companies(telegram_token))')
            .eq('id', conversationId)
            .single();

        if (fetchError || !conversation) {
            throw new Error('Conversation not found');
        }

        // 2. Update status to closed
        const { error: updateError } = await supabaseAdmin
            .from('conversations')
            .update({ status: 'closed', updated_at: new Date().toISOString() })
            .eq('id', conversationId);

        if (updateError) throw updateError;

        // 3. Send Closing Message via Telegram
        const contact = conversation.contacts as any;
        const companyToken = contact?.companies?.telegram_token;
        const chatId = contact?.channel_id;

        if (companyToken && chatId) {
            const telegram = new TelegramAdapter(companyToken);
            await telegram.sendTextMessage(chatId, "Has finalizado tu conversación con el asesor, vuelve pronto, estamos para ayudarte 👋");
        }

        return { success: true };
    } catch (error: any) {
        console.error('Error closing conversation:', error);
        return { success: false, error: error.message };
    }
}
