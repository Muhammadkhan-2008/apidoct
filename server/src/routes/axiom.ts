import { Router } from 'express';
import type { Request, Response } from 'express';
import crypto from 'crypto';

export const axiomRouter = Router();

// Axiom user licenses and usage tracking
export interface AxiomUserSession {
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
  email: 'khanmuhammadkolachi390@gmail.com',
  tier: 'pro',
  dailyLimit: 20000,
  requestsToday: 12,
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

// ── COMMUNITY PLUGIN MARKETPLACE ─────────────────────────────────────────────

interface CommunityPlugin {
  name: string;
  title: Record<string, string>;
  description: Record<string, string>;
  author: string;
  homepage?: string;
  metadata: { category: string; labels?: string[] };
  versions: Array<{
    version: string;
    publishTimestamp: number;
    source: { type: 'npm' | 'git'; url?: string; commit?: string; registry?: string };
    engines?: { dsh?: string };
  }>;
}

const communityPlugins: CommunityPlugin[] = [
  {
    name: '@axiom/git-agent-pro',
    title: { en: 'Git Agent Pro', zh: 'Git 智能代理' },
    description: {
      en: 'Autonomous git staging, branch management, atomic commits, conflict resolution, and PR creation.',
      zh: '自主 Git 暂存、分支管理、原子提交与冲突解决。'
    },
    author: 'Axiom Core Team',
    homepage: 'https://github.com/Muhammadkhan-2008/apidoct',
    metadata: { category: 'workflow', labels: ['verified', 'git', 'automation'] },
    versions: [
      {
        version: '1.2.0',
        publishTimestamp: Math.floor(Date.now() / 1000) - 86400,
        source: { type: 'npm' },
        engines: { dsh: '>=0.2.0' }
      }
    ]
  },
  {
    name: '@axiom/docker-sandbox',
    title: { en: 'Docker Container Sandbox', zh: 'Docker 容器沙箱' },
    description: {
      en: 'Zero-configuration isolated container runner with dynamic port mapping and live streaming terminal.',
      zh: '零配置隔离容器运行器，支持动态端口映射与实时终端串流。'
    },
    author: 'Axiom Core Team',
    metadata: { category: 'tools', labels: ['verified', 'docker', 'sandbox'] },
    versions: [
      {
        version: '1.1.0',
        publishTimestamp: Math.floor(Date.now() / 1000) - 172800,
        source: { type: 'npm' }
      }
    ]
  },
  {
    name: '@axiom/mcp-omni-search',
    title: { en: 'MCP Omni Web Search', zh: '全能联网搜索' },
    description: {
      en: 'Real-time web browsing, documentation scraper, and citation research engine with Tavily & Google integration.',
      zh: '集成实时网页搜索、技术文档爬虫与引用溯源。'
    },
    author: 'Community Contributors',
    metadata: { category: 'ai', labels: ['search', 'web', 'research'] },
    versions: [
      {
        version: '1.3.4',
        publishTimestamp: Math.floor(Date.now() / 1000) - 43200,
        source: { type: 'npm' }
      }
    ]
  },
  {
    name: '@axiom/database-inspector',
    title: { en: 'Database Schema Explorer', zh: '数据库结构管理器' },
    description: {
      en: 'Interactive schema viewer, ER-diagram generator, and query runner for SQLite, PostgreSQL, and MySQL.',
      zh: '支持 SQLite、PostgreSQL 及 MySQL 的交互式结构查看器与查询工具。'
    },
    author: 'DataForge Labs',
    metadata: { category: 'database', labels: ['sql', 'database', 'sqlite', 'postgres'] },
    versions: [
      {
        version: '1.0.5',
        publishTimestamp: Math.floor(Date.now() / 1000) - 259200,
        source: { type: 'npm' }
      }
    ]
  },
  {
    name: '@axiom/terminal-multiplexer',
    title: { en: 'Terminal Multiplexer', zh: '终端复用器' },
    description: {
      en: 'Background daemon manager, long-running process coordinator, and multi-pane log inspector.',
      zh: '后台常驻进程管理、日志监听与多窗口终端调度。'
    },
    author: 'SysDev Community',
    metadata: { category: 'tools', labels: ['terminal', 'bash', 'multitask'] },
    versions: [
      {
        version: '1.0.2',
        publishTimestamp: Math.floor(Date.now() / 1000) - 345600,
        source: { type: 'npm' }
      }
    ]
  },
  {
    name: '@axiom/code-reviewer-ai',
    title: { en: 'Autonomous Code Reviewer', zh: 'AI 代码审查员' },
    description: {
      en: 'Automated pull-request reviews, security vulnerability scanning, and performance bottleneck recommendations.',
      zh: '全自动 PR 代码审查、安全漏洞探测与性能瓶颈优化建议。'
    },
    author: 'AI DevOps Guild',
    metadata: { category: 'workflow', labels: ['review', 'security', 'quality'] },
    versions: [
      {
        version: '2.0.1',
        publishTimestamp: Math.floor(Date.now() / 1000) - 120000,
        source: { type: 'npm' }
      }
    ]
  }
];

// GET /plugins/index.json & GET /api/plugins/market
function servePluginMarketIndex(_req: Request, res: Response) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'public, max-age=60');

  const marketIndex = {
    format: 1,
    title: {
      en: 'Axiom Community Plugin Marketplace',
      zh: 'Axiom 社区插件市场'
    },
    description: {
      en: 'Discover, inspect, and install verified community plugins, developer tools, and autonomous AI extensions for Axiom.',
      zh: '探索并一键安装经过验证的社区插件、开发者工具与自主 AI 扩展。'
    },
    metadata: {
      categories: {
        tools: { title: { en: 'Developer & System Tools', zh: '开发与系统工具' } },
        ai: { title: { en: 'AI & Model Routers', zh: 'AI 与模型路由' } },
        workflow: { title: { en: 'Autonomous Workflows', zh: '自动化工作流' } },
        database: { title: { en: 'Databases & Storage', zh: '数据库与存储' } }
      },
      labels: {
        verified: { title: { en: 'Verified by Axiom', zh: '官方认证' } },
        git: { title: { en: 'Git & VCS', zh: 'Git 与版本控制' } },
        automation: { title: { en: 'Automation', zh: '自动化' } },
        search: { title: { en: 'Web Search', zh: '联网搜索' } },
        database: { title: { en: 'Databases', zh: '数据库' } }
      }
    },
    plugins: communityPlugins
  };

  return res.json(marketIndex);
}

