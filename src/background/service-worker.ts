/// <reference types="chrome"/>
import { storage } from '../lib/storage';
import type { Card } from '../lib/types';

// Open Side Panel on extension icon click
chrome.action.onClicked.addListener((tab) => {
    if (tab.id) {
        chrome.sidePanel.open({ tabId: tab.id });
    }
});

// Context Menu: Save to Cutoff
chrome.runtime.onInstalled.addListener(() => {
    chrome.contextMenus.create({
        id: "cutoff-save",
        title: "Save to Cutoff",
        contexts: ["selection", "link", "page"]
    });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
    if (info.menuItemId === "cutoff-save") {
        let content = "";
        let type: "url" | "text" = "text";
        let platformName: string | undefined;

        if (info.linkUrl) {
            content = info.linkUrl;
            type = "url";
            platformName = new URL(info.linkUrl).hostname;
        } else if (info.selectionText) {
            content = info.selectionText;
            type = "text";
        } else if (info.pageUrl) {
            content = info.pageUrl;
            type = "url";
            platformName = new URL(info.pageUrl).hostname;
        }

        if (content) {
            const cards = (await storage.get<Card[]>("cutoff_cards")) || [];
            const newCard: Card = {
                id: crypto.randomUUID(),
                state: "uncommitted",
                sourceType: type,
                sourceContent: content,
                platformName,
                createdAt: Date.now(),
                totalConfrontations: 0,
                executeDuration: 15,
            };

            await storage.set("cutoff_cards", [newCard, ...cards]);

            // Open Side Panel to show the saved card
            if (tab?.id) {
                chrome.sidePanel.open({ tabId: tab.id });
            }
        }
    }
});
