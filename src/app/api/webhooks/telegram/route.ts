
import { NextRequest, NextResponse } from 'next/server';
import { TelegramAdapter } from '@/lib/channels/telegram/telegram.adapter';
import { createAdminClient } from '@/lib/supabase/admin';
import { AIService } from '@/lib/ai/ai.service';
import { EmailService } from '@/lib/email/email.service';

export async function POST(request: NextRequest) {
    console.log('--- Telegram Webhook received ---');
    try {
        // 1. Validate Secret Token
        const secretToken = request.headers.get('X-Telegram-Bot-Api-Secret-Token');
        if (secretToken !== process.env.TELEGRAM_WEBHOOK_SECRET) {
            console.error('Unauthorized: Invalid Secret Token');
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // 2. Parse Incoming Update
        // 2. Parse Incoming Update
        const rawUpdate = await request.json();

        // Initial adapter just for parsing, doesn't need token yet
        const adapter = new TelegramAdapter();
        const unifiedMessage = adapter.parseIncoming(rawUpdate);


        if (!unifiedMessage) {
            console.log('Ignored update (not a supported message type)');
            return NextResponse.json({ ok: true });
        }

        console.log(`Processing message from ${unifiedMessage.senderName} (${unifiedMessage.chatId})`);

        // 3. Store in DB (Supabase Admin)
        const supabase = createAdminClient();
        const ai = new AIService();
        const emailService = new EmailService();

        // a. Ensure Contact Exists
        const { data: contact, error: contactError } = await supabase
            .from('contacts')
            .select('id, tags, metadata, first_name, last_name, email, phone')
            .eq('channel', 'telegram')
            .eq('channel_id', unifiedMessage.chatId)
            .maybeSingle();

        let currentContact = contact;

        if (!currentContact) {
            console.log('Creating new contact...');
            const { data: newContact, error: insertError } = await supabase
                .from('contacts')
                .insert({
                    channel: 'telegram',
                    channel_id: unifiedMessage.chatId,
                    first_name: unifiedMessage.senderName,
                    username: unifiedMessage.senderUsername,
                })
                .select('id, tags, metadata, first_name, last_name, email, phone')
                .single();

            if (insertError) console.error('Error creating contact:', insertError);
            currentContact = newContact;
        }

        if (currentContact) {
            // b. Ensure Conversation Exists
            let { data: conversation, error: convError } = await supabase
                .from('conversations')
                .select('id, unread_count, assigned_to, company_id, created_at')

                .eq('contact_id', currentContact.id)
                .eq('status', 'open')
                .maybeSingle();

            // NEW: Default Company (Nexus Global)
            let companyId = conversation?.company_id;
            if (!companyId) {
                const { data: company } = await supabase
                    .from('companies')
                    .select('id')
                    .eq('slug', 'nexus-global')
                    .single();
                companyId = company?.id;
            }

            if (!conversation) {
                console.log('Creating new conversation (Bot Mode - Unassigned)...');

                const { data: newConversation, error: createConvError } = await supabase
                    .from('conversations')
                    .insert({
                        contact_id: currentContact.id,
                        company_id: companyId,
                        assigned_to: null, // Start Unassigned (Bot Mode)
                        channel: 'telegram',
                        status: 'open',
                    })
                    .select('id, unread_count, assigned_to, company_id, created_at')

                    .single();

                if (createConvError) console.error('Error creating conversation:', createConvError);
                conversation = newConversation;

                // Set contact company
                await supabase.from('contacts').update({ company_id: companyId }).eq('id', currentContact.id);
            }

            const isNewConversation = !conversation || (conversation.created_at && new Date().getTime() - new Date(conversation.created_at).getTime() < 5000 && conversation.unread_count <= 1);


            // c. Save Message
            if (conversation) {
                // Save inbound message
                await supabase.from('messages').insert({
                    conversation_id: conversation.id,
                    channel_message_id: unifiedMessage.channelMessageId,
                    direction: 'inbound',
                    sender_type: 'customer',
                    content_type: unifiedMessage.contentType,
                    body: unifiedMessage.body,
                    media_url: unifiedMessage.mediaUrl,
                });

                // Update timestamps
                await supabase.from('conversations').update({
                    last_message_at: new Date().toISOString(),
                    unread_count: (conversation.unread_count || 0) + 1
                }).eq('id', conversation.id);

                // --- LOGIC SPLIT: BOT vs AGENT ---

                if (conversation.assigned_to) {
                    // --- AGENT MODE ---
                    console.log('Conversation assigned to agent. Skipping Bot Auto-Response.');
                    // Optional: Run silent AI enrichment to keep tags updated
                } else {
                    // --- BOT MODE ---
                    // --- BOT MODE ---
                    console.log(`[BOT] Conversation ${conversation.id} is UNASSIGNED. Bot taking control.`);

                    // FETCH TOKEN FOR SENDING
                    // Check DB for token
                    const { data: companyData } = await supabase
                        .from('companies')
                        .select('telegram_token')
                        .eq('id', companyId)
                        .single();

                    const dbToken = companyData?.telegram_token;
                    // Fallback to Env var if DB token is missing
                    const finalToken = dbToken || process.env.TELEGRAM_BOT_TOKEN;

                    console.log(`[BOT] Sending with token: ${finalToken ? 'FOUND (Ends with ' + finalToken.slice(-4) + ')' : 'MISSING'}`);

                    if (!finalToken) {
                        console.error('[BOT] CRITICAL: No Telegram Token found (neither in DB nor ENV). Cannot reply.');
                        return NextResponse.json({ ok: true });
                    }

                    // Re-initialize adapter with correct token
                    const sendAdapter = new TelegramAdapter(finalToken);

                    // Sending "Typing..."
                    try {
                        await sendAdapter.sendTextMessage(unifiedMessage.chatId, "<i>Escribiendo...</i>");
                    } catch (typingError) {
                        console.error('[BOT] Error sending typing indicator:', typingError);
                    }

                    // --- NEW CONVERSATION WELCOME MENU ---
                    // If this is the VERY FIRST message of a new conversation (created just now), send the Menu.
                    // We can check if unread_count is 1 (the message we just inserted).

                    if (conversation.unread_count === 1) {
                        console.log('[BOT] New Conversation detected directly. Sending Welcome Menu.');
                        try {
                            await sendAdapter.sendInteractiveMenu(unifiedMessage.chatId, {
                                text: `Hola ${unifiedMessage.senderName} 👋 Bienvenido a NexusCRM.\n\nSoy tu asistente virtual. ¿En qué puedo ayudarte hoy?`,
                                options: [
                                    { label: "📦 Ver Productos", value: "info_products" },
                                    { label: "💲 Consultar Precios", value: "info_prices" },
                                    { label: "🆘 Soporte Técnico", value: "help_support" },
                                    { label: "👤 Hablar con Asesor", value: "agent_handover" }
                                ]
                            });
                            // We STOP here? Or we also process the text?
                            // If the user text was just "Hola", the menu is enough.
                            // If the user text was "Precio de X", we should probably answer that too.
                            // Let's analyze intent anyway, but maybe prioritizing the Menu if Intent is 'general'.
                        } catch (menuError) {
                            console.error('[BOT] Error sending Welcome Menu:', menuError);
                        }
                    }

                    // 1. Get Knowledge Base

                    const { data: knowledge } = await supabase
                        .from('organization_knowledge')
                        .select('content')
                        .limit(1)
                        .maybeSingle();
                    const businessContext = knowledge?.content || "";

                    // 2. Analyze Intent
                    try {
                        console.log(`[BOT] Analyzing intent for message: "${unifiedMessage.body}"`);
                        const fullResult = await ai.processFullEnrichment(unifiedMessage.body, currentContact, businessContext);
                        let intent = fullResult?.analysis?.intent || 'general';

                        console.log(`[BOT] Intent Detected: ${intent}`);

                        // Override Intent if it's a specific Button Click (Callback)
                        // Note: Adapter currently returns callback content as "top level" body if parsed that way.
                        // Ideally we check unifiedMessage.isCallback or unifiedMessage.callbackData
                        if (unifiedMessage.body.includes("info_products")) intent = 'bot_query'; // simplification
                        // Better: check logic below.

                        // 3. Routing Logic
                        if (intent === 'support_request') {
                            // --- SUPPORT FLOW ---
                            const { data: company } = await supabase.from('companies').select('support_email').eq('id', companyId).single();
                            const supportEmail = company?.support_email;

                            if (supportEmail) {
                                await emailService.sendSupportTicket(
                                    supportEmail,
                                    currentContact,
                                    unifiedMessage.body,
                                    conversation.id
                                );
                                await sendAdapter.sendTextMessage(unifiedMessage.chatId, "✅ <b>Ticket de Soporte Creado</b>\n\nHemos enviado tu reporte a nuestro equipo técnico. Te contactaremos por correo pronto.");
                            } else {
                                await sendAdapter.sendTextMessage(unifiedMessage.chatId, "⚠️ No pudimos crear el ticket (Falta config de email). Un asesor revisará este chat pronto.");
                            }

                        } else if (intent === 'handover_request') {
                            // --- HANDOVER FLOW ---

                            // 1. Check Business Hours & Agent Load
                            // Function is_business_open and get_agent_load must be accessible via RPC or query
                            // Since we can't easily call PLPGSQL function directly from JS client without RPC,
                            // we can query the company settings directly or use RPC if exposed.
                            // For simplicity/robustness, let's fetch settings and do logic here OR use the simple RPC created.

                            const { data: isOpen } = await supabase.rpc('is_business_open', { company_id: companyId });

                            let assignedAgentId = null;

                            if (isOpen === false) {
                                // CLOSED - Immediate Fallback
                                await sendAdapter.sendTextMessage(unifiedMessage.chatId, "🌙 <b>Actualmente estamos fuera de horario laboral.</b>\n\nPor favor, déjanos tu <b>Nombre, Teléfono y Correo</b>. Te contactaremos tan pronto abramos. 🕒");
                                return NextResponse.json({ ok: true });
                            }

                            // Round Robin Assignment (only if open)
                            const { data: assignments } = await supabase.rpc('get_agent_load', { org_id: companyId });

                            // The variable is already declared above
                            assignedAgentId = null;


                            if (assignments && assignments.length > 0) {
                                assignedAgentId = assignments[0].agent_id;
                            } else {
                                // Fallback: Pick any agent
                                const { data: agents } = await supabase.from('profiles').select('id').eq('company_id', companyId).eq('role', 'agent').limit(1);
                                if (agents && agents.length > 0) assignedAgentId = agents[0].id;
                            }

                            if (assignedAgentId) {
                                await supabase.from('conversations').update({ assigned_to: assignedAgentId }).eq('id', conversation.id);
                                await supabase.from('contacts').update({ assigned_to: assignedAgentId }).eq('id', currentContact.id);
                                await sendAdapter.sendTextMessage(unifiedMessage.chatId, "👨‍💻 <b>Conectando con un asesor...</b>\n\nHe asignado tu conversación a un especialista. Te responderá en breve.");
                            } else {
                                await sendAdapter.sendTextMessage(unifiedMessage.chatId, "⚠️ <b>Nuestros asesores no están disponibles en este momento.</b>\n\nPor favor, déjanos tu <b>Nombre, Teléfono y Correo</b> en un solo mensaje. Te contactaremos mañana a primera hora. 📝");
                            }


                        } else if (intent === 'bot_query') {
                            // --- KNOWLEDGE ANSWER ---
                            const queryType = unifiedMessage.body.toLowerCase().includes('precio') ? 'prices' : 'products';
                            const answer = await ai.getKnowledgeResponse(unifiedMessage.body, businessContext, queryType);

                            console.log('[BOT] Sending Knowledge Answer.');
                            await sendAdapter.sendTextMessage(unifiedMessage.chatId, answer);
                        } else {
                            // --- GENERAL / FALLBACK ---
                            // If it's the FIRST message, we already sent the Menu. Do we send text too?
                            // If intent is 'general' and unread_count === 1, we might skip sending another generic "Hola".
                            if (conversation.unread_count > 1) {
                                const reply = fullResult?.advice?.suggested_replies?.[0] || "Hola, ¿en qué puedo ayudarte hoy?";
                                console.log('[BOT] Sending General Reply.');
                                await sendAdapter.sendTextMessage(unifiedMessage.chatId, reply);
                            } else {
                                console.log('[BOT] Skipping General Reply (Welcome Menu already sent).');
                            }
                        }

                        // 4. Save metadata update
                        if (fullResult?.analysis) {
                            const updateData: any = {
                                metadata: {
                                    ...(currentContact.metadata || {}),
                                    last_intent: intent,
                                    last_ai_analysis: new Date().toISOString()
                                }
                            };
                            await supabase.from('contacts').update(updateData).eq('id', currentContact.id);
                        }
                    } catch (aiError: any) {
                        console.error('[BOT] AI Service Failed:', aiError);
                        // Fallback response using the correct adapter
                        await sendAdapter.sendTextMessage(unifiedMessage.chatId, "👨‍💻 Hola. He recibido tu mensaje. En un momento un asesor te atenderá.");
                    }


                }
            }
        }

        return NextResponse.json({ ok: true });
    } catch (error: any) {
        console.error('CRITICAL: Webhook Handler Error:', error);
        return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
    }
}

export async function GET(request: NextRequest) {
    return NextResponse.json({ status: 'active', service: 'Telegram Webhook' });
}
