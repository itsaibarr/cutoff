/// <reference types="chrome"/>
// Wrapper for chrome.storage.local with dev mode fallback

export const storage = {
    get: async <T>(key: string): Promise<T | null> => {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            const result = await chrome.storage.local.get(key);
            return (result[key] as T) || null;
        } else {
            // Dev mode fallback
            const item = localStorage.getItem(key);
            return item ? (JSON.parse(item) as T) : null;
        }
    },

    set: async <T>(key: string, value: T): Promise<void> => {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            await chrome.storage.local.set({ [key]: value });
        } else {
            // Dev mode fallback
            localStorage.setItem(key, JSON.stringify(value));
        }
    },

    remove: async (key: string): Promise<void> => {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            await chrome.storage.local.remove(key);
        } else {
            localStorage.removeItem(key);
        }
    },

    watch: <T>(key: string, callback: (value: T) => void): (() => void) => {
        if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
            const listener = (changes: { [key: string]: chrome.storage.StorageChange }) => {
                if (changes[key]) {
                    callback(changes[key].newValue as T);
                }
            };
            chrome.storage.onChanged.addListener(listener);
            return () => chrome.storage.onChanged.removeListener(listener);
        } else {
            const listener = (e: StorageEvent) => {
                if (e.key === key) {
                    callback(e.newValue ? JSON.parse(e.newValue) : null);
                }
            };
            window.addEventListener('storage', listener);
            return () => window.removeEventListener('storage', listener);
        }
    }
};
