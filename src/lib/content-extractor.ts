export interface ExtractionPayload {
    url: string;
    platform: string;
    title: string;
    rawText: string;
    metadata?: Record<string, unknown>;
    fileData?: {
        mimeType: string;
        data: string; // Base64
    };
}

/**
 * This function is designed to be serialized and injected into the page context.
 * It must not rely on external imports.
 */
/**
 * This function is designed to be serialized and injected into the page context.
 * It must not rely on external imports.
 */
export async function extractPageContext(): Promise<ExtractionPayload> {
    const url = window.location.href;
    const hostname = window.location.hostname;

    const clean = (str: string | undefined | null) => (str || '').replace(/\s+/g, ' ').trim();
    const getMeta = (name: string) =>
        document.querySelector(`meta[name="${name}"]`)?.getAttribute('content') ||
        document.querySelector(`meta[property="${name}"]`)?.getAttribute('content');

    const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

    // Wait for critical elements on SPAs (up to 2s)
    let retries = 0;
    while (retries < 10) {
        // If we have a generic title on YouTube, wait
        const isGenericYouTube = hostname.includes('youtube.com') &&
            (!document.title || document.title === 'YouTube');

        if (!isGenericYouTube) break;

        // Check if H1 exists yet
        const ytH1 = document.querySelector('h1.ytd-watch-metadata') || document.querySelector('#title h1');
        if (ytH1) break;

        await sleep(200);
        retries++;
    }

    let title = document.title;
    let rawText = '';
    let platform = 'web';
    const metadata: Record<string, unknown> = {};

    // Base Metadata
    const description = getMeta('description') || getMeta('og:description') || '';
    const ogTitle = getMeta('og:title');
    if (ogTitle) title = ogTitle;

    metadata.description = description;
    metadata.author = getMeta('author') || getMeta('og:site_name');
    metadata.keywords = getMeta('keywords');

    // 2. Specific Platform Heuristics
    if (hostname.includes('youtube.com')) {
        platform = 'youtube';

        // Try JSON-LD first (Most reliable, iterate all to find VideoObject)
        const jsonLdScripts = document.querySelectorAll('script[type="application/ld+json"]');
        let foundJsonLd = false;

        for (const script of Array.from(jsonLdScripts)) {
            try {
                const data = JSON.parse(script.textContent || '{}');
                // Check if it's the main VideoObject by type
                if (data['@type'] === 'VideoObject' || data['@type'] === 'http://schema.org/VideoObject') {
                    if (data.name) title = data.name;
                    if (data.description) metadata.description = data.description;
                    if (data.author && data.author.name) metadata.author = data.author.name;
                    foundJsonLd = true;
                    break; // Found the specific video metadata
                }
            } catch {
                // ignore
            }
        }

        // DOM Fallback for Title (only if JSON-LD failed)
        // Check standard H1 or the new ytd-watch-metadata
        const ytTitle = document.querySelector('h1.ytd-watch-metadata')?.textContent ||
            document.querySelector('#title h1')?.textContent;
        if (!foundJsonLd && ytTitle) {
            title = clean(ytTitle);
        }

        // DOM Fallback for Description
        if (!metadata.description) {
            // Meta tag is often better than hidden DOM
            const metaDesc = getMeta('description') || getMeta('og:description');
            if (metaDesc) {
                metadata.description = clean(metaDesc);
            } else {
                // Try DOM expansion text
                const ytDesc = document.querySelector('#description-inline-expander')?.textContent ||
                    document.querySelector('#description-text')?.textContent;
                if (ytDesc) metadata.description = clean(ytDesc);
            }
        }

        // DOM Fallback for Author
        if (!metadata.author) {
            const channelName = document.querySelector('ytd-channel-name a')?.textContent;
            if (channelName) metadata.author = clean(channelName);
        }

        // Context: Chapter markers
        const chapters = Array.from(document.querySelectorAll('ytd-macro-markers-list-item-renderer h4'))
            .map(el => clean(el.textContent))
            .filter(Boolean)
            .join('; ');

        // Context: Comments (User validation)
        const comments = Array.from(document.querySelectorAll('#content-text'))
            .slice(0, 5)
            .map(el => el.textContent?.slice(0, 200))
            .join('\n---\n');

        rawText = `VIDEO CONTEXT:
Title: ${title}
Channel: ${metadata.author || 'Unknown'}
Description: ${metadata.description || 'No description available'}
Chapters: ${chapters}

Top Comments:
${comments}`;

    } else if (hostname.includes('github.com')) {
        platform = 'github';
        const readme = document.querySelector('article.markdown-body')?.textContent;
        if (readme) {
            rawText = clean(readme.slice(0, 5000));
        } else {
            rawText = document.body.innerText.slice(0, 3000);
        }
    } else {
        // Generic Web
        const h1s = Array.from(document.querySelectorAll('h1')).map(el => el.textContent).join('; ');
        const main = document.querySelector('main') || document.querySelector('article') || document.body;
        const bodyText = clean(main.innerText.slice(0, 5000));

        rawText = `Headings: ${h1s}\n\nContent: ${bodyText}`;
    }

    return {
        url,
        platform,
        title: clean(title),
        rawText,
        metadata
    };
}
