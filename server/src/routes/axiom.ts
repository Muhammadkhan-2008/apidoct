import { Router } from 'express';
import type { Request, Response } from 'express';
import crypto from 'crypto';

export const axiomRouter = Router();

// Axiom user licenses and usage tracking
interface AxiomUserSession {
  token: string;
  userId: string;
  email: string;
  tier: 'free' | 'pro';
  dailyLimit: number;
  requestsToday: number;
  lastReset: string;
  createdAt: string;
}

const axiomUsers = new Map<string, AxiomUserSession>();

// Master Admin Key
export const MASTER_ADMIN_KEY = 'axiom_admin_master_secret_' + crypto.createHash('sha256').update('apidoct-admin').digest('hex').slice(0, 16);

// Initialize default demo / root user
const DEFAULT_AXIOM_TOKEN = 'axiom_live_pro_master_default';
axiomUsers.set(DEFAULT_AXIOM_TOKEN, {
  token: DEFAULT_AXIOM_TOKEN,
  userId: 'usr_axiom_master',
  email: 'admin@axiom.ai',
  tier: 'pro',
  dailyLimit: 10000,
  requestsToday: 42,
  lastReset: new Date().toISOString().slice(0, 10),
  createdAt: new Date().toISOString(),
});

function getTodayString(): string {
  return new Date().toISOString().slice(0, 10);
}

function resolveSession(req: Request): AxiomUserSession | null {
  const auth = req.headers.authorization?.replace(/^Bearer\s+/i, '') || 
               (req.headers['x-axiom-token'] as string) ||
               (req.query.token as string);

  if (!auth) {
    return axiomUsers.get(DEFAULT_AXIOM_TOKEN) || null;
  }

  const session = axiomUsers.get(auth);
  if (session) {
    const today = getTodayString();
    if (session.lastReset !== today) {
      session.requestsToday = 0;
      session.lastReset = today;
    }
    return session;
  }
  return null;
}

/**
 * GET /api/axiom/status
 */
axiomRouter.get('/status', (req: Request, res: Response) => {
  const session = resolveSession(req);
  if (!session) {
    return res.status(401).json({
      authenticated: false,
      message: 'Sign in to your ApiDoct account to access models and track quotas.',
      authUrl: '/console'
    });
  }

  const isPro = session.tier === 'pro';
  const freeModels = ['auto', 'gemini-2.5-flash', 'llama-3.3-70b-versatile', 'mistral-small-latest'];
  const proModels = [...freeModels, 'fusion', 'deepseek-v4-pro', 'kimi-k3-pro', 'claude-3-7-sonnet', 'gpt-4o'];

  return res.json({
    authenticated: true,
    user: {
      userId: session.userId,
      email: session.email,
      tier: session.tier,
      tierLabel: isPro ? 'Axiom Pro Tier' : 'Axiom Free Tier',
      quota: {
        dailyLimit: session.dailyLimit,
        requestsToday: session.requestsToday,
        remaining: Math.max(0, session.dailyLimit - session.requestsToday),
        resetDate: session.lastReset
      },
      models: isPro ? proModels : freeModels,
      features: {
        multiModelRouting: true,
        smartFusion: isPro,
        unlimitedReasoning: isPro,
        priorityLatency: isPro,
        encryptedVault: true
      }
    }
  });
});

/**
 * POST /api/axiom/auth/connect
 */
axiomRouter.post('/auth/connect', (req: Request, res: Response) => {
  const { email, tier = 'free' } = req.body || {};
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Valid email is required' });
  }

  const cleanEmail = email.trim().toLowerCase();
  // Find existing session by email
  for (const s of axiomUsers.values()) {
    if (s.email.toLowerCase() === cleanEmail) {
      return res.json({
        success: true,
        token: s.token,
        session: {
          email: s.email,
          tier: s.tier,
          dailyLimit: s.dailyLimit,
          requestsToday: s.requestsToday
        },
        message: 'Existing Axiom account connected.'
      });
    }
  }

  const userTier = tier === 'pro' ? 'pro' : 'free';
  const token = `axiom_usr_${userTier}_` + crypto.randomBytes(16).toString('hex');
  const session: AxiomUserSession = {
    token,
    userId: `usr_${crypto.randomBytes(6).toString('hex')}`,
    email: cleanEmail,
    tier: userTier,
    dailyLimit: userTier === 'pro' ? 10000 : 500,
    requestsToday: 0,
    lastReset: getTodayString(),
    createdAt: new Date().toISOString()
  };

  axiomUsers.set(token, session);

  return res.json({
    success: true,
    token,
    session: {
      email: session.email,
      tier: session.tier,
      dailyLimit: session.dailyLimit,
      requestsToday: 0
    },
    message: 'New Axiom account created successfully.'
  });
});

