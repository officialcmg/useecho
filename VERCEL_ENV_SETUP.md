# Vercel Environment Variables Setup

## The Problem
The `vercel.json` file was referencing secrets (`@privy_app_id`, etc.) that don't exist, causing deployment failures.

## The Fix
✅ **Removed** the `env` section from `vercel.json`  
✅ Environment variables should be managed in **Vercel Dashboard**, not in `vercel.json`

---

## How to Set Up Environment Variables in Vercel

### Step 1: Go to Vercel Dashboard
1. Open your project in Vercel: https://vercel.com/dashboard
2. Click on your project (e.g., `echo`)
3. Go to **Settings** → **Environment Variables**

### Step 2: Add Each Variable

Add these environment variables **one by one**:

#### 1. NEXT_PUBLIC_PRIVY_APP_ID
- **Name:** `NEXT_PUBLIC_PRIVY_APP_ID`
- **Value:** Your Privy App ID (e.g., `clz...`)
- **Environment:** ✓ Production ✓ Preview ✓ Development
- Click **Save**

#### 2. PINATA_JWT
- **Name:** `PINATA_JWT`
- **Value:** Your Pinata JWT token
- **Environment:** ✓ Production ✓ Preview ✓ Development
- **Type:** Sensitive (Vercel will encrypt this)
- Click **Save**

#### 3. PINATA_GATEWAY_URL
- **Name:** `PINATA_GATEWAY_URL`
- **Value:** Your Pinata gateway URL (e.g., `https://gateway.pinata.cloud`)
- **Environment:** ✓ Production ✓ Preview ✓ Development
- Click **Save**

#### 4. DATABASE_URL
- **Name:** `DATABASE_URL`
- **Value:** Your Vercel Postgres connection string
- **Environment:** ✓ Production ✓ Preview ✓ Development
- **Type:** Sensitive
- Click **Save**

#### 5. NEXT_PUBLIC_NOSTR_RELAYS (Optional)
- **Name:** `NEXT_PUBLIC_NOSTR_RELAYS`
- **Value:** `wss://relay.damus.io,wss://relay.snort.social,wss://nos.lol`
- **Environment:** ✓ Production ✓ Preview ✓ Development
- Click **Save**

### Step 3: Redeploy
After adding all variables:
1. Go to **Deployments** tab
2. Click **⋯** (three dots) on the latest deployment
3. Click **Redeploy**
4. ✅ Your deployment should now succeed!

---

## Important Notes

### ⚠️ Never Use Secrets in vercel.json
```json
❌ BAD - Don't do this:
{
  "env": {
    "NEXT_PUBLIC_PRIVY_APP_ID": "@privy_app_id"  // ← This tries to reference a secret
  }
}

✅ GOOD - Do this:
{
  "buildCommand": "npm run build",
  "framework": "nextjs"
}
// And set env vars in Vercel Dashboard
```

### 🔐 Public vs Sensitive Variables
- **`NEXT_PUBLIC_*`** variables are **public** (visible in browser)
- Other variables (like `PINATA_JWT`, `DATABASE_URL`) are **sensitive** (server-only)

### 🚀 Automatic Deployment
Once you commit and push this fix:
```bash
git add .
git commit -m "fix: remove env secrets from vercel.json, use dashboard instead"
git push
```

Vercel will auto-deploy, and if you've set up the environment variables in the dashboard, it will succeed! 🎉
