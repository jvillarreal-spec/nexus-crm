import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { TelegramAdapter } from '@/lib/channels/telegram/telegram.adapter';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
);

export async function GET(req: NextRequest) {
    const conversationId = req.nextUrl.searchParams.get('conv');
    const logs: string[] = [];

    try {
        if (!conversationId) {
            // List recent conversations
            const { data: convs } = await supabaseAdmin
                .from('conversations')
                .select('id, contact_id, status, updated_at')
                .order('updated_at', { ascending: false })
                .limit(5);
            return NextResponse.json({ message: 'Pass ?conv=<id>', recent: convs });
        }

        logs.push(`Testing conversation: ${conversationId}`);

        // Step 1: Get conversation
        const { data: conversation, error: convErr } = await supabaseAdmin
            .from('conversations')
            .select('contact_id')
            .eq('id', conversationId)
            .single();
        logs.push(`Conversation: ${JSON.stringify(conversation)}, Error: ${convErr?.message}`);

        if (!conversation) return NextResponse.json({ logs, error: 'No conversation found' });

        // Step 2: Get contact
        const { data: contact, error: contactErr } = await supabaseAdmin
            .from('contacts')
            .select('channel_id, company_id')
            .eq('id', conversation.contact_id)
            .single();
        logs.push(`Contact: ${JSON.stringify(contact)}, Error: ${contactErr?.message}`);

        if (!contact) return NextResponse.json({ logs, error: 'No contact found' });

        // Step 3: Get company token
        const { data: company, error: companyErr } = await supabaseAdmin
            .from('companies')
            .select('telegram_token, name')
            .eq('id', contact.company_id)
            .single();
        logs.push(`Company: ${company?.name}, hasToken: ${!!company?.telegram_token}, Error: ${companyErr?.message}`);

        if (!company?.telegram_token) return NextResponse.json({ logs, error: 'No telegram token' });
        if (!contact.channel_id) return NextResponse.json({ logs, error: 'No channel_id (chatId)' });

        // Step 4: Send test message
        const telegram = new TelegramAdapter(company.telegram_token);
        await telegram.sendTextMessage(contact.channel_id, "✅ TEST: Tu asesor finalizó la conversación, recuerda que puedes volver cuando quieras 👋");
        logs.push('Message sent successfully!');

        return NextResponse.json({ success: true, logs });
    } catch (err: any) {
        logs.push(`EXCEPTION: ${err.message}`);
        return NextResponse.json({ success: false, logs, error: err.message });
    }
}
