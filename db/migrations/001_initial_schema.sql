-- ECHO Database Schema
-- Migration 001: Initial Schema

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users table
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  email VARCHAR(255) UNIQUE,
  evm_address VARCHAR(42) UNIQUE NOT NULL,
  nostr_npub VARCHAR(255),
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT
);

-- Recordings table
CREATE TABLE IF NOT EXISTS recordings (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  audio_cid VARCHAR(255) NOT NULL,
  aqua_cid VARCHAR(255) NOT NULL,
  is_private BOOLEAN DEFAULT true,
  created_at BIGINT NOT NULL DEFAULT EXTRACT(EPOCH FROM NOW())::BIGINT,
  share_id VARCHAR(20) UNIQUE NOT NULL
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_recordings_user_id ON recordings(user_id);
CREATE INDEX IF NOT EXISTS idx_recordings_share_id ON recordings(share_id);
CREATE INDEX IF NOT EXISTS idx_users_evm_address ON users(evm_address);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);

-- Add comments for documentation
COMMENT ON TABLE users IS 'Stores user authentication and identity information';
COMMENT ON TABLE recordings IS 'Stores IPFS CIDs for audio recordings and their Aqua proof files';
COMMENT ON COLUMN recordings.audio_cid IS 'IPFS CID for the .webm audio file';
COMMENT ON COLUMN recordings.aqua_cid IS 'IPFS CID for the .aqua.json proof file';
COMMENT ON COLUMN recordings.share_id IS 'Unique 20-character ID for shareable links';
COMMENT ON COLUMN recordings.created_at IS 'Unix epoch timestamp in seconds';
COMMENT ON COLUMN users.created_at IS 'Unix epoch timestamp in seconds';
