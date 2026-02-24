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
        emailService.sendCompanyWelcomeEmail(adminEmail, adminName, companyName, adminPassword).then(result => {
            if (!result.success) {
                console.error('Failed to send welcome email:', result.error);
            }
        }).catch(err => {
            console.error('Critical failure sending welcome email:', err);
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

export async function resendWelcomeEmail(companyId: string, userId?: string) {
    try {
        // 1. Get the company
        const { data: company, error: companyError } = await supabaseAdmin
            .from('companies')
            .select('name')
            .eq('id', companyId)
            .single();

        if (companyError) throw companyError;

        // 2. Identify the target user
        let profile: any = null;
        let authUser: any = null;

        if (userId) {
            // Target specific user
            const { data: p, error: pe } = await supabaseAdmin
                .from('profiles')
                .select('id, email, full_name, role')
                .eq('id', userId)
                .single();
            if (pe) throw pe;
            profile = p;
        } else {
            // Fallback to Org Admin
            const { data: p, error: pe } = await supabaseAdmin
                .from('profiles')
                .select('id, email, full_name, role')
                .eq('company_id', companyId)
                .eq('role', 'org_admin')
                .maybeSingle();
            if (pe) throw pe;
            profile = p;
        }

        if (!profile) {
            console.log(`[resendWelcomeEmail] Target user ${userId || companyId} not found in profiles. Attempting self-healing...`);

            if (userId) {
                // Find specific user in Auth
                const { data: { user: authUserFound }, error: authUserError } = await supabaseAdmin.auth.admin.getUserById(userId);
                if (authUserError || !authUserFound) throw new Error('El usuario no existe en Auth.');

                authUser = authUserFound;
            } else {
                // Fallback to Org Admin in Auth
                const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
                if (listError) throw listError;

                authUser = users.find(u =>
                    u.user_metadata?.company_id === companyId &&
                    u.user_metadata?.role === 'org_admin'
                );
            }

            if (!authUser) throw new Error('No se pudo encontrar al usuario solicitado.');

            // Reparar perfil faltante
            const { data: newProfile, error: insertError } = await supabaseAdmin
                .from('profiles')
                .insert({
                    id: authUser.id,
                    email: authUser.email,
                    full_name: authUser.user_metadata?.full_name || (userId ? 'Comercial' : 'Administrador'),
                    role: authUser.user_metadata?.role || (userId ? 'agent' : 'org_admin'),
                    company_id: authUser.user_metadata?.company_id || companyId,
                    status: 'active'
                })
                .select('id, email, full_name, role')
                .single();

            if (insertError) throw insertError;
            profile = newProfile;
            console.log(`[resendWelcomeEmail] Self-healing successful for ${profile.email}`);
        } else {
            // If profile was found, we still need the authUser to update their password
            const { data: { user: u }, error: userError } = await supabaseAdmin.auth.admin.getUserById(profile.id);
            if (userError) throw userError;
            authUser = u;
        }

        if (!profile || !authUser) {
            throw new Error('No se pudo identificar un usuario válido.');
        }

        // 3. Generate a new temporary password
        const newPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-2).toUpperCase() + "!";

        // 4. Update password in Supabase Auth
        const { error: updateAuthError } = await supabaseAdmin.auth.admin.updateUserById(
            authUser.id,
            {
                password: newPassword,
                user_metadata: { ...authUser.user_metadata, new_account: true } // Flag to force change
            }
        );

        if (updateAuthError) throw updateAuthError;

        // 5. Resend the email with the NEW password
        const emailResult = profile.role === 'org_admin'
            ? await emailService.sendCompanyWelcomeEmail(
                profile.email,
                profile.full_name || 'Administrador',
                company.name,
                newPassword
            )
            : await emailService.sendWorkerWelcomeEmail(
                profile.email,
                profile.full_name || 'Comercial',
                company.name,
                newPassword
            );

        if (!emailResult.success) {
            console.error(`[resendWelcomeEmail] Final fail: ${emailResult.error}`);
            throw new Error(`Resend Error: ${emailResult.error}`);
        }

        console.log(`[resendWelcomeEmail] Success for ${profile.email}`);
        return { success: true };
    } catch (error: any) {
        console.error('Error resending welcome email:', error);
        return { success: false, error: error.message };
    }
}

export async function createWorker(formData: { name: string; email: string }) {
    try {
        const { name, email } = formData;

        // 1. Get current user session
        const { createClient } = await import('@/lib/supabase/server');
        const supabase = await createClient();
        const { data: { user: sessionUser } } = await supabase.auth.getUser();

        if (!sessionUser) throw new Error('Unauthorized');

        // 2. Get full user metadata via Admin API to ensure we have company_id/role
        const { data: { user: currentUser }, error: getUserError } = await supabaseAdmin.auth.admin.getUserById(sessionUser.id);

        if (!currentUser || (currentUser.user_metadata.role !== 'org_admin' && currentUser.user_metadata.role !== 'super_admin')) {
            throw new Error('Unauthorized');
        }

        const companyId = currentUser.user_metadata.company_id;

        // 2. Get company name for the email
        const { data: company } = await supabaseAdmin
            .from('companies')
            .select('name')
            .eq('id', companyId)
            .single();

        if (!company) throw new Error('Company not found');

        // 3. Generate password
        const tempPassword = Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-2).toUpperCase() + "!";

        // 4. Create user in Auth
        let targetAuthUser: any = null;

        const { data: authUser, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password: tempPassword,
            email_confirm: true,
            user_metadata: {
                full_name: name,
                role: 'agent',
                company_id: companyId,
                new_account: true
            }
        });

        if (authError) {
            // Check if user already exists
            if (authError.message.includes('already has been registered') || authError.status === 422) {
                console.log(`[createWorker] User ${email} already exists. Attempting repair...`);
                // Find the user by email
                const { data: { users }, error: listError } = await supabaseAdmin.auth.admin.listUsers();
                if (listError) throw listError;

                const existingUser = users.find(u => u.email === email);
                if (!existingUser) throw new Error('Error al recuperar el usuario existente.');

                targetAuthUser = existingUser;

                // Update metadata to ensure company_id is set
                await supabaseAdmin.auth.admin.updateUserById(targetAuthUser.id, {
                    user_metadata: {
                        full_name: name,
                        role: 'agent',
                        company_id: companyId
                    }
                });
            } else {
                throw authError;
            }
        } else {
            targetAuthUser = authUser.user;
        }

        // 5. Manual Profile Sync (Defense in depth and repair)
        await supabaseAdmin.from('profiles').upsert({
            id: targetAuthUser.id,
            email: targetAuthUser.email,
            full_name: name,
            role: 'agent',
            company_id: companyId,
            status: 'active',
            updated_at: new Date().toISOString()
        });

        // 5. Send welcome email
        const emailResult = await emailService.sendWorkerWelcomeEmail(
            email,
            name,
            company.name,
            tempPassword
        );

        if (!emailResult.success) {
            console.error('Failed to send worker welcome email:', emailResult.error);
        }

        return { success: true };
    } catch (error: any) {
        console.error('Error creating worker:', error);
        return { success: false, error: error.message };
    }
}

