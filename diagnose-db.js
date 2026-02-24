import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
    const emails = ['juancarevalos88888@gmail.com', 'juancarevalos@live.com'];

    console.log('--- DIAGNOSIS START ---');

    for (const email of emails) {
        console.log(`\nChecking: ${email}`);

        // Check Auth
        const { data: { users }, error: authError } = await supabase.auth.admin.listUsers();
        const authUser = users.find(u => u.email === email);

        if (authUser) {
            console.log('Auth Metadata:', JSON.stringify(authUser.user_metadata, null, 2));
        } else {
            console.log('Auth: NOT FOUND');
        }

        // Check Profile
        const { data: profile, error: profileError } = await supabase
            .from('profiles')
            .select('*')
            .eq('email', email)
            .maybeSingle();

        if (profile) {
            console.log('Profile Table:', JSON.stringify(profile, null, 2));
        } else {
            console.log('Profile Table: NOT FOUND');
        }
    }

    console.log('\n--- DIAGNOSIS END ---');
}

diagnose();
