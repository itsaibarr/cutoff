import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface SystemSnapshot {
    system_state: string;
    total_captures: number;
    open_loops: number;
    shadowed_count: number;
}

export async function syncSystemState(sessionId: string, snapshot: SystemSnapshot) {
    if (!supabaseUrl || !supabaseAnonKey) {
        return;
    }

    try {
        // 1. Get or Create Profile
        const { data: profile } = await supabase
            .from('profiles')
            .select('id')
            .eq('session_id', sessionId)
            .single();

        let profileId = profile?.id;

        if (!profileId) {
            const { data: newProfile } = await supabase
                .from('profiles')
                .insert({ session_id: sessionId })
                .select('id')
                .single();
            profileId = newProfile?.id;
        }

        if (!profileId) return;

        // 2. Upsert Current State
        await supabase
            .from('system_current')
            .upsert({
                profile_id: profileId,
                system_state: snapshot.system_state,
                total_captures: snapshot.total_captures,
                open_loops: snapshot.open_loops,
                shadowed_count: snapshot.shadowed_count,
                last_updated: new Date().toISOString()
            });

        // 3. Record Snapshot (Optional: Throttled by caller)
        await supabase
            .from('system_snapshots')
            .insert({
                profile_id: profileId,
                system_state: snapshot.system_state,
                total_captures: snapshot.total_captures,
                open_loops: snapshot.open_loops
            });

    } catch (e) {
        console.error('Supabase Sync Error:', e);
    }
}
