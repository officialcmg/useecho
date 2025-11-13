'use client'

import { useState, useEffect, useCallback } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { Mic, Square, Download, Loader2, CheckCircle, Radio, Copy, ExternalLink, X } from 'lucide-react'
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
  const { ready, authenticated, user, signMessage, login } = usePrivy()
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
  const [shareUrl, setShareUrl] = useState<string | null>(null)
  const [uploadedRecording, setUploadedRecording] = useState<any>(null)

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

      // Save user to database
      try {
        console.log('💾 Saving user to database...')
        const response = await fetch('/api/user', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            evm_address: walletAddress,
            nostr_npub: keys.npub,
          })
        })
        
        if (response.ok) {
          console.log('   ✅ User saved to database')
        } else {
          console.warn('   ⚠️ Failed to save user (non-critical):', await response.text())
        }
      } catch (dbErr) {
        console.warn('   ⚠️ Database save failed (non-critical):', dbErr)
      }
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
        
        // Content revision for subsequent chunks - need PREVIOUS chunk's hash
        console.log('   📄 Creating CONTENT revision...')
        const previousChunk = chunks[latestChunk.chunkIndex - 1]
        const prevHash = previousChunk?.verificationHash
        
        if (!prevHash) {
          console.error('   ❌ Previous chunk hash not found!')
          return
        }
        
        result = await createContentRevision(
          aquafier,
          aquaTree,
          latestChunk.audioBlob,
          latestChunk.fileName,
          prevHash
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
      const content = `echo Audio Recording Witness\nChunk: ${chunkIndex + 1}\nHash: ${verificationHash}\nWallet: ${user?.wallet?.address}\nNostr: ${nostrKeys.npub}`

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
            
            // 🔧 FIX SDK BUG: The SDK incorrectly uses verificationData (object) instead of 
            // verificationHash (string) when calling maybeUpdateFileIndex, causing "[object Object]" keys.
            // Manually fix the file_index here:
            delete updatedTree.file_index['[object Object]']  // Remove broken key
            updatedTree.file_index[finalHash] = 'recording_combined.webm'  // Add correct key
            
            console.log('   🔧 Fixed file_index - removed [object Object], added:', finalHash)
            console.log('   📝 Final revision data:', updatedTree.revisions[finalHash])
            console.log('   🔑 file_hash:', updatedTree.revisions[finalHash]?.file_hash)
            
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

    // Download the EXACT audio that was hashed and stored in AquaTree
    // Find the recording_combined.webm revision in the AquaTree
    const fileIndexEntries = Object.entries(aquaTree?.file_index || {})
    const combinedRevisionEntry = fileIndexEntries.find(([_, fileName]) => 
      fileName === 'recording_combined.webm'
    )
    
    if (combinedRevisionEntry && aquaTree) {
      const [revisionKey] = combinedRevisionEntry
      const revision = aquaTree.revisions[revisionKey]
      
      if (revision?.content) {
        // Download the EXACT content that was hashed by the SDK
        console.log('📥 Downloading audio from AquaTree embedded content')
        const finalAudio = new Blob([revision.content], { type: 'audio/webm' })
        const audioUrl = URL.createObjectURL(finalAudio)
        const audioLink = document.createElement('a')
        audioLink.href = audioUrl
        audioLink.download = `echo-recording-${timestamp}.webm`
        audioLink.click()
        URL.revokeObjectURL(audioUrl)
        return
      }
    }
    
    // Fallback: Create from chunks (might not match hash!)
    console.warn('⚠️  No embedded content found, creating from chunks (may not match hash)')
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

      // 3. Create form data - USE EXACT FILENAMES FROM AQUATREE!
      const formData = new FormData()
      formData.append('audio', audioFile, 'recording_combined.webm') // Must match AquaTree final revision
      formData.append('aqua', aquaFileBlob, 'recording.aqua.json')   // Standard aqua proof filename
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
      console.log('📦 Audio CID:', result.recording.audio_cid)
      console.log('📄 Proof CID:', result.recording.aqua_cid)

      // Save share URL and recording data to state
      setShareUrl(result.shareUrl)
      setUploadedRecording(result.recording)
      
      // Reset loading state
      setIsProcessing(false)
      setProcessingStatus('')

    } catch (error) {
      console.error('❌ Upload error:', error)
      setIsProcessing(false)
      setProcessingStatus(`❌ ${error instanceof Error ? error.message : 'Upload failed'}`)
      
      // Auto-clear error after 5 seconds
      setTimeout(() => {
        setProcessingStatus('')
      }, 5000)
    }
  }

  const [copySuccess, setCopySuccess] = useState(false)
  
  const handleCopyLink = async () => {
    if (!shareUrl) return
    
    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopySuccess(true)
      setTimeout(() => setCopySuccess(false), 2000)
    } catch (err) {
      // Fallback for browsers that don't support clipboard API
      const textArea = document.createElement('textarea')
      textArea.value = shareUrl
      textArea.style.position = 'fixed'
      textArea.style.opacity = '0'
      document.body.appendChild(textArea)
      textArea.select()
      try {
        document.execCommand('copy')
        setCopySuccess(true)
        setTimeout(() => setCopySuccess(false), 2000)
      } catch (e) {
        console.error('Copy failed:', e)
      }
      document.body.removeChild(textArea)
    }
  }

  const handleNewRecording = () => {
    setShareUrl(null)
    setUploadedRecording(null)
    resetRecording()
    setWitnesses([])
    setAquaTree(null)
    setTotalSize(0)
  }

  if (!ready || !authenticated) {
    return (
      <div className="text-center py-16">
        <div className="max-w-md mx-auto space-y-4">
          <p className="text-gray-400 mb-6">Ready to create tamper-proof recordings?</p>
          <button
            onClick={login}
            className="group relative px-8 py-4 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 rounded-xl font-semibold transition-all shadow-lg shadow-blue-500/30 hover:shadow-blue-500/50 hover:scale-105 text-lg"
          >
            Sign In to Start Recording
            <div className="absolute inset-0 rounded-xl bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
          </button>
          <p className="text-xs text-gray-500 mt-4">No wallet setup required • Email only</p>
        </div>
      </div>
    )
  }

  if (!nostrKeys) {
    const hasWallet = !!user?.wallet?.address
    
    return (
      <div className="max-w-2xl mx-auto">
        <div className="relative overflow-hidden bg-gradient-to-br from-blue-900/20 via-gray-900 to-purple-900/20 border border-blue-500/20 rounded-2xl p-8 md:p-10 shadow-2xl">
          {/* Decorative gradient orb */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -z-10"></div>
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-purple-500/10 rounded-full blur-3xl -z-10"></div>
          
          <div className="text-center relative z-10">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-blue-600/20 border border-blue-500/30 rounded-2xl mb-4">
              <svg className="w-8 h-8 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
              </svg>
            </div>
            
            <h2 className="text-2xl md:text-3xl font-bold mb-3 bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent">
              Generate Your Nostr Identity
            </h2>
            <p className="text-gray-300 mb-8 max-w-lg mx-auto leading-relaxed">
              echo uses Nostr for decentralized witnessing. Your Nostr keypair will be deterministically derived from your wallet signature.
            </p>
            
            {hasWallet ? (
              <div className="bg-black/40 border border-blue-500/20 rounded-xl p-5 mb-8 backdrop-blur-sm">
                <p className="text-sm text-blue-300 mb-2 font-medium">Your Wallet</p>
                <p className="font-mono text-xs md:text-sm text-cyan-400 break-all">{user?.wallet?.address}</p>
              </div>
            ) : (
              <div className="bg-black/40 border border-blue-500/20 rounded-xl p-6 mb-8 backdrop-blur-sm">
                <Loader2 className="w-6 h-6 animate-spin mx-auto mb-3 text-blue-400" />
                <p className="text-sm text-gray-300">Creating your embedded wallet...</p>
              </div>
            )}

            <button
              onClick={initializeNostrKeys}
              disabled={isInitializingKeys || !hasWallet}
              className="relative group bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 disabled:from-gray-700 disabled:to-gray-700 disabled:cursor-not-allowed px-8 py-4 rounded-xl font-semibold flex items-center justify-center gap-2 mx-auto transition-all shadow-lg hover:shadow-blue-500/50 disabled:shadow-none"
            >
              {isInitializingKeys ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Generating Keys...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                  Generate Nostr Keys
                </>
              )}
              <div className="absolute inset-0 bg-gradient-to-r from-blue-400 to-cyan-400 rounded-xl opacity-0 group-hover:opacity-20 blur transition-opacity"></div>
            </button>
            
            <p className="text-sm text-gray-400 mt-5 flex items-center justify-center gap-2">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              You'll be asked to sign a message to prove wallet ownership
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Success Card - Show after upload */}
      {shareUrl && uploadedRecording && (
        <div className="bg-gradient-to-br from-green-900/20 to-blue-900/20 border-2 border-green-500/30 rounded-2xl p-6 md:p-8 shadow-2xl">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-600 rounded-xl flex items-center justify-center">
                <CheckCircle className="w-7 h-7" />
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-bold text-green-400">Recording Uploaded!</h2>
                <p className="text-sm text-gray-400 mt-0.5">Your recording is ready to share</p>
              </div>
            </div>
            <button
              onClick={handleNewRecording}
              className="p-2 hover:bg-gray-800 rounded-lg transition"
              title="New Recording"
            >
              <X className="w-5 h-5 text-gray-400" />
            </button>
          </div>

          {/* Share Link Box */}
          <div className="bg-black/30 border border-gray-700 rounded-xl p-4 md:p-5 mb-4">
            <div className="text-xs text-gray-400 mb-2 font-medium uppercase tracking-wide">Your Share Link</div>
            <div className="text-blue-400 font-mono text-sm md:text-base break-all">
              {shareUrl}
            </div>
          </div>

          {/* Action Buttons */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <button
              onClick={handleCopyLink}
              className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold transition ${
                copySuccess
                  ? 'bg-green-600 text-white'
                  : 'bg-gray-800 hover:bg-gray-700 text-gray-200'
              }`}
            >
              {copySuccess ? (
                <>
                  <CheckCircle className="w-5 h-5" />
                  <span className="hidden sm:inline">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-5 h-5" />
                  <span className="hidden sm:inline">Copy Link</span>
                </>
              )}
            </button>
            
            <a
              href={shareUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded-xl font-semibold transition text-white"
            >
              <ExternalLink className="w-5 h-5" />
              <span className="hidden sm:inline">Open Link</span>
            </a>
          </div>

          {/* Info */}
          <div className="flex flex-col sm:flex-row gap-3 text-xs text-gray-400 border-t border-gray-700 pt-4">
            <div className="flex items-center gap-2">
              <span className="text-gray-500">Share ID:</span>
              <code className="text-gray-300 bg-black/30 px-2 py-1 rounded">{uploadedRecording.share_id}</code>
            </div>
            <div className="hidden sm:block text-gray-700">•</div>
            <div className="flex items-center gap-2">
              <span className="text-gray-500">Created:</span>
              <span className="text-gray-300">{new Date(uploadedRecording.created_at * 1000).toLocaleString()}</span>
            </div>
          </div>
        </div>
      )}

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
