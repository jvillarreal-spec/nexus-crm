
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing SUPABASE_URL or SUPABASE_KEY environment variables");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTenancy() {
    console.log("--- Checking Conversations Tenancy ---");
    const { data: convs, error: convError } = await supabase
        .from('conversations')
        .select('id, contact_id, company_id, status, last_message_at')
        .limit(10);

    if (convError) console.error("Error fetching conversations:", convError);
    else console.table(convs);

    console.log("\n--- Checking Contacts Tenancy ---");
    const { data: contacts, error: contError } = await supabase
        .from('contacts')
        .select('id, first_name, last_name, company_id')
        .limit(10);

    if (contError) console.error("Error fetching contacts:", contError);
    else console.table(contacts);

    console.log("\n--- Checking for Conversations with NULL company_id ---");
    const { count: nullConvCount, error: nullConvError } = await supabase
        .from('conversations')
        .select('*', { count: 'exact', head: true })
        .is('company_id', null);

    if (nullConvError) console.error("Error:", nullConvError);
    else console.log("Conversations with NULL company_id:", nullConvCount);

    console.log("\n--- Checking for Contacts with NULL company_id ---");
    const { count: nullContCount, error: nullContError } = await supabase
        .from('contacts')
        .select('*', { count: 'exact', head: true })
        .is('company_id', null);

    if (nullContError) console.error("Error:", nullContError);
    else console.log("Contacts with NULL company_id:", nullContCount);

    // Check specific company Jakar if possible
    console.log("\n--- Companies ---");
    const { data: comps } = await supabase.from('companies').select('id, name');
    console.table(comps);
}

checkTenancy();
