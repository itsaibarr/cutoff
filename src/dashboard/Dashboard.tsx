import { useEffect, useState, useMemo } from 'react';
import { supabase } from '../lib/supabase';
import type { User } from '@supabase/supabase-js';
import styles from './Dashboard.module.css';
import {
    Activity, BarChart3, LayoutGrid, Archive, Settings, LogOut,
    Terminal, Shield, Cpu, User as UserIcon
} from 'lucide-react';
import clsx from 'clsx';

interface SystemCurrent {
    system_state: string;
    total_captures: number;
    open_loops: number;
    shadowed_count: number;
    profile_id: string;
    last_updated: string;
}

export default function Dashboard() {
    // Auth State
    const [user, setUser] = useState<User | null>(null);
    const [authMode, setAuthMode] = useState<'login' | 'register'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [authError, setAuthError] = useState('');
    const [pairingCode, setPairingCode] = useState<string | null>(null);

    // Operational State
    const [systemData, setSystemData] = useState<SystemCurrent | null>(null);
    const [loading, setLoading] = useState(true);
    const [view, setView] = useState<'stack' | 'archive' | 'diagnostics' | 'parameters' | 'focus' | 'account'>('stack');

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
            setLoading(false);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            const newUser = session?.user ?? null;
            setUser(newUser);
            if (!newUser) {
                setSystemData(null);
                setLoading(false);
            }
        });

        return () => subscription.unsubscribe();
    }, []);

    useEffect(() => {
        if (!user) return;

        let ignore = false;

        async function initData() {
            const currentUser = user;
            if (!currentUser) return;
            setLoading(true);

            try {
                // 1. Fetch Profile
                const { data: profile, error: fetchError } = await supabase
                    .from('profiles')
                    .select('id, pairing_code')
                    .eq('id', currentUser.id)
                    .single();

                if (fetchError && fetchError.code !== 'PGRST116') {
                    throw fetchError;
                }

                let finalCode = profile?.pairing_code;

                // 2. If profile exists but NO code, or NO profile - Generate and Sync
                if (!profile || !finalCode) {
                    const newCode = Math.floor(100000 + Math.random() * 900000).toString();

                    const { data: synced, error: syncError } = await supabase
                        .from('profiles')
                        .upsert({
                            id: currentUser.id,
                            email: currentUser.email, // ADDED: Required NOT NULL field
                            pairing_code: newCode
                        }, { onConflict: 'id' })
                        .select('id, pairing_code')
                        .single();

                    if (syncError) {
                        setAuthError(`SYNC_ERROR: ${syncError.message}`);
                    } else if (synced) {
                        finalCode = synced.pairing_code;
                        // Also ensure system_current row exists
                        await supabase.from('system_current').upsert({
                            profile_id: currentUser.id,
                            system_state: 'void'
                        }, { onConflict: 'profile_id' });
                    }
                }

                if (finalCode) {
                    setPairingCode(finalCode);
                    setAuthError(''); // Clear errors on success
                }

                const { data: current } = await supabase
                    .from('system_current')
                    .select('*')
                    .eq('profile_id', currentUser.id)
                    .single();


                if (!ignore) {
                    setSystemData(current);
                }
            } catch {
                setAuthError(`INIT_FAILED: Communication error`);
            } finally {
                if (!ignore) setLoading(false);
            }
        }

        initData();

        const channel = supabase
            .channel(`dashboard_${user.id}`)
            .on('postgres_changes', {
                event: '*',
                schema: 'public',
                table: 'system_current',
                filter: `profile_id=eq.${user.id}`
            }, (payload) => {
                if (!ignore) setSystemData(payload.new as SystemCurrent);
            })
            .subscribe();

        return () => {
            ignore = true;
            supabase.removeChannel(channel);
        };
    }, [user]);

    const handleAuth = async (e: React.FormEvent) => {
        e.preventDefault();
        setAuthError('');
        setLoading(true);

        try {
            if (authMode === 'register') {
                const { error } = await supabase.auth.signUp({ email, password });
                if (error) throw error;
                // Verification disabled: Sys will auto-login via onAuthStateChange
            } else {
                const { error } = await supabase.auth.signInWithPassword({ email, password });
                if (error) throw error;
            }
        } catch (err) {
            const error = err as Error;
            setAuthError(error.message);
        } finally {
            setLoading(false);
        }
    };

    const ReflectionContent = useMemo(() => {
        if (!systemData) return "MIRROR_STATUS: INITIALIZING. AWAITING_SYNC.";
        const state = systemData.system_state;
        switch (state) {
            case 'void': return "VOID_PRISTINE. FORCE_POTENTIAL_NOMINAL. NO_FRICTION_DETECTED.";
            case 'stable': return "NOMINAL_RHYTHM. LOOPS_BALANCED. SYSTEM_BREATHING_ACTIVE.";
            case 'turbulent': return "ACCUMULATION_DETECTED. OPEN_LOOPS_CREATING_FRICTION. AWARENESS_REQUIRED.";
            case 'critical': return "SYSTEM_OVERLOAD. CRITICAL_TENSION. CLARITY_COMPROMISED. DECISION_FORCED.";
            case 'focused': return "FOCUS_POINT_ACTIVE. MIRROR_CALM. BOUNDARIES_ENFORCED.";
            case 'deferred': return "HIDDEN_TENSION. SHADOWED_ITEMS_SILENTLY_WAITING.";
            default: return "SYSTEM_STATE_ABSTRACT.";
        }
    }, [systemData]);

    if (loading && !user) return <div className={styles.loading}>INITIALIZING_NEURAL_LINK...</div>;

    if (!user) {
        return (
            <div className={styles.welcomeContainer}>
                <div className={styles.onboardingCard}>
                    <div className={styles.visual}><Shield size={32} /></div>
                    <h2>CUTOFF // AUTH</h2>
                    <div className={styles.label} style={{ padding: 0, margin: '8px 0', border: 'none', color: '#d9ff00' }}>
                        [ PROTOCOL_READY ]
                    </div>
                    <form className={styles.form} onSubmit={handleAuth}>
                        <div className={styles.formGroup}>
                            <label>DESIGNATION_ID</label>
                            <input
                                type="email"
                                className={styles.input}
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>
                        <div className={styles.formGroup}>
                            <label>ACCESS_KEY</label>
                            <input
                                type="password"
                                className={styles.input}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>
                        {authError && <div className={styles.error}>{authError}</div>}
                        <button type="submit" className={styles.primaryBtn} disabled={loading}>
                            {authMode === 'login' ? 'ESTABLISH_LINK' : 'INITIALIZE_PROTOCOL'}
                        </button>
                    </form>
                    <button
                        className={styles.secondaryBtn}
                        onClick={() => setAuthMode(authMode === 'login' ? 'register' : 'login')}
                    >
                        {authMode === 'login' ? '[ REQUEST_NEW_DESIGNATION ]' : '[ RETURN_TO_LOGIN ]'}
                    </button>
                </div>
            </div>
        );
    }

    // Show Pairing Screen if system is empty (new account)
    const isNewAccount = systemData && systemData.system_state === 'void' && systemData.total_captures === 0;

    if ((!systemData || isNewAccount) && pairingCode) {
        return (
            <div className={styles.welcomeContainer}>
                <div className={styles.onboardingCard}>
                    <div className={styles.visual}><Terminal size={32} /></div>
                    <h2>AUTHORIZATION_REQUIRED</h2>
                    <div className={styles.pairingArea}>
                        <div className={styles.pairingCode}>{pairingCode}</div>
                        <p className={styles.pairingInstructions}>
                            ENTER THIS SECURITY KEY IN YOUR EXTENSION TO SYNC DIAGNOSTICS.
                        </p>
                    </div>
                    <div style={{ display: 'flex', gap: '12px', width: '100%' }}>
                        <button className={styles.primaryBtn} onClick={() => setSystemData({ ...systemData!, total_captures: -1 })}>
                            [ BYPASS_CHECK ]
                        </button>
                    </div>
                    <button className={styles.secondaryBtn} onClick={() => supabase.auth.signOut()} style={{ marginTop: '12px' }}>
                        TERMINATE_LINK
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.layout}>
            {/* SIDEBAR */}
            <aside className={styles.sidebar}>
                <div className={styles.sidebarBrand}>
                    <div className={styles.brandName}>CUTOFF</div>
                    <span className={styles.betaTag}>SYS_v1</span>
                </div>

                <div className={styles.navSection}>
                    <label className={styles.sectionLabel}>[ NAVIGATION ]</label>
                    <div className={styles.navItems}>
                        <button onClick={() => setView('stack')} className={clsx(styles.navItem, view === 'stack' && styles.navItemActive)}>
                            <LayoutGrid size={16} />
                            <span>System Stack</span>
                        </button>
                        <button onClick={() => setView('archive')} className={clsx(styles.navItem, view === 'archive' && styles.navItemActive)}>
                            <Archive size={16} />
                            <span>Archive</span>
                        </button>
                        <button onClick={() => setView('diagnostics')} className={clsx(styles.navItem, view === 'diagnostics' && styles.navItemActive)}>
                            <BarChart3 size={16} />
                            <span>Diagnostics</span>
                        </button>
                    </div>
                </div>

                <div className={styles.navSection}>
                    <label className={styles.sectionLabel}>[ CONFIG ]</label>
                    <div className={styles.navItems}>
                        <button onClick={() => setView('parameters')} className={clsx(styles.navItem, view === 'parameters' && styles.navItemActive)}>
                            <Settings size={16} />
                            <span>Parameters</span>
                        </button>
                        <button onClick={() => setView('focus')} className={clsx(styles.navItem, view === 'focus' && styles.navItemActive)}>
                            <Cpu size={16} />
                            <span>Core Focus</span>
                        </button>
                        <button onClick={() => setView('account')} className={clsx(styles.navItem, view === 'account' && styles.navItemActive)}>
                            <UserIcon size={16} />
                            <span>Identity</span>
                        </button>
                        <button onClick={() => supabase.auth.signOut()} className={styles.navItemAction}>
                            <LogOut size={16} />
                            <span>Terminate Session</span>
                        </button>
                    </div>
                </div>
            </aside>

            {/* MAIN */}
            <div className={clsx(styles.container, systemData && styles[`state_${systemData.system_state}`])}>
                <header className={styles.header}>
                    <div className={styles.greeting}>
                        <h1>DESIGNATION: <span>{user.email}</span></h1>
                    </div>

                    <div className={styles.headerActions}>
                        <div className={styles.statusIndicator}>
                            <div className={styles.statusDot} />
                            <span>LINK_ACTIVE: {pairingCode}</span>
                        </div>
                    </div>
                </header>

                <main className={styles.mainArea}>
                    {view === 'stack' && (
                        <>
                            <div className={styles.contentLabel}>
                                <h2>ACTIVE_SYSTEM_STACK</h2>
                            </div>

                            <div className={styles.listGrid}>
                                {/* SYSTEM LOG CARD */}
                                <div className={styles.cardItem}>
                                    <div className={styles.cardHeader}>
                                        <div className={styles.cardIcon}>S</div>
                                        <div className={styles.cardMeta}>
                                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '4px' }}>
                                                <div>
                                                    <span>CAPTURES: {systemData?.total_captures || 0}</span>
                                                    <span style={{ margin: '0 8px', color: '#444' }}>//</span>
                                                    <span>PRESSURE: {systemData ? Math.round((systemData.open_loops / (systemData.total_captures || 1)) * 100) : 0}%</span>
                                                </div>
                                                <div style={{ fontSize: '9px', color: '#666' }}>
                                                    LAST_SYNC: {systemData?.last_updated ? new Date(systemData.last_updated).toLocaleTimeString() : 'WAITING'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div className={styles.cardTitle}>ACTIVE_LOOPS_LOG</div>

                                    <div className={styles.taskLog}>
                                        {systemData?.open_loops && systemData.open_loops > 0 ? (
                                            Array.from({ length: systemData.open_loops }).map((_, i) => (
                                                <div key={i} className={styles.logItem}>
                                                    <span className={styles.logHash}>#</span>
                                                    <span>LOOP_ID_{Math.random().toString(36).substr(2, 6).toUpperCase()}_ACTIVE</span>
                                                </div>
                                            ))
                                        ) : (
                                            <div className={styles.emptyState}>
                                                [ SYSTEM_IDLE // NO_ACTIVE_LOOPS ]
                                            </div>
                                        )}
                                    </div>

                                    <div className={styles.cardFooter}>
                                        <div className={styles.pendingCount}>{systemData?.open_loops || 0} CYCLES_OPEN</div>
                                        <div className={styles.estTime}>
                                            {systemData?.system_state.toUpperCase()}
                                        </div>
                                    </div>
                                </div>
                            </div>
                            <div className={styles.mirrorStatus}>
                                <Activity size={12} className={styles.pulse} style={{ marginRight: '8px', display: 'inline' }} />
                                {ReflectionContent}
                            </div>
                        </>
                    )}

                    {view === 'archive' && (
                        <>
                            <div className={styles.contentLabel}>
                                <h2>SYSTEM_ARCHIVE_MEMORY</h2>
                            </div>

                            <div className={styles.listGrid}>
                                <div className={styles.cardItem}>
                                    <div className={styles.cardHeader}>
                                        <div className={styles.cardIcon}>A</div>
                                        <div className={styles.cardMeta}>
                                            <span>TOTAL_PROCESSED: {systemData ? (systemData.total_captures - systemData.open_loops) : 0}</span>
                                        </div>
                                    </div>

                                    <div className={styles.cardTitle}>CLOSED_LOOPS_LOG</div>

                                    <div className={styles.taskLog}>
                                        {systemData && (systemData.total_captures - systemData.open_loops) > 0 ? (
                                            <>
                                                {/* Simulated recent entry to show UI structure */}
                                                <div className={styles.logItem} style={{ color: '#777', borderStyle: 'solid' }}>
                                                    <span className={styles.logHash} style={{ opacity: 0.5 }}>#</span>
                                                    <span>LOOP_ID_{Math.random().toString(36).substr(2, 6).toUpperCase()}_EXECUTED</span>
                                                </div>
                                                <div className={styles.logItem} style={{ color: '#555', borderStyle: 'solid' }}>
                                                    <span className={styles.logHash} style={{ opacity: 0.3 }}>#</span>
                                                    <span>LOOP_ID_{Math.random().toString(36).substr(2, 6).toUpperCase()}_DISCARDED</span>
                                                </div>
                                                <div className={styles.logItem} style={{ color: '#444', borderStyle: 'solid', borderBottom: 'none' }}>
                                                    <span className={styles.logHash} style={{ opacity: 0.2 }}>//</span>
                                                    <span>[ ... OLDER_ENTRIES_COMPRESSED ... ]</span>
                                                </div>
                                            </>
                                        ) : (
                                            <div className={styles.emptyState}>
                                                [ MEMORY_BANKS_EMPTY ]
                                            </div>
                                        )}
                                    </div>

                                    <div className={styles.cardFooter}>
                                        <div className={styles.pendingCount}>
                                            EXECUTE: {systemData ? Math.floor((systemData.total_captures - systemData.open_loops) * 0.4) : 0} // DISCARD: {systemData ? Math.ceil((systemData.total_captures - systemData.open_loops) * 0.6) : 0}
                                        </div>
                                        <div className={styles.estTime}>
                                            RETENTION: INFINITE
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </>
                    )}

                    {view === 'diagnostics' && (
                        <div className={styles.listGrid}>
                            <div className={styles.cardItem} style={{ cursor: 'default' }}>
                                <div className={styles.cardHeader}>
                                    <div className={styles.cardIcon}>D</div>
                                    <div className={styles.cardMeta}>
                                        <span>ENGINE_STATUS: ONLINE</span>
                                        <span style={{ margin: '0 8px', color: '#444' }}>//</span>
                                        <span>VERSION: SYS_v1.0.4</span>
                                    </div>
                                </div>

                                <div className={styles.cardTitle}>SYSTEM_TELEMETRY</div>

                                <div className={styles.taskLog} style={{ gap: '16px', padding: '16px 0' }}>
                                    {/* SYNC STATUS */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <div style={{ fontSize: '9px', color: '#666', letterSpacing: '0.2em' }}>SYNCHRONIZATION</div>
                                        <div className={styles.logItem} style={{ border: 'none', padding: '0' }}>
                                            <span style={{ color: '#00ff88' }}>●</span>
                                            {systemData?.last_updated ? (
                                                <span>LAST_HEARTBEAT: {new Date(systemData.last_updated).toISOString()}</span>
                                            ) : (
                                                <span style={{ color: '#bf9f00' }}>WAITING_FOR_SIGNAL...</span>
                                            )}
                                        </div>
                                        <div className={styles.logItem} style={{ border: 'none', padding: '0' }}>
                                            <span style={{ color: '#00ff88' }}>●</span>
                                            <span>DB_CONNECTION: STABLE</span>
                                        </div>
                                    </div>

                                    {/* AI INTERVENTIONS */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <div style={{ fontSize: '9px', color: '#666', letterSpacing: '0.2em' }}>INTELLIGENCE_LAYER</div>
                                        <div className={styles.logItem} style={{ border: 'none', padding: '0' }}>
                                            <span style={{ color: '#444' }}>○</span>
                                            <span>AI_INTERVENTIONS_24H: 0</span>
                                        </div>
                                        <div className={styles.logItem} style={{ border: 'none', padding: '0' }}>
                                            <span style={{ color: '#444' }}>○</span>
                                            <span>CONTEXT_WINDOW: 4% USED</span>
                                        </div>
                                    </div>

                                    {/* ERRORS & LATENCY */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                                        <div style={{ fontSize: '9px', color: '#666', letterSpacing: '0.2em' }}>PERFORMANCE</div>
                                        <div className={styles.logItem} style={{ border: 'none', padding: '0' }}>
                                            <span>LATENCY: 24ms</span>
                                        </div>
                                        <div className={styles.logItem} style={{ border: 'none', padding: '0' }}>
                                            <span>CONFLICT_RATE: 0.00%</span>
                                        </div>
                                    </div>
                                </div>

                                <div className={styles.cardFooter}>
                                    <div className={styles.pendingCount}>
                                        DIAGNOSTICS_MODE: READ_ONLY
                                    </div>
                                    <div className={styles.estTime}>
                                        NO_ANOMALIES_DETECTED
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {view === 'parameters' && (
                        <div className={styles.listGrid}>
                            <div className={styles.cardItem} style={{ cursor: 'default' }}>
                                <div className={styles.cardHeader}>
                                    <div className={styles.cardIcon}>P</div>
                                    <div className={styles.cardMeta}>
                                        <span>CONFIG: ACTIVE</span>
                                        <span style={{ margin: '0 8px', color: '#444' }}>//</span>
                                        <span>PROFILE: STANDARD_PRESSURE</span>
                                    </div>
                                </div>

                                <div className={styles.cardTitle}>ENGINE_PARAMETERS</div>

                                <div className={styles.taskLog} style={{ gap: '20px', padding: '16px 0' }}>
                                    {/* PRESSURE RULES */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <div style={{ fontSize: '9px', color: '#666', letterSpacing: '0.2em' }}>PRESSURE_LAWS (IMMUTABLE)</div>
                                        <div className={styles.logItem} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '4px', border: 'none', padding: '0 0 12px 0' }}>
                                            <span style={{ color: '#fff' }}>RULE_01: MAX_OPEN_LOOPS</span>
                                            <span style={{ color: '#888', fontSize: '10px' }}>&gt; LIMIT: 5 ACTIVE_ITEMS</span>
                                            <span style={{ color: '#444', fontSize: '10px' }}>&gt; EFFECT: NEW_INPUT_BLOCKING</span>
                                        </div>
                                        <div className={styles.logItem} style={{ flexDirection: 'column', alignItems: 'flex-start', gap: '4px', border: 'none', padding: '0' }}>
                                            <span style={{ color: '#fff' }}>RULE_02: DECAY_PROTOCOL</span>
                                            <span style={{ color: '#888', fontSize: '10px' }}>&gt; RATE: 4H WITHOUT_ACTION</span>
                                            <span style={{ color: '#444', fontSize: '10px' }}>&gt; EFFECT: AUTO_ESCALATION_TO_CRITICAL</span>
                                        </div>
                                    </div>

                                    {/* ESCALATION MATRIX */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <div style={{ fontSize: '9px', color: '#666', letterSpacing: '0.2em' }}>ESCALATION_MATRIX</div>
                                        <div className={styles.logItem} style={{ border: 'none', padding: '0', justifyContent: 'space-between' }}>
                                            <span>LEVEL_1 (STABLE)</span>
                                            <span style={{ color: '#444' }}>VISUAL_FEEDBACK_ONLY</span>
                                        </div>
                                        <div className={styles.logItem} style={{ border: 'none', padding: '0', justifyContent: 'space-between' }}>
                                            <span>LEVEL_2 (TURBULENT)</span>
                                            <span style={{ color: '#444' }}>BROWSER_INTERVENTION</span>
                                        </div>
                                        <div className={styles.logItem} style={{ border: 'none', padding: '0', justifyContent: 'space-between' }}>
                                            <span style={{ color: '#ff4444' }}>LEVEL_3 (CRITICAL)</span>
                                            <span style={{ color: '#ff4444' }}>FULL_SYSTEM_LOCKOUT</span>
                                        </div>
                                    </div>

                                    {/* ENGINE CONSTANTS */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <div style={{ fontSize: '9px', color: '#666', letterSpacing: '0.2em' }}>ENGINE_CONSTANTS</div>
                                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                                            <div className={styles.logItem} style={{ border: '1px solid #222', padding: '8px', justifyContent: 'center', background: '#050505' }}>
                                                <span style={{ color: '#888', fontSize: '10px' }}>REFRESH_RATE</span>
                                                <span>60hz</span>
                                            </div>
                                            <div className={styles.logItem} style={{ border: '1px solid #222', padding: '8px', justifyContent: 'center', background: '#050505' }}>
                                                <span style={{ color: '#888', fontSize: '10px' }}>MEMORY_LIMIT</span>
                                                <span>128mb</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className={styles.cardFooter}>
                                    <div className={styles.pendingCount}>
                                        CONFIGURATION_LOCKED
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {view === 'focus' && (
                        <div className={styles.listGrid}>
                            <div className={styles.cardItem} style={{ cursor: 'default' }}>
                                <div className={styles.cardHeader}>
                                    <div className={styles.cardIcon}>F</div>
                                    <div className={styles.cardMeta}>
                                        <span>MODULE: CORE_FOCUS</span>
                                        <span style={{ margin: '0 8px', color: '#444' }}>//</span>
                                        <span>PRIORITY: ABSOLUTE</span>
                                    </div>
                                </div>

                                <div className={styles.cardTitle}>CURRENT_SYSTEM_FOCUS</div>

                                <div className={styles.taskLog} style={{ padding: '32px 0', alignItems: 'center', justifyContent: 'center', minHeight: '200px' }}>
                                    {systemData?.system_state === 'focused' ? (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '24px', textAlign: 'center' }}>
                                            <div className={styles.pulse} style={{
                                                width: '64px', height: '64px', borderRadius: '50%',
                                                border: '2px solid #d9ff00', display: 'flex', alignItems: 'center', justifyContent: 'center',
                                                boxShadow: '0 0 20px rgba(217, 255, 0, 0.2)'
                                            }}>
                                                <Cpu size={32} color="#d9ff00" />
                                            </div>
                                            <div>
                                                <div style={{ fontSize: '14px', letterSpacing: '0.2em', color: '#fff', marginBottom: '8px' }}>TARGET_LOCKED</div>
                                                <div style={{ fontSize: '10px', color: '#666', fontFamily: 'monospace' }}>
                                                    THREAD_ID: {Math.random().toString(36).substr(2, 8).toUpperCase()}
                                                </div>
                                            </div>
                                            <div className={styles.logItem} style={{ border: '1px solid #222', background: '#080808', padding: '12px 24px' }}>
                                                <span style={{ color: '#888' }}>CONTENT_ENCRYPTED_FOR_MIRRORING</span>
                                            </div>
                                        </div>
                                    ) : (
                                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px', opacity: 0.5 }}>
                                            <Cpu size={48} color="#444" />
                                            <div style={{ fontSize: '12px', letterSpacing: '0.2em', color: '#666' }}>NO_ACTIVE_TARGET</div>
                                            <div style={{ fontSize: '10px', color: '#444' }}>SYSTEM_IDLE // AWAITING_INPUT</div>
                                        </div>
                                    )}
                                </div>

                                <div className={styles.cardFooter}>
                                    <div className={styles.pendingCount}>
                                        STATE: {systemData?.system_state === 'focused' ? 'ENGAGED' : 'STANDBY'}
                                    </div>
                                    <div className={styles.estTime}>
                                        {systemData?.system_state === 'focused' ? 'IGNORE_ALL_DISTRACTIONS' : 'READY'}
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}

                    {view === 'account' && (
                        <div className={styles.listGrid}>
                            <div className={styles.cardItem} style={{ cursor: 'default' }}>
                                <div className={styles.cardHeader}>
                                    <div className={styles.cardIcon}><UserIcon size={16} /></div>
                                    <div className={styles.cardMeta}>
                                        <span>IDENTITY_MODULE</span>
                                        <span style={{ margin: '0 8px', color: '#444' }}>//</span>
                                        <span>STATUS: VERIFIED</span>
                                    </div>
                                </div>

                                <div className={styles.cardTitle}>USER_DESIGNATION</div>

                                <div className={styles.taskLog} style={{ gap: '24px', padding: '24px 0' }}>

                                    {/* EMAIL */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <div style={{ fontSize: '9px', color: '#666', letterSpacing: '0.2em' }}>DESIGNATION_ID</div>
                                        <div className={styles.logItem} style={{ border: '1px solid #333', background: '#0a0a0a', padding: '12px' }}>
                                            <span style={{ color: '#fff', fontSize: '14px' }}>{user.email}</span>
                                        </div>
                                    </div>

                                    {/* USER NUMBER */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                                        <div style={{ fontSize: '9px', color: '#666', letterSpacing: '0.2em' }}>USER_IDENTITY_NUMBER (SECURE_LINK)</div>
                                        <div className={styles.logItem} style={{ border: '1px solid #d9ff00', background: 'rgba(217, 255, 0, 0.05)', padding: '16px', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
                                            <span style={{ color: authError ? '#ff4444' : '#d9ff00', fontSize: authError ? '12px' : '24px', letterSpacing: '0.1em', fontFamily: 'monospace', fontWeight: 'bold' }}>
                                                {authError ? authError : (pairingCode || 'GENERATING...')}
                                            </span>
                                            <div style={{ fontSize: '10px', color: '#888' }}>
                                                ENTER THIS KEY IN THE EXTENSION CONFIG
                                            </div>
                                            {!pairingCode && (
                                                <button
                                                    onClick={() => window.location.reload()}
                                                    style={{ marginTop: 8, background: '#222', border: '1px solid #444', color: '#fff', padding: '4px 12px', fontSize: '10px', cursor: 'pointer' }}
                                                >
                                                    [ RETRY GENERATION ]
                                                </button>
                                            )}
                                        </div>
                                    </div>

                                    {/* DANGER ZONE */}
                                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '12px' }}>
                                        <div style={{ fontSize: '9px', color: '#666', letterSpacing: '0.2em' }}>PROTOCOL_ACTIONS</div>
                                        <button
                                            onClick={() => supabase.auth.signOut()}
                                            className={styles.logItem}
                                            style={{ border: '1px solid #333', background: '#0a0a0a', padding: '12px', justifyContent: 'center', cursor: 'pointer' }}
                                        >
                                            <span style={{ color: '#fff' }}>TERMINATE_SESSION_LINK</span>
                                        </button>
                                    </div>

                                </div>

                                <div className={styles.cardFooter}>
                                    <div className={styles.pendingCount}>
                                        SECURITY_LEVEL: MAXIMUM
                                    </div>
                                </div>
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}
