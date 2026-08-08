# ApiDoct AI Gateway — Android (Termux & PRoot) Installation

> **Rooted & Non-Rooted Android Compatibility**: ApiDoct runs natively on Android via Termux using Node.js's zero-dependency `node:sqlite` driver without requiring NDK tools or root privileges.

---

## 📱 Quick Termux Setup (Non-Rooted & Rooted)

### 1. Requirements
- **Android 7.0+** (Rooted or Non-Rooted)
- **[Termux from F-Droid](https://f-droid.org/packages/com.termux/)** (Do not use Google Play Store build)
- **Node.js 22.13+** (Node 24 LTS recommended)

---

### 2. Install Packages in Termux

Open Termux and update packages:

```bash
pkg update && pkg upgrade -y
pkg install -y nodejs-lts git termux-api
```

Verify Node version (must be `22.13.0` or newer):
```bash
node -v
```

---

### 3. Clone & Launch ApiDoct

```bash
git clone https://github.com/apidoct/apidoct.git
cd apidoct
npm install --no-audit --no-fund
npm run dev
```

The gateway server starts at `http://localhost:3001` and the Mobile Dashboard opens at `http://localhost:5173`.

---

## 🐧 Running Claude Code inside Termux PRoot (Ubuntu / Debian)

If you use **Claude Code** inside a PRoot Linux environment (Ubuntu or Debian) on Android:

### Step 1: Install PRoot Debian / Ubuntu in Termux
```bash
pkg install -y proot-distro
proot-distro install ubuntu
proot-distro login ubuntu
```

### Step 2: Configure Claude Code to use ApiDoct Gateway
Inside your Ubuntu / Debian PRoot terminal:

```bash
npx apidoct setup-claude --url http://localhost:3001 --api-key apidoct-<YOUR_UNIFIED_KEY>
```

Claude Code will automatically route through ApiDoct on `http://localhost:3001` with zero rate limits!

---

## 🔋 Keep ApiDoct Awake (Background Mode)

Android may suspend Termux when the screen turns off. To keep ApiDoct active in the background:

```bash
termux-wake-lock
```

To release the wake lock when done:
```bash
termux-wake-unlock
```

---

## 🌐 Access Mobile Dashboard from Local Network

To open the ApiDoct Dashboard from a tablet, PC, or another mobile phone on the same Wi-Fi:

```bash
HOST=0.0.0.0 npm run dev
```

Find your phone's IP address in Termux:
```bash
ifconfig wlan0
```

Open `http://<PHONE_IP>:5173` on any browser on your network!
