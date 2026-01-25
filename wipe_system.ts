import { supabase } from './src/lib/supabase';
import { storage } from './src/lib/storage';

async function wipeSystem() {
    console.log('🚀 Starting System Wipe...');

    // 1. Clear Extension/Browser Storage
    try {
        await storage.remove('cutoff_session_id');
        await storage.remove('cutoff_cards');
        await storage.remove('cutoff_onboarding_complete');
        localStorage.clear();
        sessionStorage.clear();
        console.log('✅ Local storage cleared.');
    } catch (e) {
        console.error('❌ Error clearing local storage:', e);
    }

    // 2. Clear Database (Attempt via Anon Key - depends on RLS)
    try {
        // We delete from system_snapshots first due to FK constraints
        const { error: snapError } = await supabase.from('system_snapshots').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        const { error: currError } = await supabase.from('system_current').delete().neq('id', '00000000-0000-0000-0000-000000000000');
        const { error: profError } = await supabase.from('profiles').delete().neq('id', '00000000-0000-0000-0000-000000000000');

        if (snapError || currError || profError) {
            console.warn('⚠️ Manual Database Wipe Required in Supabase Dashboard:');
            console.log('TRUNCATE profiles, system_current, system_snapshots RESTART IDENTITY CASCADE;');
        } else {
            console.log('✅ Database tables cleared.');
        }
    } catch (e) {
        console.error('❌ Database wipe error:', e);
    }

    console.log('🏁 Wipe Complete. Restart the development server to begin fresh onboarding.');
}

wipeSystem();