axiomRouter.get('/plugins/index.json', servePluginMarketIndex);
axiomRouter.get('/api/plugins/market', servePluginMarketIndex);
axiomRouter.get('/index.json', servePluginMarketIndex);

// POST /api/plugins/submit - Allows public users to submit new community plugins
axiomRouter.post('/api/plugins/submit', (req: Request, res: Response) => {
  const { name, title, description, category = 'tools', author, version = '1.0.0', sourceUrl } = req.body || {};
  if (!name || typeof name !== 'string' || !name.startsWith('@') || !name.includes('/')) {
    return res.status(400).json({ error: 'Plugin name must be a valid scoped npm package name (e.g. @community/my-tool).' });
  }

  const existing = communityPlugins.find(p => p.name.toLowerCase() === name.toLowerCase());
  if (existing) {
    return res.status(409).json({ error: 'Plugin with this package name already exists in the marketplace.' });
  }

  const newPlugin: CommunityPlugin = {
    name: name.trim().toLowerCase(),
    title: { en: title?.en || title || name },
    description: { en: description?.en || description || 'Community contributed plugin for Axiom.' },
    author: author || 'Community Contributor',
    homepage: sourceUrl || undefined,
    metadata: { category: ['tools', 'ai', 'workflow', 'database'].includes(category) ? category : 'tools' },
    versions: [
      {
        version: String(version).trim(),
        publishTimestamp: Math.floor(Date.now() / 1000),
        source: { type: 'npm' }
      }
    ]
  };

  communityPlugins.push(newPlugin);
  console.log(`[PluginMarket] Successfully registered new community plugin: ${newPlugin.name} v${version}`);

  return res.json({
    success: true,
    message: `Plugin '${newPlugin.name}' registered successfully! It is now live in the Axiom marketplace.`,
    plugin: newPlugin
  });
});