/**
 * POST /api/axiom/track
 */
axiomRouter.post('/track', (req: Request, res: Response) => {
  const session = resolveSession(req);
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized Axiom session' });
  }

  session.requestsToday += 1;
  return res.json({
    tracked: true,
    requestsToday: session.requestsToday,
    remaining: Math.max(0, session.dailyLimit - session.requestsToday)
  });
});

/**
 * GET /api/axiom/admin/users
 */
axiomRouter.get('/admin/users', (req: Request, res: Response) => {
  const adminKey = req.headers['x-admin-key'] || req.query.admin_key;
  if (adminKey !== MASTER_ADMIN_KEY && adminKey !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: Invalid Admin Key' });
  }

  const list = Array.from(axiomUsers.values()).map(u => ({
    userId: u.userId,
    email: u.email,
    tier: u.tier,
    dailyLimit: u.dailyLimit,
    requestsToday: u.requestsToday,
    token: u.token,
    createdAt: u.createdAt
  }));

  return res.json({
    totalUsers: list.length,
    users: list
  });
});

/**
 * POST /api/axiom/admin/upgrade
 */
axiomRouter.post('/admin/upgrade', (req: Request, res: Response) => {
  const adminKey = req.headers['x-admin-key'] || req.body?.admin_key;
  if (adminKey !== MASTER_ADMIN_KEY && adminKey !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: Invalid Admin Key' });
  }

  const { email, tier } = req.body || {};
  if (!email || !tier || (tier !== 'free' && tier !== 'pro')) {
    return res.status(400).json({ error: 'Valid email and tier (free/pro) required' });
  }

  for (const session of axiomUsers.values()) {
    if (session.email.toLowerCase() === email.trim().toLowerCase()) {
      session.tier = tier;
      session.dailyLimit = tier === 'pro' ? 10000 : 500;
      return res.json({
        success: true,
        message: `User ${email} upgraded to ${tier.toUpperCase()}`,
        session
      });
    }
  }

  return res.status(404).json({ error: `User with email ${email} not found` });
});

/**
 * GET /console (or /api/axiom/portal)
 * Interactive Web Dashboard for Users & Admin
 */
