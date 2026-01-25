/// <reference types="chrome"/>
import { useEffect, useState, useMemo } from 'react';
import styles from './SidePanel.module.css';
import { useCardStore } from '../store/card-store';
import { formatTimeSince, calculateSystemState } from '../lib/types';
import type { Card, Category } from '../lib/types';
import clsx from 'clsx';
import { Trash, Play, Clock, AlertTriangle, Plus, Sparkles, BarChart3 } from 'lucide-react';
import ExecuteMode from '../components/ExecuteMode';
import CaptureModal from '../components/CaptureModal';
import OnboardingGuide from '../components/OnboardingGuide';

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

    // Filtering
    const [activeFilter, setActiveFilter] = useState<string>('All');

    // New Capture State
    const [isCaptureOpen, setIsCaptureOpen] = useState(false);

    // Onboarding State
    const [showOnboarding, setShowOnboarding] = useState(false);

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

        if (typeof chrome !== 'undefined' && chrome.storage) {
            const listener = () => loadCards();
            chrome.storage.onChanged.addListener(listener);
            return () => chrome.storage.onChanged.removeListener(listener);
        }
    }, [loadCards]);

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
    const systemState = useMemo(() => calculateSystemState(cards), [cards]);
    const globalCount = cards.length;
    const openLoopCount = useMemo(() =>
        cards.filter(c => c.state === 'uncommitted' || c.state === 'shadowed' || c.state === 'executed').length,
        [cards]);

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
        </div>
    );
}