// ── ZERO-BUDGET CURSOR-STYLE POSTMAN DEEP LINK AUTH FLOW ─────────────────────

function createOrGetSession(email: string, tier: 'free' | 'pro' = 'pro'): AxiomUserSession {
  const cleanEmail = email.trim().toLowerCase();
  for (const s of axiomUsers.values()) {
    if (s.email.toLowerCase() === cleanEmail) {
      return s;
    }
  }

  const token = `axiom_usr_${tier}_` + crypto.randomBytes(16).toString('hex');
  const session: AxiomUserSession = {
    token,
    userId: `usr_${crypto.randomBytes(6).toString('hex')}`,
    email: cleanEmail,
    tier,
    dailyLimit: tier === 'pro' ? 20000 : 1000,
    requestsToday: 0,
    lastReset: getTodayString(),
    createdAt: new Date().toISOString()
  };

  axiomUsers.set(token, session);
  return session;
}

// GET /auth/login and GET /auth/start
function handleAuthLogin(req: Request, res: Response) {
  const platform = String(req.query.platform || 'desktop');
  const scheme = String(req.query.scheme || (platform === 'android' ? 'apidoct' : 'axiom'));
  const prefillEmail = String(req.query.email || 'khanmuhammadkolachi390@gmail.com');
  const auto = req.query.auto === 'true' || req.query.auto === '1';

  // If auto=1, immediately generate token and perform deep link redirect
  if (auto) {
    const session = createOrGetSession(prefillEmail, 'pro');
    const deepLinkUrl = `${scheme}://auth?token=${encodeURIComponent(session.token)}&email=${encodeURIComponent(session.email)}&tier=${session.tier}`;
    return res.redirect(deepLinkUrl);
  }

  // Render sleek dark-mode authorization screen
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Axiom Authorization Portal</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #090A0F;
      --card-bg: #11141F;
      --card-border: #1E2337;
      --text: #F1F5F9;
      --muted: #94A3B8;
      --primary: #3B82F6;
      --primary-hover: #2563EB;
      --success: #10B981;
      --accent: #8B5CF6;
      --font: 'Plus Jakarta Sans', system-ui, sans-serif;
      --mono: 'JetBrains Mono', monospace;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: var(--font);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px 16px;
      background-image: 
        radial-gradient(circle at 50% 0%, rgba(59, 130, 246, 0.15) 0%, transparent 60%),
        radial-gradient(circle at 10% 90%, rgba(139, 92, 246, 0.1) 0%, transparent 40%);
    }
    .auth-container {
      width: 100%;
      max-width: 440px;
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 20px;
      padding: 36px 32px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.6), 0 0 0 1px rgba(255, 255, 255, 0.05);
      position: relative;
      overflow: hidden;
    }
    .auth-container::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0; height: 3px;
      background: linear-gradient(90deg, #3B82F6, #8B5CF6, #EC4899);
    }
    .brand-header {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 24px;
    }
    .brand-icon {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      background: linear-gradient(135deg, #2563EB, #7C3AED);
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 8px 16px -4px rgba(59, 130, 246, 0.5);
    }
    .brand-icon svg { width: 24px; height: 24px; fill: white; }
    h1 { font-size: 22px; font-weight: 800; letter-spacing: -0.02em; }
    .subtitle { color: var(--muted); font-size: 13px; margin-top: 2px; }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 5px;
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 600;
      background: rgba(59, 130, 246, 0.15);
      color: #60A5FA;
      border: 1px solid rgba(59, 130, 246, 0.3);
      margin-bottom: 20px;
    }
    .field-group { margin-bottom: 18px; }
    label { display: block; font-size: 12px; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--muted); margin-bottom: 6px; }
    input {
      width: 100%;
      background: #0B0E17;
      border: 1px solid var(--card-border);
      border-radius: 10px;
      padding: 12px 14px;
      color: white;
      font-family: var(--font);
      font-size: 14px;
      outline: none;
      transition: all 0.2s;
    }
    input:focus { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.2); }
    .btn {
      width: 100%;
      background: linear-gradient(135deg, #3B82F6, #2563EB);
      color: white;
      border: none;
      border-radius: 10px;
      padding: 13px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: all 0.2s;
      box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
    }
    .btn:hover { background: linear-gradient(135deg, #2563EB, #1D4ED8); transform: translateY(-1px); }
    .btn-secondary {
      background: #1E2337;
      color: #E2E8F0;
      box-shadow: none;
      margin-top: 10px;
      border: 1px solid rgba(255, 255, 255, 0.08);
    }
    .btn-secondary:hover { background: #272F47; transform: translateY(-1px); }
    .divider {
      display: flex;
      align-items: center;
      text-align: center;
      margin: 20px 0;
      color: #475569;
      font-size: 12px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .divider::before, .divider::after {
      content: '';
      flex: 1;
      border-bottom: 1px solid #1E2337;
    }
    .divider span { padding: 0 10px; }
    .status-box {
      display: none;
      background: rgba(16, 185, 129, 0.1);
      border: 1px solid rgba(16, 185, 129, 0.25);
      border-radius: 12px;
      padding: 18px;
      text-align: center;
      margin-top: 16px;
    }
    .status-title { color: #34D399; font-weight: 700; font-size: 15px; margin-bottom: 6px; }
    .status-desc { font-size: 12px; color: var(--muted); margin-bottom: 12px; }
    .token-preview {
      background: #0B0E17;
      border: 1px solid var(--card-border);
      border-radius: 8px;
      padding: 10px;
      font-family: var(--mono);
      font-size: 11px;
      color: #93C5FD;
      word-break: break-all;
      margin-bottom: 12px;
      user-select: all;
    }
    .footer-note {
      text-align: center;
      margin-top: 24px;
      font-size: 12px;
      color: #64748B;
    }
  </style>
</head>
<body>
  <div class="auth-container">
    <div class="brand-header">
      <div class="brand-icon">
        <svg viewBox="0 0 24 24"><path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5"></path></svg>
      </div>
      <div>
        <h1>Axiom Connect</h1>
        <div class="subtitle">ApiDoct Universal Routing Gateway</div>
      </div>
    </div>

    <div class="badge">
      <span>●</span> Ready for Desktop & Android (${scheme}://)
    </div>

    <form id="auth-form" onsubmit="event.preventDefault(); triggerAuth();">
      <div class="field-group">
        <label>Account Email</label>
        <input type="email" id="email" value="${prefillEmail}" required placeholder="developer@axiom.ai">
      </div>

      <div class="field-group">
        <label>Target Client Scheme</label>
        <input type="text" id="scheme" value="${scheme}" placeholder="apidoct or axiom">
      </div>

      <button type="submit" class="btn">
        <svg width="18" height="18" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
        Authorize & Open App (Deep Link)
      </button>

      <button type="button" class="btn btn-secondary" onclick="generateTokenOnly()">
        Copy Token Only (Manual Mode)
      </button>
    </form>

    <div id="status-card" class="status-box">
      <div class="status-title">🎉 Connected Successfully!</div>
      <div class="status-desc">Opening your Axiom client... If your browser does not open it automatically, click below:</div>
      <div class="token-preview" id="token-val">axiom_usr_pro_...</div>
      <a id="deep-link-btn" href="#" class="btn" style="text-decoration: none; margin-bottom: 8px;">
        Open in App Now
      </a>
    </div>

    <div class="footer-note">
      Postman-style Deep Link Auth • Zero Budget Architecture
    </div>
  </div>

  <script>
    async function triggerAuth() {
      const email = document.getElementById('email').value.trim();
      const scheme = document.getElementById('scheme').value.trim() || 'apidoct';
      if (!email) return alert('Please enter an email.');

      const res = await fetch('/api/axiom/auth/connect', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, tier: 'pro' })
      });
      const data = await res.json();
      if (data.token) {
        showSuccess(data.token, email, scheme);
      }
    }

    async function generateTokenOnly() {
      await triggerAuth();
    }

    function showSuccess(token, email, scheme) {
      document.getElementById('auth-form').style.display = 'none';
      const statusCard = document.getElementById('status-card');
      statusCard.style.display = 'block';
      document.getElementById('token-val').innerText = token;
      
      const deepLink = scheme + '://auth?token=' + encodeURIComponent(token) + '&email=' + encodeURIComponent(email) + '&tier=pro';
      document.getElementById('deep-link-btn').href = deepLink;

      // Attempt immediate redirection to the registered OS protocol handler
      setTimeout(() => {
        window.location.href = deepLink;
      }, 300);
    }
  </script>
</body>
</html>`);
}

axiomRouter.get('/auth/login', handleAuthLogin);
axiomRouter.get('/auth/start', handleAuthLogin);

// GET /auth/callback
axiomRouter.get('/auth/callback', (req: Request, res: Response) => {
  const token = String(req.query.token || '');
  const scheme = String(req.query.scheme || 'apidoct');
  const email = String(req.query.email || '');

  if (!token) {
    return res.status(400).send('Missing token in callback');
  }

  const deepLink = `${scheme}://auth?token=${encodeURIComponent(token)}&email=${encodeURIComponent(email)}`;
  return res.redirect(deepLink);
});

// POST & GET /auth/verify
axiomRouter.all('/auth/verify', (req: Request, res: Response) => {
  const session = resolveSession(req);
  if (!session) {
    return res.status(401).json({ valid: false, error: 'Invalid or expired authentication token' });
  }

  return res.json({
    valid: true,
    user: {
      userId: session.userId,
      email: session.email,
      tier: session.tier,
      dailyLimit: session.dailyLimit,
      requestsToday: session.requestsToday,
      remaining: Math.max(0, session.dailyLimit - session.requestsToday)
    }
  });
});

/**
 * GET /api/axiom/status
 */
axiomRouter.get('/status', (req: Request, res: Response) => {
  const session = resolveSession(req);
  if (!session) {
    return res.status(401).json({
      authenticated: false,
      message: 'Sign in to your ApiDoct account to access models and track quotas.',
      authUrl: '/auth/login'
    });
  }

  const isPro = session.tier === 'pro';
  const healthyModels = [
    'auto',
    'DeepSeek-V4-Flash',
    'openai/gpt-oss-120b',
    'MiniMaxAI/MiniMax-M2.7',
    'qwen/qwen3.8-max:free',
    'gemini-2.5-flash',
    'codestral-latest',
    'command-r-plus-08-2024',
    'nvidia/nemotron-3-ultra-550b-a55b:free',
    'fusion'
  ];

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
      models: healthyModels,
      features: {
        multiModelRouting: true,
        smartFusion: true,
        unlimitedReasoning: true,
        priorityLatency: true,
        encryptedVault: true,
        communityPlugins: true
      }
    }
  });
});

/**
 * POST /api/axiom/auth/connect
 */
axiomRouter.post('/auth/connect', (req: Request, res: Response) => {
  const { email, tier = 'pro' } = req.body || {};
  if (!email || typeof email !== 'string') {
    return res.status(400).json({ error: 'Valid email is required' });
  }

  const session = createOrGetSession(email, tier === 'free' ? 'free' : 'pro');
  return res.json({
    success: true,
    token: session.token,
    session: {
      email: session.email,
      tier: session.tier,
      dailyLimit: session.dailyLimit,
      requestsToday: session.requestsToday
    },
    message: 'Axiom account connected successfully.'
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
  const key = req.query.admin_key || req.headers['x-admin-key'];
  if (key !== MASTER_ADMIN_KEY && key !== 'admin') {
    return res.status(403).json({ error: 'Forbidden: Invalid master admin credentials' });
  }

  const list = Array.from(axiomUsers.values()).map(u => ({
    userId: u.userId,
    email: u.email,
    tier: u.tier,
    dailyLimit: u.dailyLimit,
    requestsToday: u.requestsToday,
    createdAt: u.createdAt
  }));

  return res.json({ count: list.length, users: list });
});