export async function updateUserStatus(userId: string, status: 'active' | 'inactive') {
    try {
        // 1. Get current user session
        const { createClient: createServerClient } = await import('@/lib/supabase/server');
        const supabase = await createServerClient();
        const { data: { user: sessionUser } } = await supabase.auth.getUser();

        if (!sessionUser) throw new Error('Unauthorized');

        // 2. Get current user profile/metadata
        const { data: { user: currentUser } } = await supabaseAdmin.auth.admin.getUserById(sessionUser.id);
        if (!currentUser) throw new Error('Unauthorized');

        const userRole = currentUser.user_metadata.role;
        const userCompanyId = currentUser.user_metadata.company_id;

        // 3. Authorization Check
        if (userRole !== 'super_admin' && userRole !== 'org_admin') {
            throw new Error('Unauthorized');
        }

        // If org_admin, verify the target user belongs to the same company
        if (userRole === 'org_admin') {
            const { data: { user: targetUser } } = await supabaseAdmin.auth.admin.getUserById(userId);
            if (!targetUser || targetUser.user_metadata?.company_id !== userCompanyId) {
                throw new Error('Unauthorized: You can only manage your own team.');
            }
        }

        // 4. Update Profile status
        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .update({ status, updated_at: new Date().toISOString() })
            .eq('id', userId);

        if (profileError) throw profileError;

        // 4. Update Auth User (Ban/Unban)
        const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
            userId,
            {
                ban_duration: status === 'inactive' ? '876000h' : 'none', // Ban for 100 years or unban
            }
        );

        if (authError) throw authError;

        return { success: true };
    } catch (error: any) {
        console.error('Error updating user status:', error);
        return { success: false, error: error.message };
    }
}

