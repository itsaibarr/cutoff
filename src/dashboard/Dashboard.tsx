import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import styles from './Dashboard.module.css';
import { Activity, BarChart3, Wind, Lock } from 'lucide-react';
import clsx from 'clsx';

interface SystemCurrent {
    system_state: string;
    total_captures: number;
    open_loops: number;
    shadowed_count: number;
    profile_id: string;
}

interface SnapshotRecord {
    id: string;
    system_state: string;
    total_captures: number;
    open_loops: number;
    recorded_at: string;
}

export default function Dashboard() {
    const [systemData, setSystemData] = useState<SystemCurrent | null>(null);
    const [snapshots, setSnapshots] = useState<SnapshotRecord[]>([]);
    const [sessionId, setSessionId] = useState<string | null>(localStorage.getItem('cutoff_session_id'));
    const [profileId, setProfileId] = useState<string | null>(null);
    const [loading, setLoading] = useState(!!sessionId);

    useEffect(() => {
        // Listen for storage events from other extension tabs (SidePanel/Popup)
        const handleStorageChange = (e: StorageEvent) => {
            if (e.key === 'cutoff_session_id') {
                if (e.newValue) {
                    setSessionId(e.newValue);
                    setLoading(true);
                } else {
                    // If session ID is cleared, reset state
                    setSessionId(null);
                    setSystemData(null);
                    setSnapshots([]);
                    setLoading(false);
                }
            }
        };
        window.addEventListener('storage', handleStorageChange);
        return () => window.removeEventListener('storage', handleStorageChange);
    }, []);

    // 1. Fetch Profile when Session ID changes
    useEffect(() => {
        let ignore = false;
        async function fetchProfile() {
            if (!sessionId) {
                if (!ignore) setProfileId(null);
                return;
            }

            const { data } = await supabase
                .from('profiles')
                .select('id')
                .eq('session_id', sessionId)
                .single();

            if (!ignore && data) {
                setProfileId(data.id);
            } else if (!ignore && !data) {
                setLoading(false);
            }
        }
        fetchProfile();
        return () => { ignore = true; };
    }, [sessionId]);

    // 2. Fetch Data & Subscribe when Profile ID is available
    useEffect(() => {
        if (!profileId) {
            return;
        }

        let ignore = false;

        async function fetchData() {
            // 2. Get Current State
            const { data: current } = await supabase
                .from('system_current')
                .select('*')
                .eq('profile_id', profileId)
                .single();

            if (!ignore) {
                setSystemData(current);
            }

            // 3. Get Snapshots
            const { data: history } = await supabase
                .from('system_snapshots')
                .select('*')
                .eq('profile_id', profileId)
                .order('recorded_at', { ascending: false })
                .limit(20);

            if (!ignore) {
                setSnapshots(history || []);
                setLoading(false);
            }
        }

        fetchData();

        // Subscribe to real-time updates for this profile
        const channel = supabase
            .channel(`system_mirror_${profileId}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'system_current',
                filter: `profile_id=eq.${profileId}`
            }, (payload) => {
                const newData = payload.new as SystemCurrent;
                if (!ignore && newData) {
                    setSystemData(newData);
                }
            })
            .subscribe();

        return () => {
            ignore = true;
            supabase.removeChannel(channel);
        };
    }, [profileId]);

    const ReflectionContent = useMemo(() => {
        if (!systemData) return "Mirror offline. Connect the extension to reflect.";

        const state = systemData.system_state;
        switch (state) {
            case 'void': return "The void is pristine. No weight, no friction. A state of pure potential.";
            case 'stable': return "Nominal rhythm. Loops are balanced. The system is breathing.";
            case 'turbulent': return "Accumulation detected. Open loops are creating friction. Awareness required.";
            case 'critical': return "System overload. Critical tension. Clarity is compromised. Execute or Discard immediately.";
            case 'focused': return "Single-point focus active. The mirror is calm. Boundaries are enforced.";
            case 'deferred': return "Hidden tension. Shadowed items are silently waiting. The load is deferred, not resolved.";
            default: return "System state is abstract.";
        }
    }, [systemData]);

    if (loading) return <div className={styles.loading}>Connecting to Mirror...</div>;

    if (!sessionId || !systemData) {
        return (
            <div className={styles.noConnection}>
                <div className={styles.visual}>
                    <Lock size={48} />
                </div>
                <h1>System Mirror Offline</h1>
                <p>Ensure the Cutoff extension is active and configured.</p>
                <div className={styles.hint}>Actions are performed in the extension. This is a read-only mirror.</div>
            </div>
        );
    }

    return (
        <div className={clsx(styles.container, styles[`state_${systemData.system_state}`])}>
            <header className={styles.header}>
                <h1 className={styles.brand}>CUTOFF // DASHBOARD</h1>
                <div className={styles.status} aria-live="polite">
                    <Activity size={14} className={styles.pulse} aria-label="Active Sync" />
                    LIVE SYNC ACTIVE
                </div>
            </header>

            <main className={styles.grid}>
                {/* 1. OVERVIEW */}
                <section className={styles.overview}>
                    <div className={styles.label}>SYSTEM STATE</div>
                    <div className={styles.stateDisplay}>
                        {systemData.system_state.toUpperCase()}
                    </div>
                    <div className={styles.reflection}>
                        <Wind size={16} aria-label="Atmospheric Feedback" />
                        {ReflectionContent}
                    </div>
                </section>

                {/* 2. METRICS */}
                <section className={styles.metrics}>
                    <div className={styles.metricCard}>
                        <div className={styles.mValue}>{systemData.total_captures}</div>
                        <div className={styles.mLabel}>TOTAL CAPTURES</div>
                    </div>
                    <div className={styles.metricCard}>
                        <div className={styles.mValue}>{systemData.open_loops}</div>
                        <div className={styles.mLabel}>OPEN LOOPS</div>
                    </div>
                    <div className={styles.metricCard}>
                        <div className={styles.mValue}>
                            {((systemData.open_loops / (systemData.total_captures || 1)) * 100).toFixed(0)}%
                        </div>
                        <div className={styles.mLabel}>LOAD INDEX</div>
                    </div>
                </section>

                {/* 3. DYNAMICS VIEW */}
                <section className={styles.dynamics}>
                    <div className={styles.label}>
                        <BarChart3 size={14} aria-label="Dynamics Chart" /> DYNAMICS VIEW
                    </div>
                    <div className={styles.chartArea}>
                        {snapshots.map((s, i) => (
                            <div
                                key={s.id}
                                className={clsx(styles.bar, styles[`bar_${s.system_state}`])}
                                style={{
                                    height: `${Math.min(100, (s.open_loops / 15) * 100)}%`,
                                    opacity: 1 - (i * 0.05)
                                }}
                            ></div>
                        ))}
                    </div>
                </section>
            </main>

            <footer className={styles.footer}>
                <div className={styles.note}>
                    Read-only visualization. Decision making occurs strictly within the extension.
                </div>
                <div className={styles.primaryCtaArea}>
                    <a href="https://github.com/itsaibarr/cutoff" target="_blank" className={styles.ctaLink}>
                        SYSTEM DOCUMENTATION
                    </a>
                </div>
            </footer>
        </div>
    );
}
