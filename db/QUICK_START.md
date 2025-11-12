# 🚀 Database Quick Start

## 1️⃣ **Get Railway Public URL**

The `.env.local` has the **internal** URL which only works inside Railway.

**To connect from your Mac:**

1. Go to https://railway.app
2. Select your project → PostgreSQL
3. Click **Connect** tab  
4. Copy the **Public Connection** URL

It will look like:
```
postgresql://postgres:Y......n@monorail.proxy.rlwy.net:12345/railway
```

⚠️ **Note:** The hostname will be different from `postgres.railway.internal`

---

## 2️⃣ **Connect via Terminal**

```bash
psql "postgresql://postgres:Y......n@YOUR_PUBLIC_HOST:PORT/railway"
```

You should see:
```
railway=>
```

---

## 3️⃣ **Run Migration**

### Option A: From psql prompt
```sql
\i /Users/chrismg/Developer/hackathons/ethsafari/echo/db/migrations/001_initial_schema.sql
```

### Option B: One-liner
```bash
psql "postgresql://postgres:Y......n@YOUR_PUBLIC_HOST:PORT/railway" \
  -f /Users/chrismg/Developer/hackathons/ethsafari/echo/db/migrations/001_initial_schema.sql
```

---

## 4️⃣ **Verify Tables**

```sql
-- List tables
\dt

-- Should show:
--   public | recordings | table | postgres
--   public | users      | table | postgres

-- Describe structure
\d users
\d recordings

-- Check data
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM recordings;
```

---

## 5️⃣ **Test Query**

```sql
-- Insert test user
INSERT INTO users (evm_address, created_at) 
VALUES ('0xTEST123', EXTRACT(EPOCH FROM NOW())::BIGINT);

-- Verify
SELECT * FROM users;

-- Clean up
DELETE FROM users WHERE evm_address = '0xTEST123';
```

---

## 🆘 **Troubleshooting**

### "Connection refused"
Use the **public** connection string from Railway, not `.env.local`

### "relation already exists"
Tables already created! Skip migration or drop first:
```sql
DROP TABLE IF EXISTS recordings CASCADE;
DROP TABLE IF EXISTS users CASCADE;
```

### "psql: command not found"
Install PostgreSQL client:
```bash
brew install postgresql
```

---

## ✅ **Success!**

Once tables exist, your Next.js app can use:
- `DATABASE_URL` from `.env.local` (internal URL works in production)
- Queries via `@vercel/postgres` in API routes

**Ready to test uploads! 🎉**