axiomRouter.get('/portal', (_req: Request, res: Response) => {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Axiom & ApiDoct — Cloud Control Center</title>
  <style>
    :root {
      --bg: #0A0E17;
      --card: #111827;
      --border: #1F2937;
      --cyan: #00E5FF;
      --blue: #0066FF;
      --text: #F9FAFB;
      --muted: #9CA3AF;
      --green: #10B981;
      --pro-gold: #F59E0B;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; }
    body { background: var(--bg); color: var(--text); padding: 24px 16px; min-height: 100vh; }
    .container { max-width: 900px; margin: 0 auto; }
    .header { display: flex; align-items: center; justify-content: space-between; padding-bottom: 24px; border-bottom: 1px solid var(--border); margin-bottom: 32px; }
    .brand { display: flex; align-items: center; gap: 12px; }
    .delta { width: 36px; height: 36px; background: linear-gradient(135deg, var(--cyan), var(--blue)); clip-path: polygon(50% 0%, 0% 100%, 100% 100%); display: inline-block; }
    h1 { font-size: 24px; font-weight: 800; letter-spacing: -0.5px; }
    .badge { font-size: 11px; font-weight: 700; text-transform: uppercase; padding: 4px 8px; border-radius: 6px; background: rgba(0, 229, 255, 0.15); color: var(--cyan); border: 1px solid rgba(0, 229, 255, 0.3); }
    .tabs { display: flex; gap: 8px; margin-bottom: 24px; }
    .tab { padding: 10px 18px; border-radius: 8px; background: var(--card); border: 1px solid var(--border); color: var(--muted); cursor: pointer; font-size: 14px; font-weight: 600; transition: all 0.2s; }
    .tab.active { background: linear-gradient(135deg, rgba(0, 229, 255, 0.2), rgba(0, 102, 255, 0.2)); color: var(--cyan); border-color: var(--cyan); }
    .card { background: var(--card); border: 1px solid var(--border); border-radius: 12px; padding: 24px; margin-bottom: 24px; }
    .card h2 { font-size: 18px; margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between; }
    input { width: 100%; padding: 12px 14px; background: #06090F; border: 1px solid var(--border); border-radius: 8px; color: #fff; font-size: 14px; margin-bottom: 16px; outline: none; }
    input:focus { border-color: var(--cyan); }
    button { background: linear-gradient(135deg, var(--cyan), var(--blue)); border: none; color: #000; font-weight: 700; padding: 12px 20px; border-radius: 8px; cursor: pointer; font-size: 14px; transition: opacity 0.2s; }
    button:hover { opacity: 0.9; }
    .meter { height: 10px; background: #1F2937; border-radius: 5px; overflow: hidden; margin: 12px 0 6px 0; }
    .meter-fill { height: 100%; background: linear-gradient(90deg, var(--cyan), var(--blue)); width: 10%; }
    .token-box { background: #06090F; border: 1px dashed var(--border); border-radius: 8px; padding: 14px; font-family: monospace; font-size: 13px; color: var(--cyan); word-break: break-all; margin: 12px 0; display: flex; justify-content: space-between; align-items: center; }
    .copy-btn { background: #1F2937; color: #fff; font-size: 12px; padding: 6px 12px; border-radius: 6px; }
    .tag { display: inline-block; padding: 3px 8px; border-radius: 4px; font-size: 11px; margin-right: 6px; margin-bottom: 6px; background: #1F2937; color: #E5E7EB; }
    .pro-tag { background: rgba(245, 158, 11, 0.2); color: var(--pro-gold); border: 1px solid rgba(245, 158, 11, 0.3); }
    table { width: 100%; border-collapse: collapse; margin-top: 12px; font-size: 13px; }
    th, td { text-align: left; padding: 10px 12px; border-bottom: 1px solid var(--border); }
    th { color: var(--muted); font-size: 11px; text-transform: uppercase; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <div class="brand">
        <div class="delta"></div>
        <div>
          <h1>Axiom & ApiDoct</h1>
          <p style="font-size: 12px; color: var(--muted);">Unified AI Gateway & Autonomous Agent Console</p>
        </div>
      </div>
      <span class="badge">Live Production</span>
    </div>

    <div class="tabs">
      <div class="tab active" onclick="switchTab('user')">User Console</div>
      <div class="tab" onclick="switchTab('admin')">Master Admin Room</div>
    </div>

    <!-- USER TAB -->
    <div id="user-view">
      <div class="card">
        <h2>Connect Your Axiom Account <span id="user-tier-badge" class="badge">Free Tier</span></h2>
        <p style="font-size: 13px; color: var(--muted); margin-bottom: 16px;">
          Enter your email to generate or retrieve your authenticated Axiom IDE License Token.
        </p>
        <div style="display: flex; gap: 8px;">
          <input type="email" id="email-input" placeholder="Enter your email (e.g. user@axiom.ai)" value="admin@axiom.ai" style="margin-bottom: 0;">
          <button onclick="connectAccount()">Connect</button>
        </div>
      </div>

      <div class="card" id="account-details">
        <h2>Your Axiom License Token</h2>
        <p style="font-size: 13px; color: var(--muted);">
          Paste this token inside Axiom IDE (or launch Axiom with this token) to activate models & track quotas.
        </p>
        <div class="token-box">
          <span id="active-token">axiom_live_pro_master_default</span>
          <button class="copy-btn" onclick="copyToken()">Copy Token</button>
        </div>

        <h3 style="font-size: 14px; margin-top: 20px; color: var(--muted);">Daily Requests Quota</h3>
        <div class="meter"><div class="meter-fill" id="quota-fill" style="width: 1%;"></div></div>
        <div style="display: flex; justify-content: space-between; font-size: 12px; color: var(--muted);">
          <span>Used Today: <strong id="used-count" style="color: #fff;">42</strong></span>
          <span>Remaining: <strong id="remaining-count" style="color: var(--cyan);">9958</strong> / <span id="limit-count">10000</span></span>
        </div>

        <h3 style="font-size: 14px; margin-top: 24px; color: var(--muted); margin-bottom: 8px;">Active Model Fleet</h3>
        <div id="model-list">
          <span class="tag">auto (smart router)</span>
          <span class="tag">gemini-2.5-flash</span>
          <span class="tag">llama-3.3-70b-versatile</span>
          <span class="tag pro-tag">fusion (multi-model)</span>
          <span class="tag pro-tag">deepseek-v4-pro</span>
          <span class="tag pro-tag">kimi-k3-pro</span>
          <span class="tag pro-tag">claude-3-7-sonnet</span>
        </div>
      </div>
    </div>

    <!-- ADMIN TAB -->
    <div id="admin-view" style="display: none;">
      <div class="card">
        <h2>Admin Authentication</h2>
        <p style="font-size: 13px; color: var(--muted); margin-bottom: 12px;">Enter Master Admin Key to manage users, plans, and API vaults.</p>
        <div style="display: flex; gap: 8px;">
          <input type="password" id="admin-key" placeholder="Enter Admin Secret" value="admin" style="margin-bottom: 0;">
          <button onclick="loadAdminUsers()">Load Users</button>
        </div>
      </div>

      <div class="card">
        <h2>Registered Client Accounts</h2>
        <table>
          <thead>
            <tr>
              <th>User Email</th>
              <th>Tier</th>
              <th>Requests Today</th>
              <th>Daily Limit</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody id="users-tbody">
            <tr>
              <td>admin@axiom.ai</td>
              <td><span class="badge" style="background: rgba(245,158,11,0.2); color: #F59E0B;">PRO</span></td>
              <td>42</td>
              <td>10,000</td>
              <td><span style="color: var(--muted); font-size: 11px;">Master</span></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>

  <script>
    function switchTab(t) {
      document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
      if (t === 'user') {
        document.querySelectorAll('.tab')[0].classList.add('active');
        document.getElementById('user-view').style.display = 'block';
        document.getElementById('admin-view').style.display = 'none';
      } else {
        document.querySelectorAll('.tab')[1].classList.add('active');
        document.getElementById('user-view').style.display = 'none';
        document.getElementById('admin-view').style.display = 'block';
        loadAdminUsers();
      }
    }

    async function connectAccount() {
      const email = document.getElementById('email-input').value;
      if (!email) return alert('Enter email');
      const res = await fetch('/api/axiom/auth/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      if (data.token) {
        document.getElementById('active-token').innerText = data.token;
        document.getElementById('user-tier-badge').innerText = data.session.tier.toUpperCase() + ' TIER';
        document.getElementById('limit-count').innerText = data.session.dailyLimit;
        alert('Account Connected! Token generated.');
      }
    }

    function copyToken() {
      const t = document.getElementById('active-token').innerText;
      navigator.clipboard.writeText(t);
      alert('License Token Copied to Clipboard!');
    }

    async function loadAdminUsers() {
      const k = document.getElementById('admin-key').value;
      try {
        const res = await fetch('/api/axiom/admin/users?admin_key=' + encodeURIComponent(k));
        const data = await res.json();
        if (data.users) {
          const tbody = document.getElementById('users-tbody');
          tbody.innerHTML = '';
          data.users.forEach(u => {
            const tr = document.createElement('tr');
            tr.innerHTML = \`
              <td>\${u.email}</td>
              <td><span class="badge" style="\${u.tier === 'pro' ? 'background: rgba(245,158,11,0.2); color: #F59E0B;' : ''}">\${u.tier.toUpperCase()}</span></td>
              <td>\${u.requestsToday}</td>
              <td>\${u.dailyLimit}</td>
              <td>
                <button style="padding: 4px 8px; font-size: 11px;" onclick="upgradeUser('\${u.email}', '\${u.tier === 'pro' ? 'free' : 'pro'}')">
                  \${u.tier === 'pro' ? 'Downgrade' : 'Upgrade to PRO'}
                </button>
              </td>
            \`;
            tbody.appendChild(tr);
          });
        }
      } catch (e) {
        console.error(e);
      }
    }

    async function upgradeUser(email, tier) {
      const k = document.getElementById('admin-key').value;
      const res = await fetch('/api/axiom/admin/upgrade', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, tier, admin_key: k })
      });
      const data = await res.json();
      if (data.success) {
        alert(data.message);
        loadAdminUsers();
      } else {
        alert(data.error || 'Failed to update');
      }
    }
  </script>
</body>
</html>`);
});
