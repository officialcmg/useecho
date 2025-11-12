# 🗄️ Database Setup Guide

## Prerequisites

Install PostgreSQL client tools:
```bash
# Mac (Homebrew)
brew install postgresql

# Or if you just need psql client
brew install libpq
```

## Get Railway Public Connection String

The DATABASE_URL in `.env.local` uses the internal hostname (`postgres.railway.internal`) which only works within Railway's network.

**To connect from your local machine:**

1. Go to [Railway Dashboard](https://railway.app)
2. Select your project → PostgreSQL service
3. Go to **Connect** tab
4. Copy the **Public Connection URL** (it will have a public hostname like `roundhouse.proxy.rlwy.net`)

Example public URL:
```
postgresql://postgres:Y......n@roundhouse.proxy.rlwy.net:12345/railway
```

## Connect to Database

### Option 1: Using psql (Terminal)

```bash
# Using the public connection string
psql "postgresql://postgres:Y......n@<PUBLIC_HOST>:<PORT>/railway"

# Or set environment variable
export DATABASE_URL="postgresql://postgres:Y......n@<PUBLIC_HOST>:<PORT>/railway"
psql $DATABASE_URL
```

### Option 2: Using psql with separate flags

```bash
psql \
  -h <PUBLIC_HOST> \
  -p <PORT> \
  -U postgres \
  -d railway
# Password: Y......n
```

## Run Migrations

### Method 1: Manual via psql

```bash
# Navigate to project root
cd /Users/chrismg/Developer/hackathons/ethsafari/echo

# Connect and run migration
psql "postgresql://postgres:Y......n@<PUBLIC_HOST>:<PORT>/railway" \
  -f db/migrations/001_initial_schema.sql
```

### Method 2: Copy and paste

1. Connect to database:
   ```bash
   psql "postgresql://postgres:Y......n@<PUBLIC_HOST>:<PORT>/railway"
   ```

2. Copy contents of `db/migrations/001_initial_schema.sql`

3. Paste into psql terminal and press Enter

## Verify Tables

After running migration:

```sql
-- List all tables
\dt

-- Describe tables
\d users
\d recordings

-- Check if data exists
SELECT COUNT(*) FROM users;
SELECT COUNT(*) FROM recordings;
```

## Useful psql Commands

```sql
-- List all tables
\dt

-- Describe table structure
\d table_name

-- List all databases
\l

-- Quit psql
\q

-- Execute SQL file
\i /path/to/file.sql

-- Show current connection info
\conninfo

-- Help
\?
```

## Troubleshooting

### Can't connect from local machine

Make sure you're using the **public connection string** from Railway, not the internal one.

### "relation already exists" error

Tables already exist! You can either:
- Skip the migration (already done)
- Drop tables first (⚠️ WARNING: Deletes all data):
  ```sql
  DROP TABLE IF EXISTS recordings CASCADE;
  DROP TABLE IF EXISTS users CASCADE;
  ```

### Permission denied

Make sure you're using the correct password from Railway.

## Next Steps

After migration succeeds:
1. Test database connection in Next.js app
2. Implement API routes that use the database
3. Test user signup and file uploads
