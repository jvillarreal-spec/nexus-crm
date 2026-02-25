const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function diagnose() {
    const email = 'juancarevalos@live.com';
    console.log('Diagnosing profile for:', email);

    // 1. Get Auth User
    const { data: { users }, error: authError } = await supabaseAdmin.auth.admin.listUsers();
    if (authError) {
        console.error('Auth Error:', authError);
        return;
    }

    const user = users.find(u => u.email === email);
    if (!user) {
        console.error('User not found in Auth');
        return;
    }

    console.log('User found in Auth:', user.id);
    console.log('User Metadata:', user.user_metadata);

    // 2. Try Manual Insert
    console.log('Attempting manual insert into profiles...');
    const { data, error } = await supabaseAdmin.from('profiles').insert({
        id: user.id,
        email: user.email,
        full_name: user.user_metadata.full_name || 'Test',
        role: 'agent',
        company_id: user.user_metadata.company_id,
        status: 'active'
    });

    if (error) {
        console.error('Insert Error:', JSON.stringify(error, null, 2));
    } else {
        console.log('Insert Success:', data);
    }
}

diagnose();
