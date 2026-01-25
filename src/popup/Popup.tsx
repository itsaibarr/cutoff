/// <reference types="chrome"/>
import { useState, useEffect } from 'react';
import styles from './Popup.module.css';
import { useCardStore } from '../store/card-store';
import { ArrowRight, FileText, Link } from 'lucide-react';
import clsx from 'clsx';

export default function Popup() {
    const [input, setInput] = useState('');
    const [status, setStatus] = useState<'idle' | 'saving' | 'saved'>('idle');
    const addCard = useCardStore(state => state.addCard);

    // Auto-focus and paste check
    useEffect(() => {
        // In real extension, we might grab active tab URL automatically
        if (typeof chrome !== 'undefined' && chrome.tabs) {
            chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                const url = tabs[0]?.url;
                if (url && !url.startsWith('chrome://')) {
                    setInput(url);
                }
            });
        }
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!input.trim()) return;

        setStatus('saving');

        // Determine type (naive for MVP)
        const isUrl = input.startsWith('http');
        const type = isUrl ? 'url' : 'text';

        await addCard(input, type, isUrl ? new URL(input).hostname : undefined);

        setStatus('saved');
        setTimeout(() => {
            window.close(); // Close popup
        }, 1500);
    };

    return (
        <div className={styles.container}>
            {status === 'saved' ? (
                <div className={styles.successMessage}>
                    <div className={styles.iconWrapper}>
                        <div className={styles.glitchBox}></div>
                    </div>
                    <h2>SAVED.</h2>
                    <p>No decision made.</p>
                    <p className={styles.subtext}>You have gained nothing.</p>
                </div>
            ) : (
                <>
                    <header className={styles.header}>
                        <span className={styles.brand}>CUTOFF</span>
                        <span className={styles.indicator}>●</span>
                    </header>

                    <form onSubmit={handleSubmit} className={styles.form}>
                        <div className={styles.inputWrapper}>
                            {input.startsWith('http') ? <Link size={16} /> : <FileText size={16} />}
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                placeholder="Paste URL, text, or thought..."
                                className={styles.input}
                                autoFocus
                            />
                        </div>

                        <div className={styles.footer}>
                            <p className={styles.validation}>
                                {input.length > 5 ? "Input received. Action required." : "Waiting for input..."}
                            </p>
                            <button
                                type="submit"
                                disabled={!input.trim()}
                                className={clsx(styles.submitButton, input.trim() && styles.active)}
                            >
                                <ArrowRight size={20} />
                            </button>
                        </div>
                    </form>
                </>
            )}
        </div>
    );
}
