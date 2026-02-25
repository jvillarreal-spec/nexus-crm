import { createClient } from '@supabase/supabase-js';

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkJakarBot() {
    console.log('--- Checking Jakar Bot Config ---');
    const { data: companies, error } = await supabaseAdmin
        .from('companies')
        .select('*')
        .ilike('name', '%Jakar%');

    if (error) {
        console.error('Error fetching company:', error);
        return;
    }

    if (!companies || companies.length === 0) {
        console.log('Jakar company not found.');
        return;
    }

    const jakar = companies[0];
    console.log('Company Name:', jakar.name);
    console.log('Company ID:', jakar.id);
    console.log('Telegram Token:', jakar.telegram_token ? 'EXISTS' : 'MISSING');
    console.log('Telegram Secret:', jakar.telegram_secret_token ? 'EXISTS' : 'MISSING');

    if (jakar.telegram_token) {
        console.log('Expected Webhook URL:', `https://nexus-crm-ulmv.vercel.app/api/webhooks/telegram/${jakar.id}`);
    }
}

// Since I cannot run node directly with modules easily without setup, 
// I will just use this to provide a copy-pasteable script if I need it later,
// but for now I will rely on my internal reasoning or the diagnostics server action.
