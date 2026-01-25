/// <reference types="chrome"/>
import { useState, useEffect } from 'react';
import styles from './CaptureModal.module.css';
import { X, Link as LinkIcon, FileText, Sparkles, Upload, Key, File as FileIcon, Trash2 } from 'lucide-react';
import clsx from 'clsx';
import { aiService } from '../services/ai-service';
import { extractPageContext, type ExtractionPayload } from '../lib/content-extractor';
import { fetchPageMetadata } from '../lib/metadata-fetcher';

interface CaptureModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (content: string, type: 'url' | 'text' | 'file', platform?: string, title?: string, aiSummary?: string, category?: string) => Promise<void>;
}

type Tab = 'link' | 'text' | 'file';

export default function CaptureModal({ isOpen, onClose, onSave }: CaptureModalProps) {
    const [activeTab, setActiveTab] = useState<Tab>('link');
    const [input, setInput] = useState('');
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [analyzedData, setAnalyzedData] = useState<{ title: string; summary: string; category?: string } | null>(null);
    const [showApiKeyInput, setShowApiKeyInput] = useState(false);
    const [apiKey, setApiKey] = useState('');

    useEffect(() => {
        if (isOpen) {
            setInput('');
            setSelectedFile(null);
            setAnalyzedData(null);
            setIsAnalyzing(false);
            setShowApiKeyInput(false);

            if (chrome.tabs) {
                chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
                    const tab = tabs[0];
                    if (tab?.url && tab.url.startsWith('http')) {
                        setInput(tab.url);
                    }
                });
            }
        }
    }, [isOpen]);

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files && e.target.files[0]) {
            setSelectedFile(e.target.files[0]);
            setAnalyzedData(null);
        }
    };

    const readFileAsBase64 = (file: File): Promise<string> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const result = reader.result as string;
                // Remove data URL prefix (e.g. "data:image/png;base64,")
                const base64 = result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    };

    const performAnalysis = async () => {
        if ((activeTab === 'link' || activeTab === 'text') && !input.trim()) return;
        if (activeTab === 'file' && !selectedFile) return;

        setIsAnalyzing(true);
        setAnalyzedData(null);

        try {
            let result;
            if (activeTab === 'link') {
                let payload: ExtractionPayload | null = null;
                try {
                    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
                    const activeTab = tabs[0];
                    if (activeTab?.id && (activeTab.url === input || input === activeTab.url)) {
                        const injection = await chrome.scripting.executeScript({
                            target: { tabId: activeTab.id },
                            func: extractPageContext
                        });
                        if (injection?.[0]?.result) {
                            payload = injection[0].result as ExtractionPayload;
                        }
                    }
                } catch (err) {
                    console.warn('Failed to extract page content:', err);
                }

                if (payload) {
                    result = await aiService.analyzeContent(payload);
                } else {
                    // Manual paste or different tab - Fetch metadata!
                    const metadata = await fetchPageMetadata(input);
                    if (metadata.error) {
                        // Fallback to simple URL analysis if fetch fails
                        result = await aiService.analyzeUrl(input);
                    } else {
                        result = await aiService.analyzeContent({
                            url: input,
                            platform: 'web',
                            title: metadata.title || 'Link',
                            rawText: metadata.rawText || `URL: ${input}`,
                            metadata: { description: metadata.description }
                        });
                    }
                }

            } else if (activeTab === 'file' && selectedFile) {
                // FILE ANALYSIS
                const base64Data = await readFileAsBase64(selectedFile);

                const payload: ExtractionPayload = {
                    url: 'file://' + selectedFile.name,
                    platform: 'file',
                    title: selectedFile.name,
                    rawText: `File: ${selectedFile.name} (${selectedFile.type}, ${(selectedFile.size / 1024).toFixed(1)} KB)`,
                    metadata: {
                        size: selectedFile.size,
                        lastModified: selectedFile.lastModified
                    },
                    fileData: {
                        mimeType: selectedFile.type,
                        data: base64Data
                    }
                };
                result = await aiService.analyzeContent(payload);

            } else {
                result = await aiService.analyzeText(input);
            }

            setAnalyzedData({
                title: result.title,
                summary: result.summary,
                category: result.category
            });
            setShowApiKeyInput(false);

        } catch (error) {
            console.error('Analysis failed:', error);
            const err = error as Error;

            if (err.message === 'API_KEY_MISSING') {
                setShowApiKeyInput(true);
            } else {
                setAnalyzedData({
                    title: 'Analysis Error',
                    summary: `DEBUG INFO:\n${err.message}\n\nCheck console for details.`
                });
            }
        } finally {
            setIsAnalyzing(false);
        }
    };

    const handleSaveApiKey = async () => {
        if (!apiKey.trim()) return;
        await aiService.setApiKey(apiKey.trim());
        setShowApiKeyInput(false);
        performAnalysis();
    };

    const handleSave = async () => {
        let saveContent = input;
        let saveType: 'url' | 'text' | 'file' = activeTab === 'link' ? 'url' : 'text';
        let saveTitle = analyzedData?.title;
        const saveSummary = analyzedData?.summary;
        const saveCategory = analyzedData?.category;

        if (activeTab === 'file' && selectedFile) {
            saveType = 'file';
            saveContent = selectedFile.name; // For now just saving the name
            if (!saveTitle) saveTitle = selectedFile.name;
        }

        await onSave(
            saveContent,
            saveType,
            activeTab === 'link' ? new URL(input).hostname : undefined,
            saveTitle,
            saveSummary,
            saveCategory
        );
        onClose();
    };

    if (!isOpen) return null;

    if (showApiKeyInput) {
        return (
            <div className={styles.overlay}>
                <div className={styles.modal}>
                    <div className={styles.header}>
                        <h2 className={styles.title} style={{ color: 'var(--color-primary)' }}>
                            <Key size={14} style={{ display: 'inline', marginRight: 8 }} aria-label="Security Key" />
                            SETUP AI
                        </h2>
                        <button onClick={() => setShowApiKeyInput(false)} className={styles.closeButton} aria-label="Close API Setup">
                            <X size={16} aria-hidden="true" />
                        </button>
                    </div>
                    <div className={styles.body}>
                        <p style={{ fontSize: 13, color: '#aaa', lineHeight: 1.5 }}>
                            To use Smart Analysis, you need a Google Gemini API Key. It's free.
                        </p>
                        <div className={styles.inputGroup}>
                            <label className={styles.label}>PASTE API KEY</label>
                            <input
                                type="password"
                                value={apiKey}
                                onChange={(e) => setApiKey(e.target.value)}
                                className={styles.input}
                                placeholder="AIza..."
                                autoFocus
                            />
                        </div>
                        <p style={{ fontSize: 11, color: '#666', marginTop: 8 }}>
                            Your key is stored locally on your device.
                        </p>
                    </div>
                    <div style={{ padding: 16, borderTop: '1px solid #222' }}>
                        <button onClick={handleSaveApiKey} className={styles.analyzeButton} style={{ width: '100%' }}>
                            SAVE & ANALYZE
                        </button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className={styles.overlay}>
            <div className={styles.modal}>
                <div className={styles.header}>
                    <h1 className={styles.title}>
                        <Sparkles size={14} style={{ display: 'inline', marginRight: 8 }} aria-label="AI insight" />
                        Smart Capture
                    </h1>
                    <button onClick={onClose} className={styles.closeButton} aria-label="Close Capture Modal">
                        <X size={16} aria-hidden="true" />
                    </button>
                </div>

                <div className={styles.tabs}>
                    <button
                        className={clsx(styles.tab, activeTab === 'link' && styles.activeTab)}
                        onClick={() => { setActiveTab('link'); setAnalyzedData(null); }}
                        aria-label="Capture from Link"
                    >
                        <LinkIcon size={14} style={{ display: 'inline', marginRight: 6 }} aria-hidden="true" />
                        LINK
                    </button>
                    <button
                        className={clsx(styles.tab, activeTab === 'text' && styles.activeTab)}
                        onClick={() => { setActiveTab('text'); setAnalyzedData(null); }}
                        aria-label="Capture from Text"
                    >
                        <FileText size={14} style={{ display: 'inline', marginRight: 6 }} aria-hidden="true" />
                        TEXT
                    </button>
                    <button
                        className={clsx(styles.tab, activeTab === 'file' && styles.activeTab)}
                        onClick={() => { setActiveTab('file'); setAnalyzedData(null); }}
                        aria-label="Capture from File"
                    >
                        <Upload size={14} style={{ display: 'inline', marginRight: 6 }} aria-hidden="true" />
                        FILE
                    </button>
                </div>

                <div className={styles.body}>
                    <div className={styles.inputGroup}>
                        <label className={styles.label}>
                            {activeTab === 'link' ? 'SOURCE URL' : activeTab === 'file' ? 'UPLOAD FILE' : 'CONTENT'}
                        </label>

                        {activeTab === 'file' ? (
                            <div style={{ width: '100%' }}>
                                {!selectedFile ? (
                                    <label className={styles.fileDropZone} style={{
                                        display: 'flex',
                                        flexDirection: 'column',
                                        alignItems: 'center',
                                        padding: '24px',
                                        border: '1px dashed #444',
                                        borderRadius: '6px',
                                        cursor: 'pointer',
                                        color: '#888',
                                        fontSize: '13px'
                                    }}>
                                        <Upload size={24} style={{ marginBottom: 8, opacity: 0.7 }} aria-hidden="true" />
                                        <span>Click to select image or PDF</span>
                                        <input
                                            type="file"
                                            onChange={handleFileSelect}
                                            style={{ display: 'none' }}
                                            accept="image/*,application/pdf,text/*"
                                            aria-label="File upload"
                                        />
                                    </label>
                                ) : (
                                    <div style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        padding: '12px',
                                        background: '#222',
                                        borderRadius: '6px',
                                        border: '1px solid #333'
                                    }}>
                                        <FileIcon size={16} style={{ color: 'var(--color-primary)', marginRight: 12 }} />
                                        <div style={{ flex: 1, overflow: 'hidden' }}>
                                            <div style={{ fontSize: '13px', color: '#eee', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                                                {selectedFile.name}
                                            </div>
                                            <div style={{ fontSize: '11px', color: '#666' }}>
                                                {(selectedFile.size / 1024).toFixed(1)} KB
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => { setSelectedFile(null); setAnalyzedData(null); }}
                                            style={{ background: 'none', border: 'none', color: '#666', cursor: 'pointer', padding: 4 }}
                                            aria-label="Remove selected file"
                                        >
                                            <Trash2 size={14} aria-hidden="true" />
                                        </button>
                                    </div>
                                )}
                            </div>
                        ) : activeTab === 'text' ? (
                            <textarea
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                className={styles.textarea}
                                placeholder="Paste text here..."
                                autoFocus
                            />
                        ) : (
                            <input
                                type="text"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                className={styles.input}
                                placeholder="https://..."
                                autoFocus
                            />
                        )}
                    </div>

                    {analyzedData && (
                        <div className={styles.preview}>
                            <div className={styles.aiHeader}>
                                <Sparkles size={12} aria-label="AI Power" /> AI ANALYSIS
                            </div>

                            <div className={styles.previewField}>
                                <label className={styles.label}>TITLE</label>
                                <input
                                    value={analyzedData.title}
                                    onChange={(e) => setAnalyzedData({ ...analyzedData, title: e.target.value })}
                                    className={styles.previewInput}
                                />
                            </div>

                            <div className={styles.previewField}>
                                <label className={styles.label}>RECOGNITION CONTEXT</label>
                                <textarea
                                    value={analyzedData.summary}
                                    onChange={(e) => setAnalyzedData({ ...analyzedData, summary: e.target.value })}
                                    className={styles.previewInput}
                                    style={{ minHeight: '60px', resize: 'none' }}
                                />
                            </div>
                        </div>
                    )}
                </div>

                <div style={{ padding: 16, borderTop: '1px solid #222', display: 'flex', gap: 8 }}>
                    {!analyzedData ? (
                        <button
                            onClick={performAnalysis}
                            disabled={(activeTab !== 'file' && !input.trim()) || (activeTab === 'file' && !selectedFile) || isAnalyzing}
                            className={styles.analyzeButton}
                            style={{ flex: 1 }}
                        >
                            {isAnalyzing ? <div className={styles.loader}></div> : 'ANALYZE & PREVIEW'}
                        </button>
                    ) : (
                        <>
                            <button onClick={() => setAnalyzedData(null)} className={styles.secondaryButton}>
                                BACK
                            </button>
                            <button onClick={handleSave} className={styles.analyzeButton} style={{ flex: 1 }}>
                                SAVE CARD
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
