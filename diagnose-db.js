
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Manual .env.local parsing
const envPath = path.resolve('.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const env = {};
envContent.split('\n').forEach(line => {
    const [key, value] = line.split('=');
    if (key && value) env[key.trim()] = value.trim();
});

const supabaseAdmin = createClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.SUPABASE_SERVICE_ROLE_KEY
);

async function diagnose() {
    console.log("--- Supabase Diagnostics ---");

    // 1. Check Profiles
    const { data: profiles } = await supabaseAdmin.from('profiles').select('email, role, company_id');
    console.log("\nProfiles:", JSON.stringify(profiles, null, 2));

    // 2. Check Companies
    const { data: companies } = await supabaseAdmin.from('companies').select('id, name, slug');
    console.log("\nCompanies:", JSON.stringify(companies, null, 2));

    // 3. Check Contacts Counts per Company
    const { data: contactCounts } = await supabaseAdmin.from('contacts').select('company_id, assigned_to');
    console.log("\nContacts Row Sample:", JSON.stringify(contactCounts?.slice(0, 5), null, 2));
    console.log("Total Contacts:", contactCounts?.length);

    // 4. Check Deals
    const { data: deals } = await supabaseAdmin.from('deals').select('company_id, assigned_to, created_at');
    console.log("\nDeals Sample:", JSON.stringify(deals?.slice(0, 5), null, 2));
    console.log("Total Deals:", deals?.length);

    // 5. Check Conversations
    const { data: convs } = await supabaseAdmin.from('conversations').select('company_id, assigned_to');
    console.log("\nConversations Total:", convs?.length);
}

diagnose();
