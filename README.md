<div align="center">

# 🚀 ApiDoct - High-Performance Unified AI Gateway & Telemetry Dashboard

**One OpenAI & Anthropic-compatible endpoint to aggregate 40+ AI providers with 1B+ monthly token auto-routing.**

[![License: MIT](https://img.shields.io/badge/License-MIT-green.svg)](./LICENSE)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-brightgreen.svg)](https://nodejs.org/)
[![Docker](https://img.shields.io/badge/Docker-Ready-cyan.svg)](#-docker-deployment)
[![Android Termux](https://img.shields.io/badge/Termux-Supported-green.svg)](#-android-termux-installation)

[Official Website](https://apidoct.netlify.app) · [GitHub Repository](https://github.com/Muhammadkhan-2008/apidoct) · [API Documentation](#-api-endpoints-reference)

</div>

---

## 📖 Table of Contents
- [🌟 What is ApiDoct?](#-what-is-apidoct)
- [🏗️ System Architecture](#️-system-architecture)
- [🤖 Supported Providers & Models](#-supported-providers--models)
- [✨ Key Features](#-key-features)
- [🚀 Quick Start Guide](#-quick-start-guide)
- [🐳 Docker Deployment](#-docker-deployment)
- [📱 Android Termux Installation](#-android-termux-installation)
- [🛠️ API Endpoints Reference](#️-api-endpoints-reference)
- [💻 Coding Agents Integration](#-coding-agents-integration)
- [⚙️ Environment Variables Reference](#️-environment-variables-reference)
- [🔒 Security & AES-256 Vault](#-security--aes-256-vault)
- [📄 License](#-license)

---

## 🌟 What is ApiDoct?

**ApiDoct** is a self-hosted, high-performance AI API Gateway and Telemetry Dashboard that aggregates free and premium AI model tiers across **40+ providers** into a single, OpenAI and Anthropic compatible `/v1` endpoint.

Instead of managing dozens of individual API keys, rate limits, and provider SDKs, ApiDoct acts as a local intelligent proxy router:
- **Intelligent Auto-routing:** Automatically selects the best available model for your prompt.
- **Zero-Downtime Fallback:** Gracefully switches to the next active provider when one hits a rate limit or HTTP error.
- **Web Search Engine Integration:** Built-in real-time internet search capabilities (`/api/search`).
- **Telemetry & Quota Tracking:** Real-time visual tracking of **1B+ monthly free tokens**, latency, and detailed audit logs.

---

## 🏗️ System Architecture

```
┌──────────────────────────────────────────────────────────────────┐
│                   CLIENT APPLICATIONS & AGENTS                   │
│   (Claude Code, Cursor, Aider, Continue, Python, Node.js SDKs)   │
└─────────────────────────────────┬────────────────────────────────┘
                                  │ HTTP / SSE Stream
                                  ▼
┌──────────────────────────────────────────────────────────────────┐
│                      APIDOCT GATEWAY ENGINE                      │
│                          (Port 3001)                             │
│                                                                  │
│  ┌───────────────────────┐   ┌────────────────────────────────┐  │
│  │ Ingestion & Auth Gate │   │   AES-256 Encrypted SQLite Vault │  │
│  └───────────┬───────────┘   └───────────────┬────────────────┘  │
│              │                               │                   │
│              ▼                               ▼                   │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │           SMART ROUTER & FALLBACK SCORING LADDER           │  │
│  │   (Model Alias Resolution -> Key Scoring -> Auto-Fallback) │  │
│  └───────────────────────────┬────────────────────────────────┘  │
└──────────────────────────────┼───────────────────────────────────┘
                               │ HTTPS Outbound Proxy
                               ▼
┌──────────────────────────────────────────────────────────────────┐
│                    UPSTREAM AI PROVIDERS (40+)                   │
│ (DeepSeek, Google Gemini, Groq, Kimi, Zhipu, SiliconFlow, etc.)  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 🤖 Supported Providers & Models

ApiDoct natively supports **40+ AI providers** and over **300+ models**:

| Provider Name | Popular Models | Free Tier Limits | Rate Limits |
| :--- | :--- | :--- | :--- |
| **DeepSeek** | DeepSeek V3 (MoE), DeepSeek R1 | Free Promo / 12M Budget | 180 tps |
| **Google AI** | Gemini 2.5 Flash, Gemini 3.0 Pro | 1.5B+ Tokens / Month | 15 RPM • 1,500 RPD |
| **Groq** | Llama 3.3 70B, Llama 3.1 8B, Whisper | 14.4k RPD per key | 350 - 800 tps |
| **Moonshot Kimi** | Kimi K1, Kimi K3 Pro (200K Ctx) | 15M Budget | 190 tps |
| **Zhipu AI (Z.ai)** | GLM 4 Flash, GLM 5.2 Ultra | 50M Budget | 310 tps |
| **SiliconFlow** | Qwen 2.5 7B, DeepSeek R1 | 100M Free Budget | 420 tps |
| **Cerebras** | Qwen3 235B, Llama 3.3 70B | 20k RPD per key | 850 - 2,500 tps |
| **Together AI** | Llama 3.3 70B Turbo, Qwen 2.5 Coder | 20M Budget | 280 tps |
| **OpenCode Zen** | DeepSeek V4 Flash, Nemotron 70B | Free Tier Promo | 210 tps |
| **Mistral AI** | Mistral Large 3, Codestral | 14M Budget | 140 tps |

---

## ✨ Key Features

- ⚡ **Unified OpenAI / Anthropic Compatible API:** Point any coding agent (Claude Code, Cursor, Aider, Cline, Continue) or SDK to `http://localhost:3001/v1`.
- 🌐 **Live Web Search & Citations:** Enable real-time internet search for prompts directly within the gateway.
- 📊 **Telemetry & 1B+ Tokens Pool Dashboard:** Beautiful glassmorphic UI displaying consumed vs. remaining token quota, latency stats, and timestamped per-model logs.
- 🔑 **Unified Key System:** Generate and manage master API keys with rate-limiting and access permissions.
- 🔒 **Encrypted Key Vault:** Upstream keys are encrypted at rest using AES-256-GCM.
- 📱 **Cross-Platform Compatibility:** Runs on Windows, macOS, Linux, and Android (Termux).

---

## 🚀 Quick Start Guide

### Prerequisites
- **Node.js** v18.0 or higher
- **npm** v9.0 or higher

### Installation & Execution

```bash
# 1. Clone the repository
git clone https://github.com/Muhammadkhan-2008/apidoct.git
cd apidoct

# 2. Install workspace dependencies
npm install

# 3. Launch Gateway & Dashboard
npm run dev
```

Access the interfaces:
- **Dashboard UI:** `http://localhost:3001`
- **OpenAI Proxy Endpoint:** `http://localhost:3001/v1/chat/completions`

---

## 🐳 Docker Deployment

### Docker 1-Liner
```bash
docker run -d \
  --name apidoct \
  -p 3001:3001 \
  -e PORT=3001 \
  -e ENCRYPTION_KEY=e8f9a2e4c1b3f5a7e9d0c2b4a6f8e0d2c4b6a8f0e2d4c6b8a0f2e4d6c8b0a2f4 \
  --restart unless-stopped \
  ghcr.io/apidoct/apidoct:latest
```

---

## 📱 Android Termux Installation

ApiDoct runs natively on Android mobile devices via Termux:

```bash
# Update packages & install dependencies
pkg update && pkg upgrade -y
pkg install nodejs git python build-essential -y

# Clone & run
git clone https://github.com/Muhammadkhan-2008/apidoct.git
cd apidoct
npm install
npm run dev
```

---

## 🛠️ API Endpoints Reference

### 1. OpenAI Chat Completions (`POST /v1/chat/completions`)
```bash
curl http://localhost:3001/v1/chat/completions \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer apidoct-sk-local" \
  -d '{
    "model": "auto",
    "messages": [
      { "role": "user", "content": "Explain quantum computing in simple terms." }
    ],
    "temperature": 0.7,
    "stream": true
  }'
```

### 2. Anthropic Messages (`POST /v1/messages`)
```bash
curl http://localhost:3001/v1/messages \
  -H "x-api-key: apidoct-sk-local" \
  -H "anthropic-version: 2023-06-01" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "claude-3-5-sonnet",
    "max_tokens": 1024,
    "messages": [
      { "role": "user", "content": "Write a Python script to parse JSON." }
    ]
  }'
```

### 3. Real-Time Web Search (`POST /api/search`)
```bash
curl http://localhost:3001/api/search \
  -H "Content-Type: application/json" \
  -d '{ "query": "Latest AI models release 2026", "limit": 3 }'
```

---

## 💻 Coding Agents Integration

### Claude Code CLI
```bash
export ANTHROPIC_BASE_URL="http://localhost:3001/v1"
export ANTHROPIC_API_KEY="apidoct-sk-local"
claude
```

### Continue VS Code Extension (`~/.continue/config.json`)
```json
{
  "models": [
    {
      "title": "ApiDoct Auto Router",
      "provider": "openai",
      "model": "auto",
      "apiBase": "http://localhost:3001/v1",
      "apiKey": "apidoct-sk-local"
    }
  ]
}
```

---

## ⚙️ Environment Variables Reference

| Variable Name | Default Value | Description |
| :--- | :--- | :--- |
| `PORT` | `3001` | HTTP port for gateway server and dashboard UI. |
| `HOST_BIND` | `0.0.0.0` | Network binding interface (`0.0.0.0` for local network access). |
| `ENCRYPTION_KEY` | Auto-generated | 64-character hex key used to encrypt API keys in SQLite vault. |
| `APIDOCT_CONTEXT_HANDOFF` | `on_model_switch` | Mode for injecting context recaps on fallback model switches. |
| `STICKY_SESSION_TTL_MINUTES` | `30` | Minutes to pin multi-turn chat threads to the same provider. |

---

## 🔒 Security & AES-256 Vault

ApiDoct encrypts all upstream API keys at rest using **AES-256-GCM** authenticated encryption inside the local SQLite database. Keys are decrypted strictly in RAM for microseconds during request execution and are never exposed in log files or API payloads.

---

## 📜 Acknowledgements & Credits

ApiDoct is an upgraded, independent AI Gateway & Management Suite developed by **Muhammad khan** (`@Muhammadkhan-2008`). It features custom architecture enhancements including 1B+ token quota auto-routing, real-time web search engines, Clerk authentication, live telemetry, and an interactive Chatbot interface.

Special acknowledgement to **Tashfeen Ahmed** for early open-source inspiration under the MIT License.

---

## 📄 License

Distributed under the **MIT License**. See `LICENSE` for more information.
