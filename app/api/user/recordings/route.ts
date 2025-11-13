import { NextRequest, NextResponse } from 'next/server'
import { getUserByEvmAddress, getRecordingsByUserId } from '@/lib/db'

export const runtime = 'nodejs'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const evmAddress = searchParams.get('evm_address')

    if (!evmAddress) {
      return NextResponse.json(
        { error: 'evm_address parameter is required' },
        { status: 400 }
      )
    }

    console.log('🔍 Fetching recordings for user:', evmAddress)

    // 1. Get user by EVM address
    const user = await getUserByEvmAddress(evmAddress)

    if (!user) {
      // User not found - return empty list (not an error)
      console.log('   ℹ️  User not found in database')
      return NextResponse.json({
        recordings: []
      })
    }

    console.log('   ✅ User found:', user.id)

    // 2. Get user's recordings
    const recordings = await getRecordingsByUserId(user.id)

    console.log('   ✅ Found', recordings.length, 'recordings')

    return NextResponse.json({
      recordings
    })
  } catch (error) {
    console.error('❌ Failed to fetch recordings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch recordings', details: error instanceof Error ? error.message : String(error) },
      { status: 500 }
    )
  }
}
