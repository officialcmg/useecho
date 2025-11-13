import { generateSecretKey, getPublicKey, nip19 } from 'nostr-tools'
import { sha256 } from '@noble/hashes/sha256'
import { bytesToHex } from '@noble/hashes/utils'

/**
 * Derives a deterministic Nostr keypair from a Privy wallet signature
 * This creates a cryptographic association between the Privy wallet and Nostr identity
 * WITHOUT storing the Nostr private key anywhere
 */
export async function deriveNostrKeysFromSignature(signature: string): Promise<{
  privateKey: Uint8Array
  publicKey: string
  npub: string
  nsec: string
}> {
  // Remove 0x prefix if present
  const cleanSignature = signature.startsWith('0x') ? signature.slice(2) : signature
  
  // Hash the signature to create a deterministic seed
  const signatureBytes = hexToBytes(cleanSignature)
  const seed = sha256(signatureBytes)
  
  // Use the seed as the Nostr private key
  const privateKey = seed.slice(0, 32) // Ensure 32 bytes
  
  // Derive public key from private key
  const publicKey = getPublicKey(privateKey)
  
  // Encode in bech32 format
  const npub = nip19.npubEncode(publicKey)
  const nsec = nip19.nsecEncode(privateKey)
  
  return {
    privateKey,
    publicKey,
    npub,
    nsec
  }
}

/**
 * Generate a CONSTANT deterministic message for Privy to sign
 * CRITICAL: This message must NEVER change, or users will get different Nostr keys!
 * The signature of this exact message is used to derive the Nostr keypair.
 */
export function generateNostrDerivationMessage(): string {
  return `ECHO - Derive Nostr Identity

This signature will be used to deterministically generate your Nostr keypair for witnessing audio recordings.

By signing this message, you authorize ECHO to derive a unique Nostr identity from your wallet signature.`
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}
