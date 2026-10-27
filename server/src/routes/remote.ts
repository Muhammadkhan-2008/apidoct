import { Router } from 'express';
import type { Request, Response } from 'express';
import os from 'os';
import { getDb } from '../db/index.js';
import { loadConfig } from '../lib/config.js';

export const remoteRouter = Router();

function getLanIpAddresses(): string[] {
  const interfaces = os.networkInterfaces();
  const addresses: string[] = [];

  for (const name of Object.keys(interfaces)) {
    const list = interfaces[name];
    if (!list) continue;
    for (const iface of list) {
      // IPv4, non-internal (skip 127.0.0.1)
      if (iface.family === 'IPv4' && !iface.internal) {
        addresses.push(iface.address);
      }
    }
  }

  // Sort: prioritize 192.168.x and 10.x LAN interfaces
  return addresses.sort((a, b) => {
    if (a.startsWith('192.168.')) return -1;
    if (b.startsWith('192.168.')) return 1;
    return a.localeCompare(b);
  });
}

remoteRouter.get('/info', (_req: Request, res: Response) => {
  try {
    const config = loadConfig();
    const port = config.port || 3001;
    const ips = getLanIpAddresses();
    const lanUrls = ips.map(ip => `http://${ip}:${port}`);

    const db = getDb();
    const keysCount = (db.prepare('SELECT COUNT(*) as c FROM api_keys WHERE enabled = 1').get() as any)?.c ?? 0;
    const user = (db.prepare('SELECT email FROM users LIMIT 1').get() as any);

    res.json({
      success: true,
      port,
      primaryLanUrl: lanUrls[0] || `http://localhost:${port}`,
      lanUrls,
      localhostUrl: `http://localhost:${port}`,
      adbReverseCommand: `adb reverse tcp:${port} tcp:${port}`,
      keysCount,
      userEmail: user?.email || null,
      hostname: os.hostname(),
      platform: os.platform(),
      serverRunning: true,
    });
  } catch (err: any) {
    res.status(500).json({ error: { message: err?.message || 'Failed to get remote info' } });
  }
});
