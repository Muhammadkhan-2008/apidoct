import { Router } from 'express';
import type { Request, Response } from 'express';
import { performUnifiedWebSearch } from '../services/web-search.js';

export const searchRouter = Router();

/**
 * Unified Multi-Key Web Search Endpoint
 * POST /api/search or POST /v1/search
 */
searchRouter.post('/search', async (req: Request, res: Response) => {
  try {
    const { query, maxResults } = req.body as { query?: string; maxResults?: number };
    if (!query || typeof query !== 'string' || !query.trim()) {
      res.status(400).json({ error: { message: 'Missing required query parameter' } });
      return;
    }

    const searchData = await performUnifiedWebSearch(query.trim(), maxResults ?? 5);
    res.json(searchData);
  } catch (err: any) {
    res.status(500).json({ error: { message: err?.message ?? String(err) } });
  }
});
