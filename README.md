# QuickShare 2

> Instant browser-to-browser file transfer. No uploads. No storage. No middleman.

PeerDrop uses **WebRTC Data Channels** to transfer files directly between two browsers. The signaling server only coordinates the initial handshake — your file never touches it.

![PeerDrop](https://img.shields.io/badge/WebRTC-P2P-blue?style=flat-square) ![Socket.io](https://img.shields.io/badge/Socket.io-4.x-black?style=flat-square) ![Node.js](https://img.shields.io/badge/Node.js-18+-green?style=flat-square) ![License](https://img.shields.io/badge/license-MIT-orange?style=flat-square)

---

## ✨ Features

- **Drag & drop** file selection — up to 50MB
- **Unique room link** — share with anyone, one click to copy
- **Direct P2P transfer** — file never stored on any server
- **SHA-256 integrity check** — hash verified after every transfer
- **Real-time progress** — speed (MB/s), ETA, and percentage
- **Auto-download** — file saves automatically when transfer completes
- **Graceful disconnects** — UI notifies both parties if connection drops
- **TURN fallback** — works across different networks and strict NATs

---

## 🏗 Architecture

```
Sender Browser ──────────────────── Receiver Browser
      │                                     │
      │   WebRTC Data Channel (direct P2P)  │
      │ ←─────────────────────────────────→ │
      │                                     │
      └──────── Signaling Server ───────────┘
               (offer / answer / ICE)
               Node.js + Socket.io
```

- **Signaling server** — Node.js + Express + Socket.io. Only relays WebRTC handshake messages (offer, answer, ICE candidates). Never sees file data.
- **Frontend** — Single `index.html`. No framework, no build step.
- **P2P layer** — WebRTC with STUN (Google) + TURN (Metered) for NAT traversal.

---

## 📁 Project Structure

```
PeerDrop/
├── server/
│   ├── server.js          # Signaling server (Express + Socket.io)
│   └── package.json
├── client/
│   └── public/
│       ├── index.html     # Entire frontend — sender + receiver in one file
│       └── vercel.json    # SPA rewrite rules for Vercel
├── render.yaml            # Render deployment config for backend
└── README.md
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 18+
- npm

### Run locally

**1. Start the signaling server**
```bash
cd server
npm install
npm start
# Server runs on http://localhost:4000
```

**2. Serve the frontend**

Open `client/public/index.html` directly in your browser, or use any static server:
```bash
npx serve client/public
# Frontend runs on http://localhost:3000
```

**3. Update the server URL**

In `client/public/index.html`, update this line to point to your local server:
```js
const SERVER_URL = 'http://localhost:4000';
```

---

## 🌐 Deployment

### Backend → Render

1. Create a new **Web Service** on [render.com](https://render.com)
2. Connect your GitHub repo
3. Configure:

| Setting | Value |
|---------|-------|
| Root Directory | `server` |
| Build Command | `npm install` |
| Start Command | `npm start` |

4. Add environment variable:

| Key | Value |
|-----|-------|
| `CLIENT_URL` | Your Vercel frontend URL |

### Frontend → Vercel

1. Create a new project on [vercel.com](https://vercel.com)
2. Connect your GitHub repo
3. Configure:

| Setting | Value |
|---------|-------|
| Root Directory | `client/public` |
| Framework Preset | Other |
| Build Command | *(leave blank)* |
| Output Directory | *(leave blank)* |

4. After deploying, copy your Vercel URL and set it as `CLIENT_URL` on Render.

5. Update `SERVER_URL` in `client/public/index.html` to your Render URL and push.

---

## 🔒 Security

| Feature | Detail |
|---------|--------|
| Transport encryption | WebRTC Data Channels use **DTLS 1.2** by default |
| File integrity | **SHA-256** hash computed before send, verified after reassembly |
| No server storage | Signaling server only handles WebRTC negotiation — zero file data |
| NAT traversal | STUN + TURN ensures connections work across different networks |

---

## ⚙️ How It Works

1. **Sender** drops a file and clicks "Create Room" → server generates a unique Room ID
2. **Sender** shares the invite link with the receiver
3. **Receiver** opens the link → joins the room via Socket.io
4. **Signaling** — server relays WebRTC offer/answer and ICE candidates between both peers
5. **P2P connection** established — server is no longer involved
6. **Sender** computes SHA-256 hash, then streams the file in 64KB chunks over the data channel
7. **Receiver** reassembles chunks in memory, verifies the hash, and auto-downloads the file

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| P2P Transport | WebRTC Data Channels |
| Signaling | Socket.io 4.x |
| Backend | Node.js + Express |
| Frontend | Vanilla HTML/CSS/JS |
| TURN Server | Metered.ca |
| Backend hosting | Render |
| Frontend hosting | Vercel |

---

