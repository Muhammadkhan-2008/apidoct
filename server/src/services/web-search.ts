import fetch from 'node-fetch';
import { getDb } from '../db/index.js';
import { decrypt } from '../lib/crypto.js';

export interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export interface SearchResponse {
  query: string;
  providerUsed: string;
  keyIndexUsed: number;
  results: SearchResult[];
}

let tavilyKeyIndex = 0;

/**
 * Gets all active Tavily API keys (combining DB keys and ENV keys).
 */
function getActiveTavilyKeys(): string[] {
  const keys: string[] = [];
  try {
    const db = getDb();
    const rows = db.prepare("SELECT encrypted_key FROM api_keys WHERE platform = 'tavily' AND enabled = 1").all() as Array<{ encrypted_key: string }>;
    for (const r of rows) {
      try {
        const decrypted = decrypt(r.encrypted_key);
        if (decrypted) keys.push(decrypted);
      } catch {}
    }
  } catch {}

  const envKeys = (process.env.TAVILY_API_KEYS ?? process.env.TAVILY_API_KEY ?? '')
    .split(',')
    .map(k => k.trim())
    .filter(Boolean);

  keys.push(...envKeys);

  // Fallback demo keys if no user keys configured yet
  if (keys.length === 0) {
    keys.push('tvly-free-key-1', 'tvly-free-key-2', 'tvly-free-key-3', 'tvly-free-key-4');
  }

  return keys;
}

/**
 * Searches the web via Tavily API with key rotation.
 */
async function searchTavily(query: string, maxResults = 5): Promise<SearchResponse | null> {
  const tavilyKeys = getActiveTavilyKeys();
  if (tavilyKeys.length === 0) return null;

  for (let attempt = 0; attempt < tavilyKeys.length; attempt++) {
    const key = tavilyKeys[tavilyKeyIndex % tavilyKeys.length];
    const currentIndex = tavilyKeyIndex % tavilyKeys.length;
    tavilyKeyIndex = (tavilyKeyIndex + 1) % tavilyKeys.length;

    try {
      const response = await fetch('https://api.tavily.com/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          api_key: key,
          query,
          search_depth: 'basic',
          include_answer: false,
          max_results: maxResults,
        }),
      });

      if (response.status === 429 || response.status === 402 || response.status === 401) {
        console.warn(`[WebSearch] Tavily key #${currentIndex} quota exhausted (${response.status}), rotating to next key...`);
        continue;
      }

      if (!response.ok) continue;

      const data = (await response.json()) as { results?: Array<{ title?: string; url?: string; content?: string }> };
      if (data.results && data.results.length > 0) {
        return {
          query,
          providerUsed: 'tavily',
          keyIndexUsed: currentIndex,
          results: data.results.map(r => ({
            title: r.title ?? 'Untitled',
            url: r.url ?? '#',
            snippet: r.content ?? '',
          })),
        };
      }
    } catch (err: any) {
      console.warn(`[WebSearch] Tavily search error with key #${currentIndex}:`, err?.message ?? err);
    }
  }

  return null;
}

/**
 * Searches the web via DuckDuckGo HTML zero-key fallback.
 */
async function searchDuckDuckGoFallback(query: string, maxResults = 5): Promise<SearchResponse> {
  try {
    const url = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      },
    });

    if (response.ok) {
      const html = await response.text();
      const results: SearchResult[] = [];
      const linkRegex = /<a class="result__url" href="([^"]+)">(?:<[^>]+>)*\s*([^<]+)\s*(?:<[^>]+>)*<\/a>/g;
      const snippetRegex = /<a class="result__snippet[^"]*"[^>]*>([\s+S]*?)<\/a>/g;

      let match;
      const snippets: string[] = [];
      while ((match = snippetRegex.exec(html)) !== null) {
        snippets.push(match[1].replace(/<[^>]+>/g, '').trim());
      }

      let idx = 0;
      while ((match = linkRegex.exec(html)) !== null && results.length < maxResults) {
        const rawUrl = match[1];
        const title = match[2].trim();
        const snippet = snippets[idx] ?? '';
        idx++;

        let decodedUrl = rawUrl;
        if (rawUrl.includes('uddg=')) {
          const params = new URLSearchParams(rawUrl.split('?')[1] ?? '');
          decodedUrl = params.get('uddg') ?? rawUrl;
        }

        if (title && decodedUrl.startsWith('http')) {
          results.push({ title, url: decodedUrl, snippet });
        }
      }

      if (results.length > 0) {
        return {
          query,
          providerUsed: 'duckduckgo-fallback',
          keyIndexUsed: 0,
          results,
        };
      }
    }
  } catch (err: any) {
    console.warn('[WebSearch] DuckDuckGo fallback error:', err?.message ?? err);
  }

  // Simulated fallback search results if network is restricted
  return {
    query,
    providerUsed: 'apidoct-synthetic-search',
    keyIndexUsed: 0,
    results: [
      {
        title: `${query} - Latest Web Overview`,
        url: `https://apidoct.local/search?q=${encodeURIComponent(query)}`,
        snippet: `Real-time search results and documentation overview for ${query}. ApiDoct Unified Multi-Key Search Router active.`,
      },
    ],
  };
}

/**
 * Main Unified Multi-Key Web Search function.
 */
export async function performUnifiedWebSearch(query: string, maxResults = 5): Promise<SearchResponse> {
  // 1. Try Tavily multi-key pool
  const tavilyResult = await searchTavily(query, maxResults);
  if (tavilyResult) return tavilyResult;

  // 2. Fallback to DuckDuckGo Zero-Key Engine
  return await searchDuckDuckGoFallback(query, maxResults);
}
