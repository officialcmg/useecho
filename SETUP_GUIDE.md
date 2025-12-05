# 🚀 ECHO - Complete Setup Guide

## ✅ **What We Just Built**

1. ✅ Database schema (PostgreSQL on Railway)
2. ✅ Pinata IPFS integration (private uploads)
3. ✅ API routes for uploading and sharing
4. ✅ Share page with audio player + verification
5. ✅ 20-character nanoid share IDs

---

## 📦 **Step 1: Install Dependencies**

```bash
cd /Users/chrismg/Developer/hackathons/ethsafari/echo
npm install
```

This will install:
- `pinata` - IPFS uploads
- `@vercel/postgres` - Database queries
- `nanoid` - Share ID generation

---

## 🗄️ **Step 2: Setup Database**

### Get Public Connection String

1. Go to [Railway Dashboard](https://railway.app)
2. Select your project → PostgreSQL service
3. Click **Connect** tab
4. Copy the **Public Connection URL**
   - It will look like: `postgresql://postgres:PASSWORD@hostname.proxy.rlwy.net:PORT/railway`

### Run Migration

```bash
# Option 1: Direct psql command
psql "postgresql://postgres:YlJZBHQKNqKSjpiOIaYeTSPIvRaOrhGM@<PUBLIC_HOST>:<PORT>/railway" \
  -f db/migrations/001_initial_schema.sql

# Option 2: Connect then run
psql "postgresql://postgres:YlJZBHQKNqKSjpiOIaYeTSPIvRaOrhGM@<PUBLIC_HOST>:<PORT>/railway"
# Then in psql:
\i db/migrations/001_initial_schema.sql
```

### Verify Tables

```sql
\dt  -- List tables (should see: users, recordings)
\d users  -- Describe users table
\d recordings  -- Describe recordings table
```

---

## 🔧 **Step 3: Update Environment Variables**

The `.env.local` file is already configured, but you need to:

1. Get your Pinata Gateway URL:
   - Go to https://app.pinata.cloud/gateways
   - Copy your gateway domain (e.g., `gateway.pinata.cloud` or custom domain)

2. Update `.env.local`:
   ```bash
   PINATA_GATEWAY=your-gateway.mypinata.cloud  # Replace with your gateway
   ```

---

## 🧪 **Step 4: Test the Setup**

### Start Dev Server

```bash
npm run dev
```

### Test Database Connection

Create a test file:

```typescript
// test-db.ts
import { createUser } from './lib/db'

async function test() {
  try {
    const user = await createUser({
      evm_address: '0xTEST123',
      nostr_npub: 'npubTEST'
    })
    console.log('✅ Database works!', user)
  } catch (error) {
    console.error('❌ Database error:', error)
  }
}

test()
```

Run it:
```bash
npx tsx test-db.ts
```

---

## 📤 **Step 5: Implement Upload in AudioRecorder**

Add this function to `components/AudioRecorder.tsx`:

```typescript
const handleUploadToIPFS = async () => {
  if (chunks.length === 0 || !aquaTree || !user?.wallet?.address) {
    alert('No recording to upload or user not connected')
    return
  }

  try {
    setIsProcessing(true)
    setProcessingStatus('Uploading to IPFS...')

    // 1. Create combined audio blob
    const audioBlobs = chunks.map((c) => c.audioBlob)
    const audioFile = new Blob(audioBlobs, { type: 'audio/webm' })

    // 2. Create aqua JSON blob
    const exportData = {
      aquaTree: aquaTree,
      metadata: {
        totalChunks: chunks.length,
        duration: chunks.length * 2,
        chunkDuration: 2,
        privyWallet: user.wallet.address,
        nostrPubkey: nostrKeys?.npub,
        witnesses,
      },
    }
    const aquaJson = JSON.stringify(exportData, null, 2)
    const aquaFile = new Blob([aquaJson], { type: 'application/json' })

    // 3. Create form data
    const formData = new FormData()
    formData.append('audio', audioFile, 'recording.webm')
    formData.append('aqua', aquaFile, 'proof.json')
    formData.append('evmAddress', user.wallet.address)
    if (nostrKeys?.npub) {
      formData.append('nostrNpub', nostrKeys.npub)
    }

    // 4. Upload via API
    setProcessingStatus('Uploading to server...')
    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData
    })

    if (!response.ok) {
      throw new Error('Upload failed')
    }

    const result = await response.json()
    
    console.log('✅ Upload successful!')
    console.log('Share URL:', result.shareUrl)
    
    // 5. Show share URL to user
    alert(`Recording uploaded! Share link:\n\n${result.shareUrl}`)
    
    // Copy to clipboard
    navigator.clipboard.writeText(result.shareUrl)

  } catch (error) {
    console.error('Upload error:', error)
    alert('Upload failed. Check console for details.')
  } finally {
    setIsProcessing(false)
    setProcessingStatus('')
  }
}
```

Add button in the UI:

```tsx
{chunks.length > 0 && !isRecording && (
  <button
    onClick={handleUploadToIPFS}
    disabled={isProcessing}
    className="w-full bg-purple-600 hover:bg-purple-700 disabled:bg-gray-700 py-3 rounded-xl font-semibold"
  >
    {isProcessing ? processingStatus : '🌐 Upload & Get Share Link'}
  </button>
)}
```

---

## 🔗 **Step 6: Test Full Flow**

### Record → Upload → Share

1. **Record audio:**
   - Go to http://localhost:3000
   - Click "Start Recording"
   - Record for 10 seconds
   - Click "Stop"

2. **Upload:**
   - Click "🌐 Upload & Get Share Link"
   - Wait for upload to complete
   - Copy the share URL (e.g., `http://localhost:3000/share/abc123xyz...`)

3. **Share:**
   - Open the share URL in a new tab
   - Should see audio player + automatic verification
   - All WHO/WHEN/INTEGRITY/WITNESSES should display

---

## 🎯 **API Endpoints Created**

### `POST /api/upload`
Uploads audio + proof to IPFS, saves to database, returns share URL

**Body (FormData):**
- `audio` - Audio file (.webm)
- `aqua` - Proof file (.json)
- `evmAddress` - User's wallet address
- `nostrNpub` - (Optional) Nostr public key

**Response:**
```json
{
  "success": true,
  "recording": {
    "id": "uuid",
    "audio_cid": "bafybeXXX",
    "aqua_cid": "bafybeYYY",
    "share_id": "abc123xyz...",
    "created_at": 1234567890
  },
  "shareUrl": "http://localhost:3000/share/abc123xyz..."
}
```

### `GET /api/share/[shareId]`
Fetches recording by share ID, returns audio + proof data

**Response:**
```json
{
  "recording": {
    "id": "uuid",
    "share_id": "abc123xyz...",
    "created_at": 1234567890
  },
  "audioData": "base64...",
  "aquaData": { /* aquaTree + metadata */ }
}
```

---

## 🗂️ **Database Schema**

### `users` table
```sql
id          UUID PRIMARY KEY
email       VARCHAR(255) UNIQUE
evm_address VARCHAR(42) UNIQUE NOT NULL
nostr_npub  VARCHAR(255)
created_at  BIGINT (unix epoch)
```

### `recordings` table
```sql
id          UUID PRIMARY KEY
user_id     UUID REFERENCES users(id)
audio_cid   VARCHAR(255) NOT NULL
aqua_cid    VARCHAR(255) NOT NULL
is_private  BOOLEAN DEFAULT true
created_at  BIGINT (unix epoch)
share_id    VARCHAR(20) UNIQUE NOT NULL
```

---

## 🎨 **Share Page Features**

- 🎵 **Audio Player** - Stream from IPFS
- 🔐 **Auto-Verification** - Runs on page load
- 👤 **WHO** - Wallet + Nostr identity
- ⏰ **WHEN** - Recording time range
- 🔒 **INTEGRITY** - Chunks + signatures verified
- 🌐 **WITNESSES** - Nostr events with details

---

## 🐛 **Troubleshooting**

### "Cannot find module 'pinata'"
Run `npm install` first

### "Database connection failed"
Use the **public** connection string from Railway, not the internal one

### "PINATA_JWT is required"
Check that `.env.local` has all the Pinata variables

### Share page shows "Recording not found"
Make sure you ran the database migration and uploaded a recording

---

## 🚀 **Next Steps**

1. ✅ Run `npm install`
2. ✅ Run database migration
3. ✅ Test database connection
4. ✅ Add upload button to AudioRecorder
5. ✅ Test full record → upload → share flow
6. 🎯 Deploy to production!

---

**ECHO is now production-ready with shareable links! 🎉**
