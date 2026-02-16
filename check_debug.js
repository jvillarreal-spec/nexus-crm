
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load env from .env.local
dotenv.config({ path: path.resolve(__dirname, '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase environment variables');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkContact(contactId) {
    const { data, error } = await supabase
        .from('contacts')
        .select('*')
        .eq('id', contactId)
        .single();

    if (error) {
        console.error('Error:', error);
        return;
    }

    console.log('--- CONTACT DATA ---');
    console.log('ID:', data.id);
    console.log('First Name:', data.first_name);
    console.log('Phone:', data.phone);
    console.log('Metadata:', JSON.stringify(data.metadata, null, 2));
}

const targetContactId = '0ded88a8-a40f-44b4-9e47-0d1eccfef200';
checkContact(targetContactId);
