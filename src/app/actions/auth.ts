'use server';

import { createClient } from '@/lib/supabase/server';

export async function updatePassword(newPassword: string) {
    try {
        const supabase = await createClient();

        const { error } = await supabase.auth.updateUser({
            password: newPassword,
            data: { new_account: false } // Clear the force-change flag
        });

        if (error) throw error;

        return { success: true };
    } catch (error: any) {
        console.error('Error updating password:', error);
        return { success: false, error: error.message };
    }
}
