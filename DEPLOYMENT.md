# 🚀 Deploying echo to Vercel

## Prerequisites

- GitHub account (repo already created: https://github.com/officialcmg/echo)
- Vercel account (sign up at https://vercel.com)
- Environment variables ready

## Required Environment Variables

You'll need to set these in Vercel:

### 1. **NEXT_PUBLIC_PRIVY_APP_ID**
   - From: https://dashboard.privy.io
   - Your app ID (starts with `clp...`)

### 2. **PINATA_JWT**
   - From: https://app.pinata.cloud/developers/api-keys
   - JWT token for Pinata API

### 3. **PINATA_GATEWAY_URL**
   - From: https://app.pinata.cloud/gateway
   - Your dedicated gateway URL (e.g., `https://yourgateway.mypinata.cloud`)

### 4. **DATABASE_URL**
   - From: https://vercel.com/storage/postgres
   - Vercel Postgres connection string
   - Format: `postgres://user:pass@host:port/db?sslmode=require`

---

## Deployment Steps

### Option 1: Deploy via Vercel Dashboard (Easiest)

1. **Go to Vercel:**
   - Visit https://vercel.com/new
   - Click "Import Git Repository"

2. **Import Repository:**
   - Select: `officialcmg/echo`
   - Click "Import"

3. **Configure Project:**
   - Framework Preset: **Next.js** (auto-detected)
   - Root Directory: `./` (default)
   - Build Command: `npm run build` (default)
   - Output Directory: `.next` (default)

4. **Add Environment Variables:**
   - Click "Environment Variables"
   - Add all 4 variables listed above
   - Make sure to add them for **Production**, **Preview**, and **Development**

5. **Deploy:**
   - Click "Deploy"
   - Wait 2-3 minutes for build
   - Your app will be live at `https://echo-[random].vercel.app`

---

### Option 2: Deploy via Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy (from project root)
vercel

# Follow prompts:
# - Link to existing project? No
# - What's your project's name? echo
# - In which directory is your code located? ./
# - Want to override settings? No

# Add environment variables
vercel env add NEXT_PUBLIC_PRIVY_APP_ID
vercel env add PINATA_JWT
vercel env add PINATA_GATEWAY_URL
vercel env add DATABASE_URL

# Deploy to production
vercel --prod
```

---

## Post-Deployment Setup

### 1. **Configure Privy for Production**

In your Privy dashboard (https://dashboard.privy.io):
- Go to "Settings" → "Allowed domains"
- Add your Vercel domain: `echo-[random].vercel.app`
- Add your custom domain (if you have one)

### 2. **Setup Database**

If using Vercel Postgres:

```bash
# Create database via Vercel dashboard
# Go to Storage → Create Database → Postgres

# Run migrations
# Vercel will automatically use DATABASE_URL
# Tables will be created on first API call
```

Or manually run the SQL from `db/schema.sql`:

```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  wallet_address VARCHAR(42) UNIQUE NOT NULL,
  email VARCHAR(255),
  nostr_pubkey VARCHAR(64),
  nostr_npub VARCHAR(64),
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE recordings (
  id SERIAL PRIMARY KEY,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  share_id VARCHAR(20) UNIQUE NOT NULL,
  audio_cid VARCHAR(100) NOT NULL,
  aqua_cid VARCHAR(100) NOT NULL,
  filename VARCHAR(255),
  size_bytes BIGINT,
  duration_seconds NUMERIC(10,2),
  chunks_count INTEGER,
  witnesses_count INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_recordings_user_id ON recordings(user_id);
CREATE INDEX idx_recordings_share_id ON recordings(share_id);
```

### 3. **Test Your Deployment**

1. Visit your Vercel URL
2. Click "Sign In" to test Privy login
3. Try recording a short audio clip
4. Verify IPFS upload works
5. Check share page functionality

---

## Custom Domain (Optional)

1. Go to Vercel Dashboard → Your Project → Settings → Domains
2. Add your custom domain
3. Follow DNS configuration instructions
4. Update Privy allowed domains

---

## Environment Variables Reference

| Variable | Required | Description |
|----------|----------|-------------|
| `NEXT_PUBLIC_PRIVY_APP_ID` | ✅ Yes | Privy app ID for authentication |
| `PINATA_JWT` | ✅ Yes | Pinata API key for IPFS uploads |
| `PINATA_GATEWAY_URL` | ✅ Yes | Pinata gateway for IPFS retrieval |
| `DATABASE_URL` | ✅ Yes | PostgreSQL connection string |

---

## Troubleshooting

### Build Fails
- Check that all environment variables are set
- Verify `next.config.ts` is valid
- Check build logs in Vercel dashboard

### Database Connection Issues
- Verify `DATABASE_URL` format
- Ensure database allows connections from Vercel IPs
- Check if tables exist (run migrations)

### IPFS Upload Fails
- Verify `PINATA_JWT` is valid
- Check Pinata dashboard for API limits
- Ensure gateway URL is correct

### Privy Login Not Working
- Add Vercel domain to Privy allowed domains
- Check `NEXT_PUBLIC_PRIVY_APP_ID` is correct
- Verify it's a public env var (has `NEXT_PUBLIC_` prefix)

---

## 🎉 Success!

Your echo app should now be live on Vercel!

**Live URL:** https://echo-[your-slug].vercel.app

**GitHub Repo:** https://github.com/officialcmg/echo
