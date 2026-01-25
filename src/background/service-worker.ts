/// <reference types="chrome"/>
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
            const result = await chrome.storage.local.get("cutoff_cards");
            const cards = (result["cutoff_cards"] as Card[]) || [];
            const newCard = {
                id: crypto.randomUUID(),
                state: "uncommitted",
                sourceType: type,
                sourceContent: content,
                platformName,
                createdAt: Date.now(),
            };

            await chrome.storage.local.set({ cutoff_cards: [newCard, ...cards] });

            // Open Side Panel to show the saved card
            if (tab?.id) {
                chrome.sidePanel.open({ tabId: tab.id });
            }
        }
    }
});

// TODO: Implement Chrome Alarms for delayed confrontations
// chrome.alarms.onAlarm.addListener((alarm) => {
//   if (alarm.name.startsWith('confront_')) {
//     const cardId = alarm.name.replace('confront_', '');
//     // Trigger confrontation UI
//   }
// });
