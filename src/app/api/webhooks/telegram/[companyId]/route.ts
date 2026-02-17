
import { NextRequest, NextResponse } from 'next/server';
import { TelegramAdapter } from '@/lib/channels/telegram/telegram.adapter';
import { createAdminClient } from '@/lib/supabase/admin';
import { AIService } from '@/lib/ai/ai.service';

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ companyId: string }> }
) {
    const { companyId } = await params;
    console.log(`--- Multi-Tenant Telegram Webhook: Company ${companyId} ---`);

    try {
        const supabase = createAdminClient();

        // 1. Fetch Company Bot Credentials
        const { data: company, error: companyError } = await supabase
            .from('companies')
            .select('telegram_token, telegram_secret_token')
            .eq('id', companyId)
            .single();

        if (companyError || !company?.telegram_token) {
            console.error('Company or Token not found:', companyError);
            return NextResponse.json({ error: 'Company not configured for Telegram' }, { status: 404 });
        }

        // 2. Validate Secret Token (If configured)
        const secretToken = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
        if (company.telegram_secret_token && secretToken !== company.telegram_secret_token) {
            console.error('Unauthorized: Invalid Secret Token');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 3. Parse Incoming Update
        const rawUpdate = await request.json();
        const adapter = new TelegramAdapter(company.telegram_token);
        const unifiedMessage = adapter.parseIncoming(rawUpdate);

        if (!unifiedMessage) {
            console.log('Ignored update (not a supported message type)');
            return NextResponse.json({ ok: true });
        }

        // 4. Process Message (Same logic as global hook, but pinned to companyId)
        // a. Ensure Contact Exists
        const { data: contact } = await supabase
            .from('contacts')
            .select('id, tags, metadata, first_name, last_name, email, phone, assigned_to')
            .eq('channel', 'telegram')
            .eq('channel_id', unifiedMessage.chatId)
            .eq('company_id', companyId)
            .maybeSingle();

        let currentContact = contact;

        if (!currentContact) {
            console.log('Creating new multi-tenant contact...');
            // Round Robin for new contact
            const { data: loadData } = await supabase.rpc('get_agent_load', { org_id: companyId });
            const assignedAgentId = loadData?.[0]?.agent_id;

            const { data: newContact } = await supabase
                .from('contacts')
                .insert({
                    channel: 'telegram',
                    channel_id: unifiedMessage.chatId,
                    company_id: companyId,
                    first_name: unifiedMessage.senderName,
                    username: unifiedMessage.senderUsername,
                    assigned_to: assignedAgentId
                })
                .select('*')
                .single();
            currentContact = newContact;
        }

        if (currentContact) {
            // b. Ensure Conversation Exists
            let { data: conversation } = await supabase
                .from('conversations')
                .select('id, unread_count, status')
                .eq('contact_id', currentContact.id)
                .order('created_at', { ascending: false })
                .limit(1)
                .maybeSingle();

            if (!conversation || conversation.status === 'closed') {
                const { data: newConv } = await supabase
                    .from('conversations')
                    .insert({
                        contact_id: currentContact.id,
                        company_id: companyId,
                        assigned_to: currentContact.assigned_to,
                        channel: 'telegram',
                        status: 'open',
                    })
                    .select('*')
                    .single();
                conversation = newConv;
            }

            // c. Create Message (Record the user interaction)
            if (conversation) {
                await supabase.from('messages').insert({
                    conversation_id: conversation.id,
                    company_id: companyId,
                    channel_message_id: unifiedMessage.channelMessageId,
                    direction: 'inbound',
                    sender_type: 'customer',
                    content_type: unifiedMessage.contentType,
                    body: unifiedMessage.body,
                    media_url: unifiedMessage.mediaUrl,
                });

                // Update Metadata
                await Promise.all([
                    supabase.from('conversations').update({
                        last_message_at: new Date().toISOString(),
                        unread_count: (conversation.unread_count || 0) + 1
                    }).eq('id', conversation.id),
                    supabase.from('contacts').update({
                        updated_at: new Date().toISOString()
                    }).eq('id', currentContact.id)
                ]);

                // d. BOT LOGIC (INTERACTIVE)
                const ai = new AIService();
                const adapter = new TelegramAdapter(company.telegram_token);
                const userInput = unifiedMessage.body.toLowerCase().trim();

                // Get Knowledge Base & Company Config
                const { data: companyDetails } = await supabase
                    .from('companies')
                    .select('support_email, organization_knowledge(content)')
                    .eq('id', companyId)
                    .single();

                const businessContext = (companyDetails?.organization_knowledge as any)?.[0]?.content || "";
                const supportDestEmail = companyDetails?.support_email || 'soporte@nexuscrm.ai';

                // 1. /start or Hello -> Initial Menu
                if (userInput === '/start' || userInput === 'hola' || userInput === 'menú') {
                    await adapter.sendInteractiveMenu(unifiedMessage.chatId, {
                        text: "¡Hola! 👋 Bienvenido a NexusCRM Demo.\n\nSoy tu asistente virtual. ¿En qué puedo ayudarte hoy?",
                        options: [
                            { label: "💰 Precios", value: "menu_prices" },
                            { label: "📦 Productos", value: "menu_products" },
                            { label: "🛠️ Soporte", value: "menu_support" },
                            { label: "👤 Hablar con asesor", value: "menu_agent" }
                        ]
                    });
                    return NextResponse.json({ ok: true });
                }

                // 2. Handle Callbacks
                if (unifiedMessage.isCallback) {
                    const data = unifiedMessage.callbackData;

                    if (data === 'menu_products' || data === 'menu_prices') {
                        const type = data === 'menu_products' ? 'products' : 'prices';
                        const response = await ai.getKnowledgeResponse(
                            `Háblame de tus ${type === 'products' ? 'productos' : 'precios'}`,
                            businessContext,
                            type
                        );
                        await adapter.sendTextMessage(unifiedMessage.chatId, response);
                    }
                    else if (data === 'menu_agent') {
                        await adapter.sendTextMessage(unifiedMessage.chatId, "Entendido. Un asesor te atenderá en este mismo chat en un momento. ¡Gracias por tu paciencia!");
                        // Optional: trigger notification here if needed
                    }
                    else if (data === 'menu_support') {
                        // Start Support Flow
                        await supabase.from('contacts').update({
                            metadata: { ...(currentContact.metadata || {}), bot_state: 'awaiting_support_issue' }
                        }).eq('id', currentContact.id);
                        await adapter.sendTextMessage(unifiedMessage.chatId, "Lamentamos los inconvenientes. 🛠️\n\nPor favor, describe detalladamente cuál es el error o problema que estás presentando.");
                    }
                    return NextResponse.json({ ok: true });
                }

                // 3. Handle Stateful Flows (Soporte)
                const botState = currentContact.metadata?.bot_state;
                if (botState === 'awaiting_support_issue') {
                    await supabase.from('contacts').update({
                        metadata: {
                            ...(currentContact.metadata || {}),
                            bot_state: 'idle',
                            last_support_issue: unifiedMessage.body
                        }
                    }).eq('id', currentContact.id);

                    await adapter.sendTextMessage(unifiedMessage.chatId, "Gracias. Hemos recibido tu reporte. Un correo ha sido enviado a nuestro equipo de soporte y te contactaremos por aquí lo más pronto posible.");

                    // Generate "Email" in logs (as requested)
                    console.log(`[SUPPORT EMAIL SIMULATION]
                        Para: ${supportDestEmail}
                        Cliente: ${currentContact.first_name} ${currentContact.last_name || ''}
                        Email: ${currentContact.email || 'No proporcionado'}
                        Tel: ${currentContact.phone || 'No proporcionado'}
                        Problema: ${unifiedMessage.body}
                    `);
                    return NextResponse.json({ ok: true });
                }

                // 4. Default AI Enrichment (for normal messages)
                if (!unifiedMessage.isCallback) {
                    try {
                        const fullResult = await ai.processFullEnrichment(unifiedMessage.body, currentContact, businessContext);
                        if (fullResult.analysis) {
                            await supabase.from('contacts').update({
                                tags: Array.from(new Set([...(currentContact.tags || []), ...fullResult.analysis.tags])),
                                metadata: {
                                    ...(currentContact.metadata || {}),
                                    ai_summary: fullResult.analysis.extracted_data.summary
                                }
                            }).eq('id', currentContact.id);
                        }
                    } catch (e) {
                        console.error('AI Enrichment Error:', e);
                    }
                }
            }
        }

        return NextResponse.json({ ok: true });
    } catch (error: any) {
        console.error('CRITICAL: Multi-tenant Webhook Error:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
