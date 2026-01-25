import { create } from 'zustand';
import { v4 as uuidv4 } from 'uuid';
import type { Card, Decision, SourceType, Category } from '../lib/types';
import { storage } from '../lib/storage';
import { calculateSystemState } from '../lib/types';
import { supabase } from '../lib/supabase';

const STORAGE_KEY = 'cutoff_cards';
const DEFAULT_EXECUTE_DURATION = 15; // minutes

interface CardStore {
    cards: Card[];
    isLoading: boolean;

    // Actions
    loadCards: () => Promise<void>;
    addCard: (sourceContent: string, sourceType: SourceType, platformName?: string, extractedTitle?: string, aiTitle?: string, aiSummary?: string, category?: Category) => Promise<void>;
    deleteCard: (id: string) => Promise<void>;

    // Confrontation
    startConfrontation: (id: string) => void;
    cancelConfrontation: (id: string) => void;

    // Decisions (from confrontation)
    executeCard: (id: string, startAction?: string, stopRule?: string) => Promise<void>;
    shadowCard: (id: string) => Promise<void>;
    discardCard: (id: string) => Promise<void>;

    // Execute Mode
    startExecuteTimer: (id: string) => Promise<void>;
    stopExecute: (id: string) => Promise<void>;  // Loop closed
    abortExecute: (id: string) => Promise<void>; // Loop remains (→ shadowed)
    updateCard: (id: string, updates: Partial<Card>) => Promise<void>; // Generic update

    // Computed
    getCard: (id: string) => Card | undefined;
    getActiveCards: () => Card[];
    getOpenLoopCount: () => number;

    // Internal
    _syncToCloud: (updatedCards: Card[]) => void;
}

