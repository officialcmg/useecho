'use client'

import { useState, useEffect, useCallback } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { Mic, Square, Download, Loader2, CheckCircle, Radio } from 'lucide-react'
import { useRecording } from '@/hooks/useRecording'
import { useNostr } from '@/hooks/useNostr'
import {
  deriveNostrKeysFromSignature,
  generateNostrDerivationMessage,
} from '@/lib/nostr/keys'
import {
  createAquafier,
  createGenesisRevision,
  createContentRevision,
  signRevision,
  witnessOnNostr,
  isOk,
  isErr,
  type AquaTree,
} from '@/lib/aqua/aquafier'
import { formatBytes } from '@/lib/utils'
import type { NostrWitness } from '@/lib/aqua/types'
import type Aquafier from 'aqua-js-sdk/web'

const WITNESS_EVERY_N_CHUNKS = 10

export function AudioRecorder() {
  const { ready, authenticated, user, signMessage } = usePrivy()
  const { isRecording, chunks, error, startRecording, stopRecording, resetRecording } =
    useRecording()
  const { publishWitness } = useNostr()

  const [nostrKeys, setNostrKeys] = useState<any>(null)
  const [aquafier, setAquafier] = useState<Aquafier | null>(null)
  const [aquaTree, setAquaTree] = useState<AquaTree | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [processingStatus, setProcessingStatus] = useState<string>('')
  const [witnesses, setWitnesses] = useState<NostrWitness[]>([])
  const [totalSize, setTotalSize] = useState(0)
  const [isInitializingKeys, setIsInitializingKeys] = useState(false)

  // Initialize Aquafier
  useEffect(() => {
    setAquafier(createAquafier())
  }, [])

  // Log user state when authenticated (NO AUTO-CREATION!)
  useEffect(() => {
    if (authenticated && user) {
      console.log('👤 User authenticated:', {
        hasUser: !!user,
        hasWallet: !!user.wallet,
        walletAddress: user.wallet?.address,
        linkedAccounts: user.linkedAccounts?.length,
      })
    }
  }, [authenticated, user])

  // Monitor nostrKeys state changes
  useEffect(() => {
    console.log('🔑 NostrKeys state changed:', nostrKeys ? 'SET' : 'NULL')
    if (nostrKeys) {
      console.log('   Npub:', nostrKeys.npub)
    }
  }, [nostrKeys])

  const initializeNostrKeys = async () => {
    const walletAddress = user?.wallet?.address
    
    if (!walletAddress) {
      console.error('❌ No wallet address available')
      alert('Please wait for your embedded wallet to be created...')
      return
    }

    try {
      setIsInitializingKeys(true)
      console.log('🔐 Generating Nostr keys from wallet signature...')
      console.log('   Wallet:', walletAddress)
      const message = generateNostrDerivationMessage()
      console.log('📝 Message to sign:', message)
      
      // Show wallet UI for demo purposes - user can see the signature request
      const sig = await signMessage({ message }, {
        uiOptions: { showWalletUIs: true },
      })

      console.log('✅ Signature received!')
      console.log('   Signature type:', typeof sig)
      console.log('   Signature:', sig)

      // Extract signature string (Privy returns {signature: '0x...'} object)
      const signatureString = typeof sig === 'string' ? sig : (sig as any)?.signature
      
      if (!signatureString || typeof signatureString !== 'string') {
        console.error('❌ Could not extract signature string:', sig)
        alert('Signature format error. Please try again.')
        return
      }

      console.log('   Deriving Nostr keys from signature...')
      const keys = await deriveNostrKeysFromSignature(signatureString)
      console.log('🎉 Nostr keys generated!')
      console.log('   Npub:', keys.npub)
      console.log('   Nsec:', keys.nsec.substring(0, 20) + '...')
      console.log('   Public Key:', keys.publicKey)
      console.log('   Address:', walletAddress)
      console.log('   Setting nostrKeys state...')
      setNostrKeys(keys)
      console.log('   ✅ NostrKeys state updated!')
    } catch (err) {
      console.error('❌ Failed to derive Nostr keys:')
      console.error('   Error type:', err instanceof Error ? err.constructor.name : typeof err)
      console.error('   Error message:', err instanceof Error ? err.message : String(err))
      console.error('   Full error:', err)
      alert(`Failed to generate Nostr keys: ${err instanceof Error ? err.message : String(err)}`)
    } finally {
      console.log('   Finally block - setting isInitializingKeys to false')
      setIsInitializingKeys(false)
    }
  }

  // Process chunks as they come in
  useEffect(() => {
    if (chunks.length > 0 && isRecording && aquafier && nostrKeys) {
      processLatestChunk()
    }
  }, [chunks.length, isRecording, aquafier, nostrKeys])

  const processLatestChunk = async () => {
    const latestChunk = chunks[chunks.length - 1]
    if (!latestChunk || latestChunk.verificationHash || !aquafier) return // Already processed or no aquafier

    try {
      setIsProcessing(true)
      setProcessingStatus(`Processing chunk ${latestChunk.chunkIndex + 1}...`)
      console.log(`\n🎙️ === Processing Chunk ${latestChunk.chunkIndex + 1} ===`)

      // Create revision
      let result
      let currentTree: AquaTree
      
      if (latestChunk.chunkIndex === 0) {
        // Genesis revision for first chunk
        console.log('   📄 Creating GENESIS revision...')
        result = await createGenesisRevision(
          aquafier,
          latestChunk.audioBlob,
          latestChunk.fileName
        )
        
        if (isErr(result)) {
          console.error('   ❌ Genesis revision failed:', result.data)
          return
        }
        
        console.log('   ✅ Genesis revision created')
        currentTree = result.data.aquaTree!
        setAquaTree(currentTree)
      } else {
        if (!aquaTree) return
        
        // Content revision for subsequent chunks
        console.log('   📄 Creating CONTENT revision...')
        result = await createContentRevision(
          aquafier,
          aquaTree,
          latestChunk.audioBlob,
          latestChunk.fileName,
          latestChunk.verificationHash || ''
        )
        
        if (isErr(result)) {
          console.error('   ❌ Content revision failed:', result.data)
          return
        }
        
        console.log('   ✅ Content revision created')
        currentTree = result.data.aquaTree!
        setAquaTree(currentTree)
      }

      // Get the latest verification hash
      const revisionKeys = Object.keys(currentTree.revisions)
      const lastHash = revisionKeys[revisionKeys.length - 1]
      latestChunk.verificationHash = lastHash
      console.log('   🔗 Verification hash:', lastHash.substring(0, 16) + '...')

      // Sign silently in background
      console.log('   ✍️  Signing silently (no popup)...')
      const message = `I sign this revision: [${lastHash}]`
      const sig = await signMessage({ message }, {
        uiOptions: { showWalletUIs: false }, // Silent signing - NO POPUP!
      })

      const walletAddress = user?.wallet?.address || ''

      // Extract signature string (Privy returns {signature: '0x...'} object)
      const signature = typeof sig === 'string' ? sig : (sig as any)?.signature
      
      if (signature && typeof signature === 'string') {
        console.log('   ✅ Silent signature obtained')
        const signResult = await signRevision(
          aquafier,
          currentTree,
          signature,
          walletAddress,
          lastHash
        )
        
        if (isOk(signResult)) {
          console.log('   ✅ Signature revision added to AquaTree')
          setAquaTree(signResult.data.aquaTree!)
        } else {
          console.error('   ❌ Failed to add signature revision')
        }
      } else {
        console.error('   ❌ Could not extract signature:', sig)
      }

      // Witness every N chunks (e.g., 10, 20, 30...)
      if ((latestChunk.chunkIndex + 1) % WITNESS_EVERY_N_CHUNKS === 0) {
        console.log(`   🌐 Chunk ${latestChunk.chunkIndex + 1} reached - witnessing on Nostr...`)
        setProcessingStatus(`Witnessing chunk ${latestChunk.chunkIndex + 1} on Nostr...`)
        await witnessChunk(latestChunk.chunkIndex, lastHash)
        console.log('   ✅ Nostr witness complete')
      }

      // Update total size
      setTotalSize((prev) => prev + latestChunk.audioBlob.size)
      console.log(`   ✅ Chunk ${latestChunk.chunkIndex + 1} fully processed\n`)
    } catch (err) {
      console.error('Failed to process chunk:', err)
    } finally {
      setIsProcessing(false)
      setProcessingStatus('')
    }
  }

  const witnessChunk = async (chunkIndex: number, verificationHash: string) => {
    try {
      console.log('      📡 Publishing to Nostr relays...')
      const content = `ECHO Audio Recording Witness\nChunk: ${chunkIndex + 1}\nHash: ${verificationHash}\nWallet: ${user?.wallet?.address}\nNostr: ${nostrKeys.npub}`

      const { eventId, relays } = await publishWitness(
        nostrKeys.privateKey,
        content,
        [
          ['chunk', String(chunkIndex + 1)],
          ['hash', verificationHash],
        ]
      )

      console.log('      ✅ Nostr event published:', eventId)
      console.log('      📡 Relays:', relays.join(', '))

      const witness: NostrWitness = {
        chunkIndex,
        eventId,
        timestamp: Date.now(),
        relays,
      }

      setWitnesses((prev) => [...prev, witness])
    } catch (err) {
      console.error('      ❌ Failed to witness on Nostr:', err)
    }
  }

  const handleStartRecording = async () => {
    if (!authenticated || !nostrKeys || !aquafier) {
      alert('Please wait for initialization...')
      return
    }

    resetRecording()
    setWitnesses([])
    setTotalSize(0)
    await startRecording()
  }

  const handleStopRecording = async () => {
    stopRecording()
    
    // Wait a bit for final chunk to be processed
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // ALWAYS witness the final chunk (creates bookends for the recording)
    if (chunks.length > 0 && aquaTree && nostrKeys) {
      const lastChunk = chunks[chunks.length - 1]
      const lastChunkWitnessed = witnesses.some(w => w.chunkIndex === lastChunk.chunkIndex)
      
      if (lastChunk.verificationHash && !lastChunkWitnessed) {
        console.log('🌐 Witnessing final chunk:', lastChunk.chunkIndex + 1)
        await witnessChunk(lastChunk.chunkIndex, lastChunk.verificationHash)
      }

      // Create final revision with combined audio file hash
      console.log('📦 Creating final revision with combined file...')
      try {
        if (!aquafier) {
          console.error('   ❌ Aquafier not initialized')
          return
        }

        const audioBlobs = chunks.map((c) => c.audioBlob)
        const combinedAudio = new Blob(audioBlobs, { type: 'audio/webm' })
        
        // Get the last hash to link from
        const lastHash = lastChunk.verificationHash
        
        if (lastHash) {
          const finalRevisionResult = await createContentRevision(
            aquafier,
            aquaTree,
            combinedAudio,
            'recording_combined.webm',
            lastHash
          )

          if (isOk(finalRevisionResult)) {
            const updatedTree = finalRevisionResult.data.aquaTree!
            
            // Get the final revision hash (latest key in revisions)
            const revisionKeys = Object.keys(updatedTree.revisions)
            const finalHash = revisionKeys[revisionKeys.length - 1]
            
            setAquaTree(updatedTree)
            console.log('   ✅ Final revision created:', finalHash)

            // Sign the final revision with proper message format
            if (user?.wallet?.address && finalHash) {
              const message = `I sign this revision: [${finalHash}]`
              const signatureResponse = await signMessage({ message }, { 
                uiOptions: { showWalletUIs: false }
              })
              const signature = typeof signatureResponse === 'object' && 'signature' in signatureResponse
                ? signatureResponse.signature
                : signatureResponse

              if (typeof signature === 'string') {
                const signResult = await signRevision(
                  aquafier,
                  updatedTree,
                  signature,
                  user.wallet.address,
                  finalHash
                )

                if (isOk(signResult)) {
                  setAquaTree(signResult.data.aquaTree!)
                  console.log('   ✅ Final revision signed')
                }
              }
            }
          }
        }
      } catch (err) {
        console.error('   ❌ Failed to create final revision:', err)
      }
    }
  }

  const handleDownloadAudio = () => {
    if (chunks.length === 0) return

    const timestamp = Date.now()

    // Download combined audio
    const audioBlobs = chunks.map((c) => c.audioBlob)
    const finalAudio = new Blob(audioBlobs, { type: 'audio/webm' })
    const audioUrl = URL.createObjectURL(finalAudio)
    const audioLink = document.createElement('a')
    audioLink.href = audioUrl
    audioLink.download = `echo-recording-${timestamp}.webm`
    audioLink.click()
    URL.revokeObjectURL(audioUrl)
  }

  const handleDownloadProof = () => {
    if (chunks.length === 0) return

    // Create export data with Aqua proof
    const exportData = {
      aquaTree: aquaTree,
      metadata: {
        totalChunks: chunks.length,
        duration: chunks.length * 2, // 2 seconds per chunk
        chunkDuration: 2, // seconds per chunk (needed for verification)
        privyWallet: user?.wallet?.address,
        nostrPubkey: nostrKeys?.npub,
        witnesses,
      },
    }

    // Download Aqua JSON proof
    const aquaJson = JSON.stringify(exportData, null, 2)
    const jsonBlob = new Blob([aquaJson], { type: 'application/json' })
    const jsonUrl = URL.createObjectURL(jsonBlob)
    const jsonLink = document.createElement('a')
    jsonLink.href = jsonUrl
    jsonLink.download = `echo-recording-${Date.now()}.aqua.json`
    jsonLink.click()
    URL.revokeObjectURL(jsonUrl)
  }

  const handleUploadToIPFS = async () => {
    if (chunks.length === 0 || !aquaTree || !user?.wallet?.address) {
      alert('No recording to upload or user not connected')
      return
    }

    try {
      setIsProcessing(true)
      setProcessingStatus('📤 Preparing files...')

      // 1. Create combined audio blob
      const audioBlobs = chunks.map((c) => c.audioBlob)
      const audioFile = new Blob(audioBlobs, { type: 'audio/webm' })

      // 2. Create aqua JSON blob
      const exportData = {
        aquaTree: aquaTree,
        metadata: {
          totalChunks: chunks.length,
          duration: chunks.length * 2,
          chunkDuration: 2,
          privyWallet: user.wallet.address,
          nostrPubkey: nostrKeys?.npub,
          witnesses,
        },
      }
      const aquaJson = JSON.stringify(exportData, null, 2)
      const aquaFileBlob = new Blob([aquaJson], { type: 'application/json' })

      // 3. Create form data
      const formData = new FormData()
      formData.append('audio', audioFile, 'recording.webm')
      formData.append('aqua', aquaFileBlob, 'proof.json')
      formData.append('evmAddress', user.wallet.address)
      if (nostrKeys?.npub) {
        formData.append('nostrNpub', nostrKeys.npub)
      }

      // 4. Upload via API
      setProcessingStatus('☁️ Uploading to IPFS...')
      console.log('📤 Uploading to server...')
      
      const response = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Upload failed')
      }

      const result = await response.json()

      console.log('✅ Upload successful!')
      console.log('🔗 Share URL:', result.shareUrl)

      // 5. Show share URL to user
      setProcessingStatus('✅ Upload complete!')
      
      // Copy to clipboard
      await navigator.clipboard.writeText(result.shareUrl)

      // Show success message
      alert(
        `✅ Recording uploaded to IPFS!\n\n` +
        `🔗 Share link (copied to clipboard):\n${result.shareUrl}\n\n` +
        `📦 Audio CID: ${result.recording.audio_cid}\n` +
        `📄 Proof CID: ${result.recording.aqua_cid}`
      )

    } catch (error) {
      console.error('❌ Upload error:', error)
      alert(`❌ Upload failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsProcessing(false)
      setProcessingStatus('')
    }
  }

  if (!ready || !authenticated) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-400">Please log in to start recording</p>
      </div>
    )
  }

  if (!nostrKeys) {
    const hasWallet = !!user?.wallet?.address
    
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 text-center">
          <h2 className="text-2xl font-bold mb-4 bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
            Generate Your Nostr Identity
          </h2>
          <p className="text-gray-400 mb-6">
            ECHO uses Nostr for decentralized witnessing. Your Nostr keypair will be deterministically derived from your wallet signature.
          </p>
          
          {hasWallet ? (
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 mb-6">
              <p className="text-sm text-gray-400 mb-1">Your Wallet</p>
              <p className="font-mono text-xs text-blue-400 break-all">{user?.wallet?.address}</p>
            </div>
          ) : (
            <div className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 mb-6">
              <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2 text-blue-500" />
              <p className="text-sm text-gray-400">Creating your embedded wallet...</p>
            </div>
          )}

          <button
            onClick={initializeNostrKeys}
            disabled={isInitializingKeys || !hasWallet}
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed px-8 py-4 rounded-xl font-semibold flex items-center justify-center gap-2 mx-auto transition"
          >
            {isInitializingKeys ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Generating Keys...
              </>
            ) : (
              '🔐 Generate Nostr Keys'
            )}
          </button>
          
          <p className="text-sm text-gray-500 mt-4">
            You'll be asked to sign a message to prove wallet ownership
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Status Card */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Recording Status</h2>
          {isRecording && (
            <div className="flex items-center gap-2 text-red-500">
              <Radio className="w-4 h-4 animate-pulse" />
              <span className="text-sm font-medium">LIVE</span>
            </div>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <div className="text-gray-400">Chunks</div>
            <div className="text-2xl font-bold">{chunks.length}</div>
          </div>
          <div>
            <div className="text-gray-400">Size</div>
            <div className="text-2xl font-bold">{formatBytes(totalSize)}</div>
          </div>
          <div>
            <div className="text-gray-400">Duration</div>
            <div className="text-2xl font-bold">{chunks.length * 2}s</div>
          </div>
          <div>
            <div className="text-gray-400">Witnesses</div>
            <div className="text-2xl font-bold">{witnesses.length}</div>
          </div>
        </div>

        {processingStatus && (
          <div className="mt-4 flex items-center gap-2 text-blue-500">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-sm">{processingStatus}</span>
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}
      </div>

      {/* Controls */}
      <div className="flex gap-4">
        {!isRecording ? (
          <button
            onClick={handleStartRecording}
            disabled={isProcessing}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed py-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition"
          >
            <Mic className="w-5 h-5" />
            Start Recording
          </button>
        ) : (
          <button
            onClick={handleStopRecording}
            className="flex-1 bg-red-600 hover:bg-red-700 py-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition"
          >
            <Square className="w-5 h-5" />
            Stop Recording
          </button>
        )}

        {chunks.length > 0 && !isRecording && (
          <>
            <button
              onClick={handleDownloadAudio}
              className="px-6 bg-green-600 hover:bg-green-700 py-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition"
              title="Download the audio file"
            >
              <Download className="w-5 h-5" />
              Audio
            </button>
            <button
              onClick={handleDownloadProof}
              className="px-6 bg-purple-600 hover:bg-purple-700 py-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition"
              title="Download the cryptographic proof to verify this recording"
            >
              <Download className="w-5 h-5" />
              Proof
            </button>
          </>
        )}
      </div>

      {/* Upload to IPFS Button */}
      {chunks.length > 0 && !isRecording && (
        <button
          onClick={handleUploadToIPFS}
          disabled={isProcessing}
          className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed py-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition shadow-lg"
          title="Upload to IPFS and get a shareable link"
        >
          {isProcessing ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              {processingStatus || 'Uploading...'}
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              Upload & Share
            </>
          )}
        </button>
      )}

      {/* Nostr Identity */}
      <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
        <div className="text-sm text-gray-400 mb-1">Your Nostr Identity</div>
        <div className="font-mono text-xs break-all">{nostrKeys.npub}</div>
      </div>

      {/* Witnesses List */}
      {witnesses.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
          <h3 className="font-semibold mb-3">Nostr Witnesses</h3>
          <div className="space-y-2">
            {witnesses.map((w, i) => (
              <div key={i} className="flex items-center gap-2 text-sm">
                <CheckCircle className="w-4 h-4 text-green-500 flex-shrink-0" />
                <span className="text-gray-400">
                  Chunk {w.chunkIndex + 1} witnessed at {new Date(w.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
