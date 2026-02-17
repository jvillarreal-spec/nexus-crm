
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkUsers() {
    const { data: profiles, error } = await supabaseAdmin
        .from('profiles')
        .select('email, role');

    if (error) {
        console.error('Error:', error);
        return;
    }
    console.log('--- Current Profiles ---');
    console.table(profiles);
}

checkUsers();
