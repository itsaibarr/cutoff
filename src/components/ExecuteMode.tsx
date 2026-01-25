/// <reference types="chrome"/>
import { useState, useEffect, useCallback } from 'react';
import styles from './ExecuteMode.module.css';
import type { Card } from '../lib/types';
import { Shield, ShieldAlert, Lock, XCircle } from 'lucide-react';

interface ExecuteModeProps {
    card: Card;
    onStop: () => void;   // Loop closed
    onAbort: () => void;  // Loop remains open
    onStartTimer: () => void;
    onUpdateCard?: (updates: Partial<Card>) => void; // Need this to save allowedDomains
}

// Helper to clean domains
const cleanDomain = (url: string) => {
    try {
        const hostname = new URL(url).hostname;
        return hostname.replace(/^www\./, '');
    } catch {
        return null;
    }
};

export default function ExecuteMode({ card, onStop, onAbort, onStartTimer, onUpdateCard }: ExecuteModeProps) {
    const [timeRemaining, setTimeRemaining] = useState<number | null>(null);
    const [timerStarted, setTimerStarted] = useState(!!card.executeStartedAt);

    // Focus Mode State
    const [setupMode, setSetupMode] = useState(!card.executeStartedAt);
    const [allowedDomains, setAllowedDomains] = useState<string[]>(card.allowedDomains || []);
    const [manualDomain, setManualDomain] = useState('');
    const [breachDetected, setBreachDetected] = useState(false);
    const [breachSite, setBreachSite] = useState('');

    // Initial domain suggestion logic
    useEffect(() => {
        if (allowedDomains.length > 0) return;

        if (card.allowedDomains && card.allowedDomains.length > 0) {
            setAllowedDomains(card.allowedDomains);
            return;
        }

        if (!setupMode) return;

        const suggestions = new Set<string>();

        // 1. From Source
        if (card.sourceType === 'url') {
            const d = cleanDomain(card.sourceContent);
            if (d) suggestions.add(d);
        } else if (card.platformName) {
            suggestions.add(card.platformName.toLowerCase() + '.com');
        }

        if (suggestions.size > 0) {
            setAllowedDomains(Array.from(suggestions));
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Calculate remaining time & Timer Logic
    useEffect(() => {
        if (!card.executeStartedAt) return;

        const totalMs = (card.executeDuration || 15) * 60 * 1000;

        const tick = () => {
            const elapsed = Date.now() - card.executeStartedAt!;
            const remaining = Math.max(0, totalMs - elapsed);
            setTimeRemaining(remaining);
            setTimerStarted(true);
            setSetupMode(false);
        };

        tick(); // Immediate update
        const interval = setInterval(tick, 1000);
        return () => clearInterval(interval);
    }, [card.executeStartedAt, card.executeDuration]);

    // FOCUS ENFORCER LOOP
    useEffect(() => {
        if (!timerStarted || !card.executeStartedAt || (timeRemaining !== null && timeRemaining <= 0)) {
            if (breachDetected) setBreachDetected(false);
            return;
        }

        const whitelist = card.allowedDomains || allowedDomains;
        if (whitelist.length === 0) return;

        const checkFocus = async () => {
            try {
                // Use lastFocusedWindow to get the tab the user is actually interacting with
                const tabs = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
                const activeTab = tabs[0];

                if (!activeTab?.url) return;

                const currentUrl = activeTab.url;
                const currentDomain = cleanDomain(currentUrl);

                // Allow extension pages and devtools, but NOT newtab (procrastination hub)
                if (currentUrl.startsWith('chrome-extension://') ||
                    currentUrl.startsWith('devtools://')) {
                    if (breachDetected) setBreachDetected(false);
                    return;
                }

                if (!currentDomain) {
                    // System pages like chrome://settings
                    if (!breachDetected) {
                        setBreachDetected(true);
                        setBreachSite("System Page");
                    }
                    return;
                }

                // Check whitelist
                const isAllowed = whitelist.some(d => {
                    const cleanD = d.toLowerCase();
                    const cleanC = currentDomain.toLowerCase();
                    return cleanC.includes(cleanD) || cleanD.includes(cleanC);
                });

                if (!isAllowed) {
                    if (!breachDetected || breachSite !== currentDomain) {
                        setBreachDetected(true);
                        setBreachSite(currentDomain);
                    }
                } else if (breachDetected) {
                    setBreachDetected(false);
                    setBreachSite('');
                }
            } catch (e) {
                console.error('Focus check failed', e);
            }
        };

        const enforcer = setInterval(checkFocus, 1000);
        return () => clearInterval(enforcer);
        // Only re-run when these core things change
    }, [timerStarted, card.executeStartedAt, allowedDomains, card.allowedDomains, breachDetected, breachSite, timeRemaining]);

    const handleStartTimer = useCallback(() => {
        if (onUpdateCard) {
            onUpdateCard({ allowedDomains });
        }
        onStartTimer();
        setTimerStarted(true);
        setSetupMode(false);
    }, [onStartTimer, onUpdateCard, allowedDomains]);

    const toggleDomain = (domain: string) => {
        if (allowedDomains.includes(domain)) {
            setAllowedDomains(allowedDomains.filter(d => d !== domain));
        } else {
            setAllowedDomains([...allowedDomains, domain]);
        }
    };

    const addManualDomain = () => {
        if (!manualDomain) return;
        const d = cleanDomain(manualDomain.includes('http') ? manualDomain : `https://${manualDomain}`);
        if (d) {
            setAllowedDomains(prev => [...prev, d]);
            setManualDomain('');
        }
    };

    const formatTime = (ms: number): string => {
        const totalSeconds = Math.floor(ms / 1000);
        const minutes = Math.floor(totalSeconds / 60);
        const seconds = totalSeconds % 60;
        return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    };

    const timerComplete = timeRemaining !== null && timeRemaining <= 0;

    // BREACH OVERLAY - Only show if timer NOT complete
    if (breachDetected && !timerComplete) {
        return (
            <div className={styles.container} style={{ borderColor: 'var(--color-danger)' }}>
                <div className={styles.breachOverlay}>
                    <ShieldAlert size={64} color="var(--color-danger)" aria-label="Security Breach Alert" />
                    <h2 style={{ color: 'var(--color-danger)', marginTop: 16 }}>FOCUS BREACH</h2>
                    <p>You strayed to <strong>{breachSite}</strong>.</p>
                    <p style={{ opacity: 0.7, marginTop: 8 }}>Go back to your task to resume.</p>

                    <button onClick={onAbort} className={styles.abortButton} style={{ marginTop: 32, width: '100%', background: 'transparent', border: '1px solid var(--color-danger)', color: 'var(--color-danger)' }}>
                        I GIVE UP (ABORT)
                    </button>
                    <p style={{ fontSize: 11, color: '#666', marginTop: 12 }}>
                        Returning to allowed sites will dismiss this screen.
                    </p>
                </div>
            </div>
        );
    }

    // SETUP MODE UI
    if (setupMode) {
        return (
            <div className={styles.container}>
                <header className={styles.header}>
                    <h1 className={styles.title}>FOCUS SETUP</h1>
                    <p className={styles.subtitle}>Define your boundaries.</p>
                </header>

                <div className={styles.content}>
                    <div className={styles.whitelistSection}>
                        <div style={{ display: 'flex', alignItems: 'center', marginBottom: 12, color: 'var(--color-text-secondary)' }}>
                            <Shield size={14} style={{ marginRight: 8 }} aria-label="Privacy Filter" />
                            <span style={{ fontSize: 13 }}>ALLOWED SITES</span>
                        </div>

                        <div className={styles.domainList}>
                            {allowedDomains.map(domain => (
                                <div key={domain} className={styles.domainTag} onClick={() => toggleDomain(domain)}>
                                    <span>{domain}</span>
                                    <XCircle size={12} style={{ marginLeft: 6, opacity: 0.5 }} aria-label="Remove domain" />
                                </div>
                            ))}
                            {allowedDomains.length === 0 && (
                                <p style={{ fontSize: 12, color: '#666', fontStyle: 'italic' }}>
                                    No limits. You assume full responsibility.
                                </p>
                            )}
                        </div>

                        <div className={styles.addDomainRow}>
                            <input
                                value={manualDomain}
                                onChange={e => setManualDomain(e.target.value)}
                                placeholder="Add domain (e.g. google.com)..."
                                className={styles.domainInput}
                                onKeyDown={e => e.key === 'Enter' && addManualDomain()}
                            />
                            <button onClick={addManualDomain} className={styles.iconButton}>+</button>
                        </div>
                    </div>

                    <div className={styles.actionBlock} style={{ marginTop: 24 }}>
                        <h3>FIRST STEP</h3>
                        <p>{card.startAction || 'Begin the first concrete step'}</p>
                    </div>
                </div>

                <div className={styles.actions}>
                    <button onClick={handleStartTimer} className={styles.startButton} aria-label="Lock system and start timer">
                        <Lock size={14} style={{ marginRight: 8 }} aria-hidden="true" />
                        LOCK & START
                    </button>
                </div>
            </div>
        );
    }

    // RUNNING MODE UI
    return (
        <div className={styles.container}>
            <header className={styles.header}>
                <h2 className={styles.title}>EXECUTE MODE</h2>
                <p className={styles.subtitle}>
                    {allowedDomains.length > 0 ? (
                        <span style={{ color: 'var(--color-primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
                            <Shield size={12} aria-hidden="true" /> RESTRICTED
                        </span>
                    ) : 'Limited commitment'}
                </p>
            </header>

            <div className={styles.content}>
                <div className={styles.source}>
                    {card.extractedTitle || card.sourceContent.slice(0, 100)}
                </div>

                <div className={styles.timerSection}>
                    <div className={styles.timer}>
                        {timeRemaining !== null ? formatTime(timeRemaining) : '--:--'}
                    </div>
                </div>

                <div className={styles.stopRuleBlock}>
                    <h3>STOP RULE</h3>
                    <p>{card.stopRule || 'Stop after completing one meaningful action'}</p>
                </div>
            </div>

            <div className={styles.actions}>
                {timerComplete ? (
                    <>
                        <button onClick={onStop} className={styles.stopButton}>
                            STOP — loop closed
                        </button>
                        <button onClick={onAbort} className={styles.abortButton}>
                            ABORT — loop remains open
                        </button>
                    </>
                ) : (
                    <>
                        <button onClick={onStop} className={styles.stopButton}>
                            STOP EARLY
                        </button>
                        <button onClick={onAbort} className={styles.abortButton}>
                            ABORT
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
