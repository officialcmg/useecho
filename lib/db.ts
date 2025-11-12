import { sql } from '@vercel/postgres'
import { nanoid } from 'nanoid'

// User types
export interface User {
  id: string
  email?: string
  evm_address: string
  nostr_npub?: string
  created_at: number
}

export interface CreateUserInput {
  email?: string
  evm_address: string
  nostr_npub?: string
}

// Recording types
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

// User operations
export async function createUser(input: CreateUserInput): Promise<User> {
  const { rows } = await sql<User>`
    INSERT INTO users (email, evm_address, nostr_npub, created_at)
    VALUES (
      ${input.email || null},
      ${input.evm_address},
      ${input.nostr_npub || null},
      ${Math.floor(Date.now() / 1000)}
    )
    ON CONFLICT (evm_address) 
    DO UPDATE SET
      email = COALESCE(EXCLUDED.email, users.email),
      nostr_npub = COALESCE(EXCLUDED.nostr_npub, users.nostr_npub)
    RETURNING *
  `
  return rows[0]
}

export async function getUserByEvmAddress(evm_address: string): Promise<User | null> {
  const { rows } = await sql<User>`
    SELECT * FROM users WHERE evm_address = ${evm_address} LIMIT 1
  `
  return rows[0] || null
}

export async function getUserByEmail(email: string): Promise<User | null> {
  const { rows } = await sql<User>`
    SELECT * FROM users WHERE email = ${email} LIMIT 1
  `
  return rows[0] || null
}

// Recording operations
export async function createRecording(input: CreateRecordingInput): Promise<Recording> {
  const shareId = nanoid(20) // Generate 20-character share ID
  
  const { rows } = await sql<Recording>`
    INSERT INTO recordings (
      user_id,
      audio_cid,
      aqua_cid,
      is_private,
      created_at,
      share_id
    )
    VALUES (
      ${input.user_id},
      ${input.audio_cid},
      ${input.aqua_cid},
      ${input.is_private !== undefined ? input.is_private : true},
      ${Math.floor(Date.now() / 1000)},
      ${shareId}
    )
    RETURNING *
  `
  return rows[0]
}

export async function getRecordingByShareId(share_id: string): Promise<Recording | null> {
  const { rows } = await sql<Recording>`
    SELECT * FROM recordings WHERE share_id = ${share_id} LIMIT 1
  `
  return rows[0] || null
}

export async function getRecordingsByUserId(user_id: string): Promise<Recording[]> {
  const { rows } = await sql<Recording>`
    SELECT * FROM recordings 
    WHERE user_id = ${user_id} 
    ORDER BY created_at DESC
  `
  return rows
}

export async function deleteRecording(id: string, user_id: string): Promise<boolean> {
  const result = await sql`
    DELETE FROM recordings 
    WHERE id = ${id} AND user_id = ${user_id}
  `
  return (result.rowCount ?? 0) > 0
}
