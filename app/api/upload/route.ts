import { NextRequest, NextResponse } from 'next/server'
import { pinata } from '@/lib/pinata'
import { createRecording, createUser, getUserByEvmAddress } from '@/lib/db'

export const runtime = 'nodejs'

export async function POST(request: NextRequest) {
  try {
    // 1. Get form data
    const formData = await request.formData()
    const audioFile = formData.get('audio') as File
    const aquaFile = formData.get('aqua') as File
    const evmAddress = formData.get('evmAddress') as string
    const nostrNpub = formData.get('nostrNpub') as string | null

    if (!audioFile || !aquaFile || !evmAddress) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    console.log('📤 Uploading files to Pinata...')
    console.log('   Audio:', audioFile.name, audioFile.size, 'bytes')
    console.log('   Aqua:', aquaFile.name, aquaFile.size, 'bytes')

    // 2. Upload audio file to Pinata - KEEP ORIGINAL FILENAME!
    const audioUpload = await pinata.upload.file(audioFile).addMetadata({
      name: audioFile.name // Keep original filename for verification
    })
    
    console.log('   ✅ Audio uploaded:', audioUpload.cid)

    // 3. Upload aqua proof file to Pinata - KEEP ORIGINAL FILENAME!
    const aquaUpload = await pinata.upload.file(aquaFile).addMetadata({
      name: aquaFile.name // Keep original filename for verification
    })

    console.log('   ✅ Aqua proof uploaded:', aquaUpload.cid)

    // 4. Get or create user
    let user = await getUserByEvmAddress(evmAddress)
    if (!user) {
      console.log('   👤 Creating new user...')
      user = await createUser({
        evm_address: evmAddress,
        nostr_npub: nostrNpub || undefined
      })
      console.log('   ✅ User created:', user.id)
    }

    // 5. Create recording in database
    const recording = await createRecording({
      user_id: user.id,
      audio_cid: audioUpload.cid,
      aqua_cid: aquaUpload.cid,
      is_private: true
    })

    console.log('   ✅ Recording saved to database')
    console.log('   🔗 Share ID:', recording.share_id)

    // 6. Return success with share URL (robust origin detection behind proxies)
    const rawForwardedProto = request.headers.get('x-forwarded-proto') || undefined
    const rawForwardedHost = request.headers.get('x-forwarded-host') || undefined
    const xRealHost = request.headers.get('x-real-host') || undefined
    const hostHeader = request.headers.get('host') || undefined

    // If multiple values are present, take the first (original client)
    const forwardedProto = rawForwardedProto?.split(',')[0]?.trim()
    const forwardedHost = rawForwardedHost?.split(',')[0]?.trim()

    // Helper: determine if a host is local
    const isLocalHost = (h?: string) => !!h && (/^localhost(:\d+)?$/i.test(h) || /^127\.0\.0\.1(?::\d+)?$/.test(h))

    // Pick the first non-local host in priority order
    const hostCandidateOrder = [forwardedHost, xRealHost, hostHeader, request.nextUrl.host]
    const host = hostCandidateOrder.find(h => h && !isLocalHost(h)) || request.nextUrl.host

    // Protocol: prefer forwarded proto, else derive from nextUrl; force https for public hosts
    let protocol = (forwardedProto || request.nextUrl.protocol.replace(':', '') || 'https').toLowerCase()
    if (protocol !== 'https' && host && /\.(netlify|vercel|railway)\.app$/i.test(host)) {
      protocol = 'https'
    }

    const origin = `${protocol}://${host}`
    const shareUrl = `${origin}/share/${recording.share_id}`

    return NextResponse.json({
      success: true,
      recording: {
        id: recording.id,
        audio_cid: recording.audio_cid,
        aqua_cid: recording.aqua_cid,
        share_id: recording.share_id,
        created_at: recording.created_at
      },
      shareUrl
    })

  } catch (error) {
    console.error('❌ Upload error:', error)
    return NextResponse.json(
      { 
        error: 'Upload failed', 
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
