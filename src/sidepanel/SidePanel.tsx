/// <reference types="chrome"/>
import { useEffect, useState, useMemo } from 'react';
import styles from './SidePanel.module.css';
import { useCardStore } from '../store/card-store';
import { supabase } from '../lib/supabase';
import { storage } from '../lib/storage';
import { formatTimeSince, calculateSystemState } from '../lib/types';
import type { Card, Category } from '../lib/types';
import clsx from 'clsx';
import {
    BarChart3, Clock, Sparkles, Key,
    Trash, Play, AlertTriangle, Plus
} from 'lucide-react';
import ExecuteMode from '../components/ExecuteMode';
import CaptureModal from '../components/CaptureModal';
import OnboardingGuide from '../components/OnboardingGuide';
import Atmosphere from '../components/Atmosphere';

type ConfrontationStep = 'gate' | 'reality' | 'decision';

export default function SidePanel() {
    const {
        cards,
        loadCards,
        addCard,
        startConfrontation,
        cancelConfrontation,
        executeCard,
        shadowCard,
        discardCard,
        deleteCard, // New
        startExecuteTimer,
        stopExecute,
        abortExecute,
        updateCard
    } = useCardStore();

    const [activeCardId, setActiveCardId] = useState<string | null>(null);
    const [confrontationStep, setConfrontationStep] = useState<ConfrontationStep>('gate');
    const [view, setView] = useState<'list' | 'settings'>('list');

    // Pairing State
    const [pairingCodeInput, setPairingCodeInput] = useState('');
    const [pairingStatus, setPairingStatus] = useState<{ type: 'idle' | 'loading' | 'success' | 'error', message?: string }>({ type: 'idle' });
    const [isPaired, setIsPaired] = useState(false);

    // Filtering
    const [activeFilter, setActiveFilter] = useState<string>('All');

    // New Capture State
    const [isCaptureOpen, setIsCaptureOpen] = useState(false);

    // Onboarding State
    const [showOnboarding, setShowOnboarding] = useState(false);

    // Theme State
    const [theme, setTheme] = useState<'void' | 'dark' | 'flux'>('void');
    const [accentColor, setAccentColor] = useState<string>('#d9ff00');

    useEffect(() => {
        loadCards();

        // Check onboarding status
        const checkOnboarding = async () => {
            const completed = await chrome.storage.local.get('cutoff_onboarding_complete');
            if (!completed.cutoff_onboarding_complete) {
                setShowOnboarding(true);
            }
        };
        checkOnboarding();

        // Load theme and accent
        storage.get<'void' | 'dark' | 'flux'>('cutoff_theme').then(savedTheme => {
            if (savedTheme) {
                setTheme(savedTheme);
                document.documentElement.setAttribute('data-theme', savedTheme);
            }
        });

        storage.get<string>('cutoff_accent').then(savedAccent => {
            if (savedAccent) {
                setAccentColor(savedAccent);
                applyAccent(savedAccent);
            }
        });

        // Check pairing status
        storage.get<string>('cutoff_profile_id').then(id => {
            const paired = !!id;
            setIsPaired(paired);
            if (!paired) setView('settings');
        });

        if (typeof chrome !== 'undefined' && chrome.storage) {
            const listener = () => loadCards();
            chrome.storage.onChanged.addListener(listener);
            return () => chrome.storage.onChanged.removeListener(listener);
        }
    }, [loadCards]);

    // Computed Metrics
    const systemState = useMemo(() => calculateSystemState(cards), [cards]);
    const globalCount = cards.length;
    const openLoopCount = useMemo(() =>
        cards.filter(c => ['uncommitted', 'shadowed', 'executed'].includes(c.state)).length,
        [cards]
    );

    // SYSTEM MIRROR SYNC
    useEffect(() => {
        if (!isPaired) return;

        const syncToMirror = async () => {
            try {
                const profileId = await storage.get<string>('cutoff_profile_id');
                if (!profileId) return;

                const currentState = calculateSystemState(cards);
                const totalCaptures = cards.length;
                const openLoops = cards.filter(c => ['uncommitted', 'shadowed', 'executed'].includes(c.state)).length;
                const shadowedCount = cards.filter(c => c.state === 'shadowed').length;

                await supabase
                    .from('system_current')
                    .upsert({
                        profile_id: profileId,
                        system_state: currentState,
                        total_captures: totalCaptures,
                        open_loops: openLoops,
                        shadowed_count: shadowedCount,
                        last_updated: new Date().toISOString()
                    }, { onConflict: 'profile_id' });

            } catch {
                // Ignore sync errors in background
            }
        };

        const timer = setTimeout(syncToMirror, 1000);
        return () => clearTimeout(timer);
    }, [cards, isPaired]);

    const handleOnboardingComplete = async () => {
        await chrome.storage.local.set({ 'cutoff_onboarding_complete': true });
        setShowOnboarding(false);
    };

    // Computed
    const activeCards = useMemo(() => {
        return cards.filter((c: Card) => {
            if (activeFilter === 'All') return c.state !== 'discarded';
            return c.category === activeFilter && c.state !== 'discarded';
        });
    }, [cards, activeFilter]);

    const activeCard = useMemo(() => cards.find(c => c.id === activeCardId), [cards, activeCardId]);

    const timeSinceCreation = useMemo(() =>
        activeCard ? formatTimeSince(activeCard.createdAt) : '',
        [activeCard]);

    // Handlers
    const handleCardClick = (id: string) => {
        const card = cards.find(c => c.id === id);
        if (!card) return;

        setActiveCardId(id);
        setConfrontationStep('gate');
        startConfrontation(id);
    };

    const handleDelete = async (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        if (confirm('Irreversible delete. Sure?')) {
            if (activeCardId === id) setActiveCardId(null);
            await deleteCard(id);
        }
    };

    const handleEnterConfrontation = () => {
        setConfrontationStep('reality');
        setTimeout(() => setConfrontationStep('decision'), 2500);
    };

    const handleExecute = async () => {
        if (!activeCardId) return;
        await executeCard(activeCardId);
    };

    const handleShadow = async () => {
        if (!activeCardId) return;
        await shadowCard(activeCardId);
        setActiveCardId(null);
    };

    const handleDiscard = async () => {
        if (!activeCardId) return;
        await discardCard(activeCardId);
        setActiveCardId(null);
    };

    const handleGoBack = () => {
        if (activeCardId) cancelConfrontation(activeCardId);
        setActiveCardId(null);
    };

    const handleSaveCapture = async (content: string, type: 'url' | 'text' | 'file', platform?: string, title?: string, aiSummary?: string, category?: string) => {
        await addCard(content, type, platform, title, title, aiSummary, category as Category);
    };

    const handlePairing = async () => {
        if (!pairingCodeInput) return;
        setPairingStatus({ type: 'loading' });

        try {
            // Updated to use Secure RPC to bypass RLS for anonymous extension
            const { data, error } = await supabase
                .rpc('verify_pairing_code', { input_code: pairingCodeInput.toUpperCase() });

            if (error || !data) throw new Error('Invalid code. Check your dashboard.');

            await storage.set('cutoff_profile_id', data);
            setIsPaired(true);
            setPairingStatus({ type: 'success', message: 'Successfully paired!' });
            setTimeout(() => setView('list'), 1500);
        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : 'Unknown error during pairing';
            setPairingStatus({ type: 'error', message: message });
        }
    };

    const handleThemeChange = async (newTheme: 'void' | 'dark' | 'flux') => {
        setTheme(newTheme);
        document.documentElement.setAttribute('data-theme', newTheme);
        await storage.set('cutoff_theme', newTheme);
    };

    const applyAccent = (color: string) => {
        document.documentElement.style.setProperty('--color-accent', color);
        // Create an RGBA version for the dim background
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);
        document.documentElement.style.setProperty('--color-accent-dim', `rgba(${r}, ${g}, ${b}, 0.1)`);
    };

    const handleAccentChange = async (color: string) => {
        setAccentColor(color);
        applyAccent(color);
        await storage.set('cutoff_accent', color);
    };

    // --- EXECUTE MODE ---
    if (activeCard?.state === 'executed') {
        return (
            <ExecuteMode
                card={activeCard}
                onStartTimer={() => startExecuteTimer(activeCardId!)}
                onStop={async () => {
                    await stopExecute(activeCardId!);
                    setActiveCardId(null);
                }}
                onAbort={async () => {
                    await abortExecute(activeCardId!);
                    setActiveCardId(null);
                }}
                onUpdateCard={(updates) => updateCard(activeCardId!, updates)}
            />
        );
    }

    // --- CONFRONTATION UI ---
    if (activeCardId && activeCard && activeCard.state === 'confronting') {
        return (
            <div className={styles.confrontationContainer}>
                {confrontationStep === 'gate' && (
                    <div className={styles.gate}>
                        <AlertTriangle size={48} color="var(--color-primary)" aria-label="High Tension Warning" />
                        <h1 className={styles.confrontationTitle}>WARNING</h1>
                        <p>Continuing requires a decision.<br />There is no exit.</p>
                        <button onClick={handleEnterConfrontation} className={styles.dangerButton}>
                            ENTER CONFRONTATION
                        </button>
                        <button onClick={handleGoBack} className={styles.ghostButton}>
                            Go back (the loop remains)
                        </button>
                    </div>
                )}

                {confrontationStep === 'reality' && (
                    <div className={styles.realityCheck}>
                        <h2 className={styles.confrontationTitle}>REALITY CHECK</h2>
                        <div className={styles.realityFacts}>
                            <p>You saved this <strong>{timeSinceCreation}</strong>.</p>
                            <p>In that time, nothing changed.</p>
                            {activeCard.totalConfrontations > 1 && (
                                <p>This is confrontation #{activeCard.totalConfrontations}.</p>
                            )}
                            <p className={styles.realityConclusion}>
                                The only effect was reduced anxiety.
                            </p>
                        </div>
                        <div className={styles.loader}>
                            <div className={styles.loaderBar}></div>
                        </div>
                    </div>
                )}

                {confrontationStep === 'decision' && (
                    <div className={styles.decisionMatrix}>
                        <div className={styles.sourcePreview}>
                            {activeCard.aiTitle || activeCard.extractedTitle || activeCard.sourceContent.slice(0, 80)}
                            {activeCard.category && (
                                <span className={styles.confrontationTag}>
                                    {activeCard.category}
                                </span>
                            )}
                            {activeCard.aiSummary && (
                                <div className={styles.aiSummaryPreview}>
                                    <Sparkles size={10} style={{ display: 'inline', marginRight: 4 }} aria-label="AI insight" />
                                    {activeCard.aiSummary}
                                </div>
                            )}
                        </div>

                        <div className={styles.buttons}>
                            <button onClick={handleExecute} className={styles.executeButton} aria-label="Execute Card">
                                <Play size={16} aria-hidden="true" /> EXECUTE
                                <span className={styles.buttonHint}>15 min commitment</span>
                            </button>
                            <button onClick={handleShadow} className={styles.shadowButton} aria-label="Shadow Card">
                                <Clock size={16} aria-hidden="true" /> SHADOW
                                <span className={styles.buttonHint}>Loop stays open</span>
                            </button>
                            <button onClick={handleDiscard} className={styles.discardButton} aria-label="Discard Card">
                                <Trash size={16} aria-hidden="true" /> DISCARD
                                <span className={styles.buttonHint}>Loop closed forever</span>
                            </button>
                        </div>
                    </div>
                )}
            </div>
        );
    }

    // --- MAIN LIST UI ---
    const CATEGORIES = ['All', 'Learning', 'Tool', 'Idea', 'Content', 'Reference', 'Opportunity'];

    return (
        <div className={clsx(styles.container, styles[`state_${systemState}`])}>
            <Atmosphere theme={theme} />
            {showOnboarding && <OnboardingGuide onComplete={handleOnboardingComplete} />}
            <CaptureModal
                isOpen={isCaptureOpen}
                onClose={() => setIsCaptureOpen(false)}
                onSave={handleSaveCapture}
            />

            <header className={styles.header}>
                <div className={styles.systemStatus}>
                    <span className={clsx(styles.stateIndicator, styles[systemState])}>
                        {systemState.toUpperCase()}
                    </span>
                    <a
                        href={chrome.runtime.getURL('dashboard.html')}
                        target="_blank"
                        className={styles.dashboardLink}
                        title="Open Reflection Mirror"
                        aria-label="Open System Dashboard"
                    >
                        <BarChart3 size={14} aria-hidden="true" />
                    </a>
                    <button
                        onClick={() => setView(view === 'list' ? 'settings' : 'list')}
                        className={styles.settingsToggle}
                        aria-label="Toggle Settings"
                    >
                        {view === 'list' ? <Key size={14} /> : <Sparkles size={14} />}
                    </button>
                </div>
                <div className={styles.metrics}>
                    <span className={styles.globalCount}>{globalCount}</span>
                    <span className={styles.divider}>/</span>
                    <span>{openLoopCount}</span>
                </div>
            </header>

            {/* FILTER BAR - Fixed Styling */}
            <div className={styles.filterBar}>
                {CATEGORIES.map(cat => (
                    <button
                        key={cat}
                        onClick={() => setActiveFilter(cat)}
                        className={clsx(
                            styles.filterButton,
                            activeFilter === cat && styles.filterButtonActive
                        )}
                    >
                        {cat}
                    </button>
                ))}
            </div>

            <button onClick={() => setIsCaptureOpen(true)} className={styles.addButton} aria-label="Capture new loop">
                <Plus size={14} aria-hidden="true" /> CAPTURE
            </button>

            <div className={styles.list}>
                {activeCards.length === 0 ? (
                    <div className={styles.empty}>
                        {activeFilter === 'All' ? (
                            <>
                                NO OPEN LOOPS.
                                <br />
                                SYSTEM CLEAR.
                            </>
                        ) : (
                            <>NO ITEMS IN '{activeFilter.toUpperCase()}'.</>
                        )}
                    </div>
                ) : (
                    activeCards.map(card => (
                        <div
                            key={card.id}
                            className={clsx(
                                styles.card,
                                styles[card.state],
                                card.state === 'shadowed' && styles.shadowedCard
                            )}
                            onClick={() => handleCardClick(card.id)}
                            style={{ position: 'relative' }}
                        >
                            <div className={styles.cardState}>
                                <div>
                                    {card.state === 'shadowed' ? 'SHADOW' :
                                        card.state === 'executed' ? 'EXEC' :
                                            card.sourceType === 'url' ? 'LINK' : 'TEXT'}
                                </div>
                                {card.category && (
                                    <div className={styles.categoryBadge}>{card.category}</div>
                                )}
                            </div>
                            <div className={styles.cardContent}>
                                <div className={styles.cardTitle}>
                                    {card.aiTitle || card.extractedTitle || card.sourceContent}
                                </div>

                                {card.aiSummary && (
                                    <div className={styles.cardSummary}>
                                        {card.aiSummary}
                                    </div>
                                )}
                            </div>

                            <div className={styles.cardTime}>
                                {formatTimeSince(card.createdAt)}
                            </div>

                            {/* DELETE BUTTON - Fixed */}
                            <button
                                onClick={(e) => handleDelete(e, card.id)}
                                className={styles.deleteBtn}
                                title="Delete Capture"
                                aria-label="Delete this capture permanently"
                            >
                                <Trash size={14} aria-hidden="true" />
                            </button>
                        </div>
                    ))
                )}
            </div>
            {/* SETTINGS / PAIRING OVERLAY */}
            {view === 'settings' && (
                <div className={styles.settingsOverlay}>
                    <div className={styles.settingsHeader}>
                        <h2>SYSTEM LINK</h2>
                        <button onClick={() => setView('list')} className={styles.closeBtn}>×</button>
                    </div>

                    <div className={styles.pairingSection}>
                        {isPaired ? (
                            <div className={styles.pairedStatus}>
                                <div className={styles.successIcon}>✓</div>
                                <p>ENCRYPTED_LINK_ACTIVE</p>
                                <button
                                    onClick={async () => {
                                        await storage.remove('cutoff_profile_id');
                                        setIsPaired(false);
                                    }}
                                    className={styles.unlinkBtn}
                                >
                                    TERMINATE_LINK
                                </button>
                            </div>
                        ) : (
                            <div className={styles.pairingForm}>
                                <p className={styles.pairingHint}>ENTER_USER_NUMBER_FOR_SYNC</p>
                                <input
                                    type="text"
                                    placeholder="USER_NUMBER"
                                    className={styles.pairingInput}
                                    value={pairingCodeInput}
                                    onChange={(e) => setPairingCodeInput(e.target.value.toUpperCase())}
                                />
                                {pairingStatus.message && (
                                    <div className={clsx(styles.statusMsg, styles[pairingStatus.type])}>
                                        {pairingStatus.message}
                                    </div>
                                )}
                                <button
                                    onClick={handlePairing}
                                    className={styles.pairBtn}
                                    disabled={pairingStatus.type === 'loading'}
                                >
                                    {pairingStatus.type === 'loading' ? 'INITIALIZING...' : 'ESTABLISH_LINK'}
                                </button>
                            </div>
                        )}
                    </div>

                    {/* THEME SELECTOR */}
                    <div className={styles.themeSection}>
                        <div className={styles.themeTitle}>ATMOSPHERE_VISUALIZER</div>
                        <div className={styles.themeGrid}>
                            <button
                                onClick={() => handleThemeChange('void')}
                                className={clsx(styles.themeBtn, theme === 'void' && styles.themeBtnActive)}
                            >
                                <div className={clsx(styles.themePreview, styles.previewVoid)} />
                                VOID
                            </button>
                            <button
                                onClick={() => handleThemeChange('dark')}
                                className={clsx(styles.themeBtn, theme === 'dark' && styles.themeBtnActive)}
                            >
                                <div className={clsx(styles.themePreview, styles.previewDark)} />
                                DARK
                            </button>
                            <button
                                onClick={() => handleThemeChange('flux')}
                                className={clsx(styles.themeBtn, theme === 'flux' && styles.themeBtnActive)}
                            >
                                <div className={clsx(styles.themePreview, styles.previewFlux)} />
                                FLUX
                            </button>
                        </div>
                    </div>

                    {/* ACCENT SELECTOR */}
                    <div className={styles.themeSection} style={{ borderTop: 'none', marginTop: 0 }}>
                        <div className={styles.themeTitle}>ACCENT_TONE</div>
                        <div className={styles.themeGrid} style={{ gridTemplateColumns: 'repeat(5, 1fr)' }}>
                            {[
                                { name: 'LIME', hex: '#d9ff00' },
                                { name: 'CYAN', hex: '#00f0ff' },
                                { name: 'PURPLE', hex: '#bf00ff' },
                                { name: 'RED', hex: '#ff3333' },
                                { name: 'ORANGE', hex: '#ffaa00' }
                            ].map(tone => (
                                <button
                                    key={tone.hex}
                                    onClick={() => handleAccentChange(tone.hex)}
                                    className={clsx(styles.themeBtn, accentColor === tone.hex && styles.themeBtnActive)}
                                    style={{ padding: '8px 4px' }}
                                >
                                    <div className={styles.themePreview} style={{ background: tone.hex, borderColor: 'rgba(255,255,255,0.1)' }} />
                                    <span style={{ fontSize: '8px' }}>{tone.name}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