export const useCardStore = create<CardStore>((set, get) => ({
    cards: [],
    isLoading: true,

    loadCards: async () => {
        const cards = await storage.get<Card[]>(STORAGE_KEY);
        // Reset any "confronting" state on load and apply defaults
        const cleanCards = (cards || []).map(card => ({
            ...card,
            state: card.state === 'confronting' ? 'uncommitted' : card.state,
            executeDuration: card.executeDuration || DEFAULT_EXECUTE_DURATION,
            totalConfrontations: card.totalConfrontations || 0,
        } as Card));
        set({ cards: cleanCards, isLoading: false });

        // Force a cloud sync on load to ensure the mirror is warm
        get()._syncToCloud(cleanCards);
    },

    addCard: async (sourceContent, sourceType, platformName, extractedTitle, aiTitle, aiSummary, category) => {
        const newCard: Card = {
            id: uuidv4(),
            state: 'uncommitted',
            sourceType,
            sourceContent,
            platformName,
            extractedTitle,
            aiTitle,
            aiSummary,
            category,
            createdAt: Date.now(),
            totalConfrontations: 0,
            executeDuration: DEFAULT_EXECUTE_DURATION,
        };

        const updatedCards = [newCard, ...get().cards];
        set({ cards: updatedCards });
        await storage.set(STORAGE_KEY, updatedCards);
        get()._syncToCloud(updatedCards);
    },

    deleteCard: async (id) => {
        const { cards } = get();
        const updatedCards = cards.filter(c => c.id !== id);
        set({ cards: updatedCards });
        await storage.set(STORAGE_KEY, updatedCards);
        get()._syncToCloud(updatedCards);
    },

    // Confrontation: local state only, not persisted
    startConfrontation: (id) => {
        const { cards } = get();
        const updatedCards = cards.map(card =>
            card.id === id
                ? {
                    ...card,
                    state: 'confronting' as const,
                    confrontedAt: Date.now(),
                    totalConfrontations: card.totalConfrontations + 1
                }
                : card
        );
        set({ cards: updatedCards });
        // Not persisted - confronting state resets on reload
    },

    cancelConfrontation: (id) => {
        // Revert to previous state (uncommitted or shadowed)
        const { cards } = get();
        const card = cards.find(c => c.id === id);
        if (!card) return;

        const previousState = card.decision === 'shadow' ? 'shadowed' : 'uncommitted';
        const updatedCards = cards.map(c =>
            c.id === id ? { ...c, state: previousState } as Card : c
        );
        set({ cards: updatedCards });
    },

    // EXECUTE: Start limited commitment
    executeCard: async (id, startAction, stopRule) => {
        const { cards } = get();
        const updatedCards = cards.map(card =>
            card.id === id
                ? {
                    ...card,
                    state: 'executed' as const,
                    decision: 'execute' as Decision,
                    decidedAt: Date.now(),
                    startAction: startAction || 'Begin the first concrete step',
                    stopRule: stopRule || 'Stop after completing one meaningful action',
                }
                : card
        );
        set({ cards: updatedCards });
        await storage.set(STORAGE_KEY, updatedCards);
    },

    // SHADOW: Acknowledge but defer (open loop remains)
    shadowCard: async (id) => {
        const { cards } = get();
        const updatedCards = cards.map(card =>
            card.id === id
                ? {
                    ...card,
                    state: 'shadowed' as const,
                    decision: 'shadow' as Decision,
                    decidedAt: Date.now(),
                }
                : card
        );
        set({ cards: updatedCards });
        await storage.set(STORAGE_KEY, updatedCards);

        // Sync Trigger
        await get()._syncToCloud(updatedCards);
    },

    // DISCARD: Close loop forever
    discardCard: async (id) => {
        const { cards } = get();
        const updatedCards = cards.map(card =>
            card.id === id
                ? {
                    ...card,
                    state: 'discarded' as const,
                    decision: 'discard' as Decision,
                    decidedAt: Date.now(),
                }
                : card
        );
        set({ cards: updatedCards });
        await storage.set(STORAGE_KEY, updatedCards);
    },

    // Execute Mode: Start timer
    startExecuteTimer: async (id) => {
        const { cards } = get();
        const updatedCards = cards.map(card =>
            card.id === id
                ? { ...card, executeStartedAt: Date.now() }
                : card
        );
        set({ cards: updatedCards });
        await storage.set(STORAGE_KEY, updatedCards);
    },

    // Execute Mode: Stop = loop closed (like discard)
    stopExecute: async (id) => {
        const { cards } = get();
        const updatedCards = cards.map(card =>
            card.id === id
                ? {
                    ...card,
                    state: 'discarded' as const,
                    executeResult: 'stopped' as const,
                }
                : card
        );
        set({ cards: updatedCards });
        await storage.set(STORAGE_KEY, updatedCards);
    },

    // Execute Mode: Abort = loop remains open (→ shadowed)
    abortExecute: async (id) => {
        const { cards } = get();
        const updatedCards = cards.map(card =>
            card.id === id
                ? {
                    ...card,
                    state: 'shadowed' as const,
                    executeResult: 'aborted' as const,
                    executeStartedAt: undefined,
                }
                : card
        );
        set({ cards: updatedCards });
        await storage.set(STORAGE_KEY, updatedCards);
    },

    updateCard: async (id, updates) => {
        const { cards } = get();
        const updatedCards = cards.map(c =>
            c.id === id ? { ...c, ...updates } : c
        );
        set({ cards: updatedCards });
        await storage.set(STORAGE_KEY, updatedCards);
    },

    getCard: (id) => get().cards.find(c => c.id === id),

    // Active = visible cards (excludes discarded)
    getActiveCards: () => get().cards.filter(c => c.state !== 'discarded'),

    // Open loops = uncommitted + shadowed + executed
    getOpenLoopCount: () => {
        const { cards } = get();
        return cards.filter(c =>
            c.state === 'uncommitted' ||
            c.state === 'shadowed' ||
            c.state === 'executed'
        ).length;
    },

    // Internal Cloud Sync Trigger
    _syncToCloud: async (updatedCards: Card[]) => {
        const systemState = calculateSystemState(updatedCards);
        const openLoops = updatedCards.filter(c => ['uncommitted', 'shadowed', 'executed'].includes(c.state)).length;
        const shadowedCount = updatedCards.filter(c => c.state === 'shadowed').length;

        // 1. Get the paired Profile ID
        const profileId = await storage.get<string>('cutoff_profile_id');
        if (!profileId) {
            return;
        }

        // 2. Sync to Current State (Upsert)
        await supabase
            .from('system_current')
            .upsert({
                profile_id: profileId,
                system_state: systemState,
                total_captures: updatedCards.length,
                open_loops: openLoops,
                shadowed_count: shadowedCount,
                last_updated: new Date().toISOString()
            }, { onConflict: 'profile_id' });


        // 3. Periodic Snapshot
        await supabase.from('system_snapshots').insert({
            profile_id: profileId,
            system_state: systemState,
            total_captures: updatedCards.length,
            open_loops: openLoops
        });
    }
}));