export async function deleteUser(userId: string) {
    try {
        // 1. Get current user session
        const { createClient: createServerClient } = await import('@/lib/supabase/server');
        const supabase = await createServerClient();
        const { data: { user: sessionUser } } = await supabase.auth.getUser();

        if (!sessionUser) throw new Error('Unauthorized');

        // 2. Get current user profile/metadata
        const { data: { user: currentUser } } = await supabaseAdmin.auth.admin.getUserById(sessionUser.id);
        if (!currentUser) throw new Error('Unauthorized');

        const userRole = currentUser.user_metadata.role;
        const userCompanyId = currentUser.user_metadata.company_id;

        // 3. Authorization Check
        if (userRole !== 'super_admin' && userRole !== 'org_admin') {
            throw new Error('Unauthorized');
        }

        // If org_admin, verify the target user belongs to the same company
        if (userRole === 'org_admin') {
            const { data: { user: targetUser } } = await supabaseAdmin.auth.admin.getUserById(userId);
            if (!targetUser || targetUser.user_metadata?.company_id !== userCompanyId) {
                throw new Error('Unauthorized: You can only manage your own team.');
            }
        }

        // 4. Delete from Auth (cascades to profiles and other tables)
        const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(userId);
        if (authError) throw authError;

        return { success: true };
    } catch (error: any) {
        console.error('Error deleting user:', error);
        return { success: false, error: error.message };
    }
}

export async function updateUserProfile(userId: string, data: { name: string; role: string; company_id?: string }) {
    try {
        // 1. Get current user session
        const { createClient: createServerClient } = await import('@/lib/supabase/server');
        const supabase = await createServerClient();
        const { data: { user: sessionUser } } = await supabase.auth.getUser();

        if (!sessionUser) throw new Error('Unauthorized');

        // 2. Get current user profile/metadata
        const { data: { user: currentUser } } = await supabaseAdmin.auth.admin.getUserById(sessionUser.id);
        if (!currentUser) throw new Error('Unauthorized');

        const userRole = currentUser.user_metadata.role;
        const userCompanyId = currentUser.user_metadata.company_id;

        // 3. Authorization Check
        if (userRole !== 'super_admin' && userRole !== 'org_admin') {
            throw new Error('Unauthorized');
        }

        // If org_admin, verify the target user belongs to the same company
        if (userRole === 'org_admin') {
            const { data: { user: targetUser } } = await supabaseAdmin.auth.admin.getUserById(userId);
            if (!targetUser || targetUser.user_metadata?.company_id !== userCompanyId) {
                throw new Error('Unauthorized: You can only manage your own team.');
            }
            // Ensure they don't change company_id or try to become super_admin
            data.company_id = userCompanyId;
            if (data.role === 'super_admin') data.role = 'agent';
        }

        // 3. Update Auth User Metadata
        const { error: authError } = await supabaseAdmin.auth.admin.updateUserById(
            userId,
            {
                user_metadata: {
                    full_name: data.name,
                    role: data.role,
                    company_id: data.company_id
                }
            }
        );

        if (authError) throw authError;

        // 4. Update Profile (trigger usually handles this, but let's be explicit)
        const { error: profileError } = await supabaseAdmin
            .from('profiles')
            .update({
                full_name: data.name,
                role: data.role as any,
                company_id: data.company_id,
                updated_at: new Date().toISOString()
            })
            .eq('id', userId);

        if (profileError) throw profileError;

        return { success: true };
    } catch (error: any) {
        console.error('Error updating user profile:', error);
        return { success: false, error: error.message };
    }
}
