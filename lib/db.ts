import { Pool, PoolClient } from 'pg'
import { nanoid } from 'nanoid'

// Create PostgreSQL connection pool with resilient settings for serverless
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 10, // Reduced for serverless environments
  idleTimeoutMillis: 10000, // Close idle connections faster
  connectionTimeoutMillis: 5000, // More time to establish connection
})

// Handle pool errors to prevent crashes
pool.on('error', (err) => {
  console.error('🔴 Unexpected pool error:', err.message)
})

/**
 * Execute a query with automatic retry on connection errors
 */
async function queryWithRetry<T>(
  queryFn: (client: Pool) => Promise<T>,
  maxRetries = 2
): Promise<T> {
  let lastError: Error | null = null
  
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await queryFn(pool)
    } catch (error: any) {
      lastError = error
      const isConnectionError = 
        error.code === 'ECONNRESET' || 
        error.code === 'EPIPE' ||
        error.code === 'ETIMEDOUT' ||
        error.code === '57P01' || // admin_shutdown
        error.code === '57P02' || // crash_shutdown  
        error.code === '57P03' || // cannot_connect_now
        error.message?.includes('Connection terminated')
      
      if (isConnectionError && attempt < maxRetries) {
        console.warn(`⚠️ DB connection error (attempt ${attempt}/${maxRetries}), retrying...`)
        // Brief delay before retry
        await new Promise(resolve => setTimeout(resolve, 100 * attempt))
        continue
      }
      throw error
    }
  }
  throw lastError
}

// Types
export interface User {
  id: string
  email: string | null
  evm_address: string
  nostr_npub: string | null
  created_at: number
}

export interface CreateUserInput {
  email?: string
  evm_address: string
  nostr_npub?: string
}

export interface Recording {
  id: string
  user_id: string
  audio_cid: string
  aqua_cid: string
  is_private: boolean
  created_at: number
  share_id: string
}

export interface CreateRecordingInput {
  user_id: string
  audio_cid: string
  aqua_cid: string
  is_private?: boolean
}

// User functions
export async function createUser(data: CreateUserInput): Promise<User> {
  const now = Math.floor(Date.now() / 1000)
  return queryWithRetry(async (p) => {
    const result = await p.query<User>(
      `INSERT INTO users (email, evm_address, nostr_npub, created_at)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (evm_address) 
       DO UPDATE SET
         email = COALESCE(EXCLUDED.email, users.email),
         nostr_npub = COALESCE(EXCLUDED.nostr_npub, users.nostr_npub)
       RETURNING *`,
      [data.email || null, data.evm_address, data.nostr_npub || null, now]
    )
    return result.rows[0]
  })
}

export async function getUserByEvmAddress(evm_address: string): Promise<User | null> {
  return queryWithRetry(async (p) => {
    const result = await p.query<User>(
      `SELECT * FROM users WHERE evm_address = $1 LIMIT 1`,
      [evm_address]
    )
    return result.rows[0] || null
  })
}

export async function getUserByEmail(email: string): Promise<User | null> {
  return queryWithRetry(async (p) => {
    const result = await p.query<User>(
      `SELECT * FROM users WHERE email = $1 LIMIT 1`,
      [email]
    )
    return result.rows[0] || null
  })
}

// Recording functions
export async function createRecording(input: CreateRecordingInput): Promise<Recording> {
  const shareId = nanoid(20)
  const now = Math.floor(Date.now() / 1000)
  const isPrivate = input.is_private !== undefined ? input.is_private : true

  return queryWithRetry(async (p) => {
    const result = await p.query<Recording>(
      `INSERT INTO recordings (user_id, audio_cid, aqua_cid, is_private, created_at, share_id)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [input.user_id, input.audio_cid, input.aqua_cid, isPrivate, now, shareId]
    )
    return result.rows[0]
  })
}

export async function getRecordingByShareId(share_id: string): Promise<Recording | null> {
  return queryWithRetry(async (p) => {
    const result = await p.query<Recording>(
      `SELECT * FROM recordings WHERE share_id = $1 LIMIT 1`,
      [share_id]
    )
    return result.rows[0] || null
  })
}

export async function getRecordingsByUserId(user_id: string): Promise<Recording[]> {
  return queryWithRetry(async (p) => {
    const result = await p.query<Recording>(
      `SELECT * FROM recordings WHERE user_id = $1 ORDER BY created_at DESC`,
      [user_id]
    )
    return result.rows
  })
}

export async function deleteRecording(id: string, user_id: string): Promise<boolean> {
  return queryWithRetry(async (p) => {
    const result = await p.query(
      `DELETE FROM recordings WHERE id = $1 AND user_id = $2`,
      [id, user_id]
    )
    return (result.rowCount ?? 0) > 0
  })
}
