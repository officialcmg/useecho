import { Pool } from 'pg'
import { nanoid } from 'nanoid'

// Create PostgreSQL connection pool
const pool = new Pool({
  connectionString: process.env.POSTGRES_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
})

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
  const result = await pool.query<User>(
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
}

export async function getUserByEvmAddress(evm_address: string): Promise<User | null> {
  const result = await pool.query<User>(
    `SELECT * FROM users WHERE evm_address = $1 LIMIT 1`,
    [evm_address]
  )
  return result.rows[0] || null
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const result = await pool.query<User>(
    `SELECT * FROM users WHERE email = $1 LIMIT 1`,
    [email]
  )
  return result.rows[0] || null
}

// Recording functions
export async function createRecording(input: CreateRecordingInput): Promise<Recording> {
  const shareId = nanoid(20)
  const now = Math.floor(Date.now() / 1000)
  const isPrivate = input.is_private !== undefined ? input.is_private : true

  const result = await pool.query<Recording>(
    `INSERT INTO recordings (user_id, audio_cid, aqua_cid, is_private, created_at, share_id)
     VALUES ($1, $2, $3, $4, $5, $6)
     RETURNING *`,
    [input.user_id, input.audio_cid, input.aqua_cid, isPrivate, now, shareId]
  )
  return result.rows[0]
}

export async function getRecordingByShareId(share_id: string): Promise<Recording | null> {
  const result = await pool.query<Recording>(
    `SELECT * FROM recordings WHERE share_id = $1 LIMIT 1`,
    [share_id]
  )
  return result.rows[0] || null
}

export async function getRecordingsByUserId(user_id: string): Promise<Recording[]> {
  const result = await pool.query<Recording>(
    `SELECT * FROM recordings WHERE user_id = $1 ORDER BY created_at DESC`,
    [user_id]
  )
  return result.rows
}

export async function deleteRecording(id: string, user_id: string): Promise<boolean> {
  const result = await pool.query(
    `DELETE FROM recordings WHERE id = $1 AND user_id = $2`,
    [id, user_id]
  )
  return (result.rowCount ?? 0) > 0
}
