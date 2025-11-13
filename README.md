# echo 🎙️

**Tamper-Proof Audio Recording with Cryptographic Verification**

echo is a revolutionary audio recording app that creates unforgeable proof of authenticity using:
- **Aqua Protocol** for cryptographic file verification
- **Privy** for seamless email authentication  
- **Nostr** for decentralized witnessing

## 🌟 Features

- **Record Audio** in 2-second chunks with real-time verification
- **Silent Signing** - No annoying popups every 2 seconds
- **Automatic Witnessing** - Every 10 chunks witnessed on Nostr network
- **Verification** - Anyone can verify the entire recording chain
- **Mobile Responsive** - Works perfectly on phones and tablets
- **No Storage Required** - Download and share your recordings

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Create `.env.local` file:

```env
NEXT_PUBLIC_PRIVY_APP_ID=your_privy_app_id_here
NEXT_PUBLIC_NOSTR_RELAYS=wss://relay.damus.io,wss://relay.snort.social
```

Get your Privy App ID from [https://dashboard.privy.io](https://dashboard.privy.io)

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

## 🎯 How It Works

### Recording Flow

1. **Login** with email via Privy
2. **Derive Nostr Keys** deterministically from your signature
3. **Start Recording** - Audio chunks every 2 seconds
4. **Automatic Processing**:
   - Each chunk → Aqua file revision (genesis/content)
   - Silent signature with Privy (no popups!)
   - Hash linked to previous chunk
   - Witness on Nostr every 10 chunks
5. **Download** - Get audio file + Aqua proof JSON

### Verification Flow

1. Upload `.webm` audio file
2. Upload `.aqua.json` proof file
3. Verify entire chain:
   - Each chunk hash validated
   - Signatures verified
   - Chain integrity checked
   - Nostr witnesses confirmed

## 📁 Project Structure

```
echo/
├── app/
│   ├── layout.tsx          # Root layout with Privy
│   ├── page.tsx            # Recording page
│   ├── verify/page.tsx     # Verification page
│   └── providers.tsx       # Client providers
├── components/
│   ├── Header.tsx          # App header
│   └── AudioRecorder.tsx   # Main recording component
├── lib/
│   ├── aqua/
│   │   ├── aquafier.ts    # Aqua SDK wrapper
│   │   └── types.ts       # Type definitions
│   ├── nostr/
│   │   └── keys.ts        # Nostr key derivation
│   └── utils.ts           # Utilities
└── hooks/
    ├── useRecording.ts    # Recording state
    └── useNostr.ts        # Nostr operations
```

## 🔧 Tech Stack

- **Framework**: Next.js 14 (App Router)
- **Styling**: TailwindCSS
- **Auth**: Privy (email-only)
- **Blockchain**: Aqua Protocol SDK
- **Witnessing**: Nostr (nostr-tools)
- **Icons**: Lucide React

## 🔐 Security

- **Deterministic Keys**: Nostr keys derived from Privy signature (no storage)
- **Silent Signing**: `showWalletUIs: false` for seamless UX
- **Chain Integrity**: Each chunk cryptographically linked
- **Decentralized Witnessing**: Nostr relays provide timestamped proof
- **No Private Key Exposure**: Keys regenerated per session

## 🎨 Features in Detail

### Silent Signing
```typescript
await signMessage({ message }, {
  uiOptions: { showWalletUIs: false } // No popup!
})
```

### Nostr Key Derivation
```typescript
const sig = await signMessage({ message })
const keys = await deriveNostrKeysFromSignature(sig)
// Keys recreated deterministically each session
```

### Chunk Processing
- 2-second audio chunks
- Genesis revision for first chunk
- Content revisions for subsequent chunks
- Automatic prev_hash linking

### Witnessing Strategy
- Witness every 10 chunks (every 20 seconds)
- Post to multiple Nostr relays
- Include chunk index and verification hash
- Timestamped proof of recording time

## 📱 Mobile Support

Fully responsive design:
- Touch-friendly buttons
- Adaptive layouts
- Works on iOS/Android browsers

## 🚧 Future Enhancements

- [ ] Save Privy→Nostr mapping on Base mainnet
- [ ] IPFS storage integration
- [ ] Live streaming verification
- [ ] Advanced audio formats
- [ ] Batch verification

## 🏆 Built For EthSafari Hackathon

High wow factor, low complexity - leveraging:
- Aqua Protocol's revision system
- Privy's embedded wallets
- Nostr's free witnessing

## 📄 License

MIT

## 🤝 Contributing

PRs welcome! This is a hackathon project but we'd love to see it grow.

---

**Built with ❤️ using Aqua Protocol, Privy, and Nostr**
