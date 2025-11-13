import { NextRequest, NextResponse } from 'next/server'
import { pinata } from '@/lib/pinata'
import { getRecordingByShareId } from '@/lib/db'

export const runtime = 'nodejs'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ shareId: string }> }
) {
  try {
    const { shareId } = await params

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

    // Helper function to retry IPFS fetch with exponential backoff
    async function fetchFromIPFS(cid: string, maxRetries = 3): Promise<any> {
      for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
          console.log(`   📥 Fetching ${cid} (attempt ${attempt}/${maxRetries})...`)
          const response = await pinata.gateways.get(cid)
          
          if (!response.data) {
            throw new Error('No data in response')
          }
          
          return response.data // Can be JSON, string, or Blob
        } catch (error: any) {
          console.error(`   ⚠️  Attempt ${attempt} failed:`, error.message)
          
          if (attempt === maxRetries) {
            throw new Error(`IPFS fetch failed after ${maxRetries} attempts: ${error.message}`)
          }
          
          // Exponential backoff: 1s, 2s, 4s
          const delay = Math.pow(2, attempt - 1) * 1000
          console.log(`   ⏳ Retrying in ${delay}ms...`)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
      throw new Error('Fetch failed') // Should never reach here
    }

    // 2. Fetch audio file from IPFS with retries
    let audioBase64: string
    try {
      const audioData = await fetchFromIPFS(recording.audio_cid)
      
      // Audio files should always be Blobs
      if (!(audioData instanceof Blob)) {
        throw new Error(`Expected Blob for audio, got ${typeof audioData}`)
      }
      
      // Convert to base64 for easier transmission
      const audioArrayBuffer = await audioData.arrayBuffer()
      audioBase64 = Buffer.from(audioArrayBuffer).toString('base64')
      console.log('   ✅ Audio fetched')
    } catch (error: any) {
      console.error('   ❌ Audio fetch failed:', error.message)
      return NextResponse.json(
        { 
          error: 'Audio file not available on IPFS yet',
          details: 'The file may still be propagating. Please try again in a few moments.',
          cid: recording.audio_cid
        },
        { status: 503 } // Service Unavailable
      )
    }

    // 3. Fetch aqua proof JSON from IPFS with retries
    let aquaData: any
    try {
      const aquaResponse = await fetchFromIPFS(recording.aqua_cid)
      
      console.log('   🔍 Aqua response type:', typeof aquaResponse)
      console.log('   🔍 Is Blob?', aquaResponse instanceof Blob)
      console.log('   🔍 Is Array?', Array.isArray(aquaResponse))
      console.log('   🔍 Constructor:', aquaResponse?.constructor?.name)
      
      // Pinata returns different types based on content:
      // - JSON files are already parsed (objects/arrays)
      // - Text files are strings
      // - Binary files are Blobs
      if (typeof aquaResponse === 'string') {
        console.log('   📝 Parsing string as JSON')
        aquaData = JSON.parse(aquaResponse)
      } else if (aquaResponse instanceof Blob) {
        console.log('   📦 Converting Blob to JSON')
        const text = await aquaResponse.text()
        aquaData = JSON.parse(text)
      } else {
        console.log('   ✅ Using data as-is (already parsed JSON)')
        // Already parsed JSON
        aquaData = aquaResponse
      }
    } catch (error: any) {
      console.error('   ❌ Aqua proof fetch failed:', error.message)
      return NextResponse.json(
        { 
          error: 'Proof file not available on IPFS yet',
          details: 'The file may still be propagating. Please try again in a few moments.',
          cid: recording.aqua_cid
        },
        { status: 503 }
      )
    }
    
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
