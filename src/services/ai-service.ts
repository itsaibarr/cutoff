import { storage } from '../lib/storage';
import type { ExtractionPayload } from '../lib/content-extractor';

export interface AIAnalysisResult {
    title: string;
    summary: string;
    tags?: string[];
    category?: string;
}

interface GeminiModel {
    name: string;
    supportedGenerationMethods?: string[];
}

const API_STORAGE_KEY = 'cutoff_gemini_api_key';

export class AIService {
    private static instance: AIService;
    private apiKey: string | null = null;
    private displayedModel: string | null = null;

    private constructor() { }

    public static getInstance(): AIService {
        if (!AIService.instance) {
            AIService.instance = new AIService();
        }
        return AIService.instance;
    }

    public async isAvailable(): Promise<boolean> {
        const key = await this.getApiKey();
        return !!key;
    }

    public async getApiKey(): Promise<string | null> {
        if (this.apiKey) return this.apiKey;

        const storedKey = await storage.get<string>(API_STORAGE_KEY);
        if (storedKey) {
            this.apiKey = storedKey;
            return storedKey;
        }

        const envKey = import.meta.env.VITE_GEMINI_API_KEY;
        if (envKey) {
            this.apiKey = envKey;
            return envKey;
        }

        return null;
    }

    public async setApiKey(key: string): Promise<void> {
        this.apiKey = key;
        await storage.set(API_STORAGE_KEY, key);
    }

    public async analyzeContent(payload: ExtractionPayload): Promise<AIAnalysisResult> {
        const key = await this.getApiKey();
        if (!key) throw new Error('API_KEY_MISSING');

        // AI Input Contract
        const inputContext = JSON.stringify({
            platform: payload.platform,
            title: payload.title,
            author: payload.metadata?.author,
            rawText: payload.rawText.slice(0, 8500),
            url: payload.url,
            hasFile: !!payload.fileData
        });

        const prompt = `
        Role: Context Extraction Engine.
        Task: Analyze the provided metadata, text, and optional file content to generate a Neutral Recognition Context.

        Input Data:
        ${inputContext}

        CRITICAL RULES:
        1. HALLUCINATION CHECK: Use ONLY the provided "rawText", "title", and "author". Do NOT guess based on the URL.
        2. If the input data is generic (e.g. "YouTube", "Twitter"), output "Unknown Content" for the title.
        3. "title": Create a neutral, identifying title (max 8 words). PREFER 'rawText' content over metadata.
        4. "summary": Write 1-2 sentences strictly for RECOGNITION.
           - Answer: "What is this specific file/video?"
           - If you cannot determine the specific content, say "Content could not be analyzed."
           - Exclude: Value judgments, fluff.
           - Style: Dry, factual, archival.
        5. "tags": 3-5 keywords for indexing.
        6. "category": Choose ONE strictly from: "Learning", "Tool", "Idea", "Content", "Reference", "Opportunity".

        Output JSON:
        {
            "title": "...",
            "summary": "...", 
            "tags": ["..."],
            "category": "..."
        }
        `;

        return await this.callGemini(prompt, key, payload.fileData);
    }

    // Legacy method for text-only
    public async analyzeText(text: string): Promise<AIAnalysisResult> {
        return this.analyzeContent({
            url: '',
            platform: 'text',
            title: 'Note',
            rawText: text,
            metadata: {}
        });
    }

    public async analyzeUrl(url: string, content?: string): Promise<AIAnalysisResult> {
        return this.analyzeContent({
            url,
            platform: 'web',
            title: 'Link',
            rawText: content || `URL: ${url}`,
            metadata: {}
        });
    }

    private async callGemini(prompt: string, key: string, fileData?: { mimeType: string, data: string }): Promise<AIAnalysisResult> {
        const modelName = await this.getWorkingModel(key);
        console.log(`Selected Gemini Model: ${modelName}`);

        return await this.tryModel(modelName, prompt, key, fileData);
    }

    private async getWorkingModel(key: string): Promise<string> {
        if (this.displayedModel) return this.displayedModel;

        try {
            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${key}`);
            if (!response.ok) {
                console.warn('ListModels failed, falling back to gemini-pro');
                return 'gemini-pro';
            }

            const data = await response.json();
            const candidates = (data.models || []).filter((m: GeminiModel) =>
                m.supportedGenerationMethods?.includes('generateContent') &&
                m.name.includes('gemini')
            );

            if (candidates.length === 0) return 'gemini-pro';

            // Priority: Flash 1.5 -> Flash -> Pro 1.5 -> Pro 1.0 -> Any
            const flash15 = candidates.find((m: GeminiModel) => m.name.includes('1.5-flash'));
            const pro15 = candidates.find((m: GeminiModel) => m.name.includes('1.5-pro'));
            const pro10 = candidates.find((m: GeminiModel) => m.name.includes('gemini-pro'));

            const selected = flash15 || pro15 || pro10 || candidates[0];
            const cleanName = selected.name.replace('models/', '');

            this.displayedModel = cleanName;
            return cleanName;
        } catch (e) {
            console.warn('Model auto-discovery error:', e);
            return 'gemini-pro';
        }
    }

    private async tryModel(model: string, prompt: string, key: string, fileData?: { mimeType: string, data: string }): Promise<AIAnalysisResult> {
        const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

        const parts: { text?: string; inlineData?: { mimeType: string; data: string } }[] = [{ text: prompt }];

        if (fileData) {
            parts.push({
                inlineData: {
                    mimeType: fileData.mimeType,
                    data: fileData.data
                }
            });
        }

        const payload = {
            contents: [{
                parts: parts
            }]
        };

        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API Error ${response.status} (${model}): ${errorText.slice(0, 150)}`);
        }

        const data = await response.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text;

        if (!rawText) throw new Error('No response content from AI');

        return this.parseResponse(rawText);
    }

    private parseResponse(text: string): AIAnalysisResult {
        try {
            const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(cleanText) as AIAnalysisResult;
        } catch (e) {
            console.warn('Failed to parse JSON from AI, fallback to raw text', e);
            return {
                title: 'AI Analysis Result',
                summary: text.slice(0, 200),
                tags: []
            };
        }
    }
}

export const aiService = AIService.getInstance();
