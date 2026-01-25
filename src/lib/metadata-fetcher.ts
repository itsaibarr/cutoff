
export async function fetchPageMetadata(url: string): Promise<{ title?: string, description?: string, rawText?: string, error?: string }> {
    try {
        const response = await fetch(url.trim(), {
            method: 'GET',
            headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8'
            }
        });

        if (!response.ok) {
            return { error: `HTTP ${response.status}` };
        }

        const text = await response.text();

        // Simple regex extraction
        const titleMatch = text.match(/<title[^>]*>([^<]+)<\/title>/i);
        const descMatch = text.match(/<meta[^>]*name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i) ||
            text.match(/<meta[^>]*content=["']([^"']+)["'][^>]*name=["']description["'][^>]*>/i) ||
            text.match(/<meta[^>]*property=["']og:description["'][^>]*content=["']([^"']+)["'][^>]*>/i);

        // Also try get Author
        const authorMatch = text.match(/<meta[^>]*name=["']author["'][^>]*content=["']([^"']+)["'][^>]*>/i) ||
            text.match(/<link[^>]*rel=["']author["'][^>]*href=["']([^"']+)["'][^>]*>/i);

        const title = titleMatch ? decodeHTML(titleMatch[1].trim()) : undefined;
        const description = descMatch ? decodeHTML(descMatch[1].trim()) : undefined;
        const author = authorMatch ? decodeHTML(authorMatch[1].trim()) : undefined;

        // Construct a pseudo-rawText for AI
        const rawText = `
        Title: ${title || 'Unknown'}
        Author: ${author || 'Unknown'}
        Description: ${description || 'None'}
        Content Preview: ${text.slice(0, 5000).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim()}
        `;

        return {
            title,
            description,
            rawText
        };
    } catch (error) {
        console.error('Metadata fetch error:', error);
        return { error: 'Failed to fetch URL' };
    }
}

// Simple HTML entity decoder
function decodeHTML(html: string) {
    const txt = document.createElement("textarea");
    txt.innerHTML = html;
    return txt.value;
}
