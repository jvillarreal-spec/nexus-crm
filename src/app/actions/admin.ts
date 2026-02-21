'use server';

import { createClient } from '@supabase/supabase-js';
import { TelegramAdapter } from '@/lib/channels/telegram/telegram.adapter';
import { EmailService } from '@/lib/email/email.service';

const emailService = new EmailService();


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

        // 4. Send Welcome Email (Non-blocking)
        emailService.sendCompanyWelcomeEmail(adminEmail, adminName, companyName).catch(err => {
            console.error('Failed to send welcome email:', err);
        });

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
        console.log('[closeConversation] Starting for:', conversationId);

        // 1. Get conversation to find contact_id
        const { data: conversation, error: fetchError } = await supabaseAdmin
            .from('conversations')
            .select('contact_id')
            .eq('id', conversationId)
            .single();

        if (fetchError || !conversation) {
            throw new Error('Conversation not found: ' + fetchError?.message);
        }
        console.log('[closeConversation] Conversation:', conversation);

        // 2. Update status to closed
        const { error: updateError } = await supabaseAdmin
            .from('conversations')
            .update({ status: 'closed', updated_at: new Date().toISOString() })
            .eq('id', conversationId);

        if (updateError) throw updateError;

        // 3. Get contact: channel_id (Telegram chat ID) AND company_id
        const { data: contact, error: contactError } = await supabaseAdmin
            .from('contacts')
            .select('channel_id, company_id')
            .eq('id', conversation.contact_id)
            .single();

        console.log('[closeConversation] Contact:', contact, 'Error:', contactError);

        // 4. Get company telegram_token using company_id from contact
        const { data: company, error: companyError } = await supabaseAdmin
            .from('companies')
            .select('telegram_token')
            .eq('id', contact?.company_id)
            .single();

        console.log('[closeConversation] Company token found:', !!company?.telegram_token, 'Error:', companyError);

        // 5. Send Closing Message via Telegram
        const companyToken = company?.telegram_token;
        const chatId = contact?.channel_id;

        console.log('[closeConversation] Sending farewell. chatId:', chatId, 'hasToken:', !!companyToken);

        if (companyToken && chatId) {
            const telegram = new TelegramAdapter(companyToken);
            await telegram.sendTextMessage(chatId, "Tu asesor finalizó la conversación, recuerda que puedes volver cuando quieras 👋");
            console.log('[closeConversation] Farewell message sent successfully');
        } else {
            console.warn('[closeConversation] Could not send farewell - missing token or chatId');
        }

        return { success: true };
    } catch (error: any) {
        console.error('Error closing conversation:', error);
        return { success: false, error: error.message };
    }
}


export async function updateBusinessHours(companyId: string, businessHours: object, timezone: string) {

    try {
        const { error } = await supabaseAdmin
            .from('companies')
            .update({ business_hours: businessHours, timezone })
            .eq('id', companyId);

        if (error) throw error;
        return { success: true };
    } catch (error: any) {
        console.error('Error updating business hours:', error);
        return { success: false, error: error.message };
    }
}

export async function updateCompany(companyId: string, data: { name: string, slug: string }) {
    try {
        const { error } = await supabaseAdmin
            .from('companies')
            .update({
                name: data.name,
                slug: data.slug
            })
            .eq('id', companyId);

        if (error) throw error;
        return { success: true };
    } catch (error: any) {
        console.error('Error updating company:', error);
        return { success: false, error: error.message };
    }
}

export async function resendWelcomeEmail(companyId: string) {
    try {
        // 1. Get Company Details
        const { data: company, error: compError } = await supabaseAdmin
            .from('companies')
            .select('name')
            .eq('id', companyId)
            .single();

        if (compError) throw compError;

        // 2. Get Admin details (first org_admin found for this company)
        const { data: profile, error: profError } = await supabaseAdmin
            .from('profiles')
            .select('email, full_name')
            .eq('company_id', companyId)
            .eq('role', 'org_admin')
            .order('created_at', { ascending: true })
            .limit(1)
            .single();

        if (profError) {
            if (profError.code === 'PGRST116') {
                throw new Error('No se encontró un administrador configurado para esta empresa.');
            }
            throw profError;
        }

        // 3. Resend the email
        const success = await emailService.sendCompanyWelcomeEmail(
            profile.email,
            profile.full_name || 'Administrador',
            company.name
        );

        if (!success) throw new Error('Error al enviar el correo a través del servicio.');

        return { success: true };
    } catch (error: any) {
        console.error('Error resending welcome email:', error);
        return { success: false, error: error.message };
    }
}

