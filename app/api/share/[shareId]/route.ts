import { NextRequest, NextResponse } from 'next/server'
import { pinata } from '@/lib/pinata'
import { getRecordingByShareId } from '@/lib/db'

export const runtime = 'nodejs'

export async function GET(
  request: NextRequest,
  { params }: { params: { shareId: string } }
) {
  try {
    const { shareId } = params

    console.log('🔍 Fetching recording:', shareId)

    // 1. Get recording from database
    const recording = await getRecordingByShareId(shareId)

    if (!recording) {
      return NextResponse.json(
        { error: 'Recording not found' },
        { status: 404 }
      )
    }

    console.log('   ✅ Recording found')
    console.log('   Audio CID:', recording.audio_cid)
    console.log('   Aqua CID:', recording.aqua_cid)

    // 2. Fetch audio file from IPFS
    console.log('   📥 Fetching audio from IPFS...')
    const audioResponse = await pinata.gateways.get(recording.audio_cid)
    const audioBlob = await audioResponse.data as Blob
    
    // Convert to base64 for easier transmission (or use signed URL)
    const audioArrayBuffer = await audioBlob.arrayBuffer()
    const audioBase64 = Buffer.from(audioArrayBuffer).toString('base64')

    console.log('   ✅ Audio fetched')

    // 3. Fetch aqua proof JSON from IPFS
    console.log('   📥 Fetching aqua proof from IPFS...')
    const aquaResponse = await pinata.gateways.get(recording.aqua_cid)
    const aquaText = await aquaResponse.data.text()
    const aquaData = JSON.parse(aquaText)

    console.log('   ✅ Aqua proof fetched')

    // 4. Return data
    return NextResponse.json({
      recording: {
        id: recording.id,
        share_id: recording.share_id,
        created_at: recording.created_at
      },
      audioData: audioBase64, // Base64 encoded audio
      aquaData // Parsed JSON
    })

  } catch (error) {
    console.error('❌ Share fetch error:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch recording',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
