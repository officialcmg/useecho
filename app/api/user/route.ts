import { NextRequest, NextResponse } from 'next/server'
import { createUser, getUserByEvmAddress } from '@/lib/db'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { evm_address, nostr_npub, email } = body

    if (!evm_address) {
      return NextResponse.json(
        { error: 'evm_address is required' },
        { status: 400 }
      )
    }

    console.log('💾 Saving/updating user:', evm_address)

    // Check if user already exists
    const existingUser = await getUserByEvmAddress(evm_address)
    
    if (existingUser) {
      console.log('   ℹ️  User already exists, upsert will update if needed')
    }

    // Create or update user (ON CONFLICT handles upsert)
    const user = await createUser({
      evm_address,
      nostr_npub,
      email,
    })

    console.log('   ✅ User saved:', user.id)

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        evm_address: user.evm_address,
        nostr_npub: user.nostr_npub,
      }
    })
  } catch (error) {
    console.error('❌ User save error:', error)
    return NextResponse.json(
      { error: 'Failed to save user', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
