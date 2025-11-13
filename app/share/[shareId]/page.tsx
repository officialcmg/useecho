'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import { Header } from '@/components/Header'
import { VerificationDisplay } from '@/components/VerificationDisplay'
import { CustomAudioPlayer } from '@/components/CustomAudioPlayer'
import { Loader2, PlayCircle, CheckCircle, XCircle } from 'lucide-react'
import { createAquafier, verifyAquaTree, isOk } from '@/lib/aqua/aquafier'

interface ShareData {
  recording: {
    id: string
    share_id: string
    created_at: number
  }
  audioData: string // Base64
  aquaData: any
}

export default function SharePage() {
  const params = useParams()
  const shareId = params.shareId as string

  const [data, setData] = useState<ShareData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [verificationResult, setVerificationResult] = useState<any>(null)
  const [isVerifying, setIsVerifying] = useState(false)
  const [audioUrl, setAudioUrl] = useState<string | null>(null)

  const fetchRecording = async () => {
    try {
      setLoading(true)
      setError(null)
      console.log('🔗 Loading shared recording:', shareId)
      
      const response = await fetch(`/api/share/${shareId}`)
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        
        if (response.status === 503) {
          // IPFS propagation issue
          throw new Error(errorData.details || 'Files are still propagating on IPFS. Please try again in a moment.')
        }
        
        throw new Error(errorData.error || 'Recording not found')
      }
      
      const result = await response.json()
      setData(result)

      // Convert base64 to blob URL for audio player
      const audioBlob = base64ToBlob(result.audioData, 'audio/webm')
      const url = URL.createObjectURL(audioBlob)
      setAudioUrl(url)

      console.log('✅ Recording loaded')
      
      // Auto-verify
      verifyRecording(result)
      
    } catch (err) {
      console.error('Failed to load recording:', err)
      setError(err instanceof Error ? err.message : 'Failed to load recording')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRecording()
    
    // Cleanup
    return () => {
      if (audioUrl) {
        URL.revokeObjectURL(audioUrl)
      }
    }
  }, [shareId])

  const verifyRecording = async (shareData: ShareData) => {
    setIsVerifying(true)
    
    try {
      console.log('🔐 Verifying recording...')
      
      const reconstructedTree = reconstructAquaTree(shareData.aquaData.aquaTree)
      const aquafier = createAquafier()
      
      // Include audio file for combined file verification (SAME AS VERIFY PAGE)
      const fileObjects = []
      if (shareData.audioData) {
        console.log('   🎵 Including audio file for combined file verification...')
        // Convert base64 to ArrayBuffer
        const audioBlob = base64ToBlob(shareData.audioData, 'audio/webm')
        const audioContent = await audioBlob.arrayBuffer()
        fileObjects.push({
          fileName: 'recording_combined.webm',
          fileContent: new Uint8Array(audioContent),
          path: './recording_combined.webm'
        })
      }
      
      const result = await verifyAquaTree(aquafier, reconstructedTree, fileObjects)

      if (isOk(result)) {
        console.log('✅ Verification PASSED')
        
        // Extract info
        const revisions = reconstructedTree.revisions || {}
        const revisionEntries = Object.entries(revisions)
        
        // Extract timestamps
        const timestamps = revisionEntries
          .map(([_, rev]: [string, any]) => {
            const ts = rev.local_timestamp
            if (!ts) return null
            
            // Parse YYYYMMDDHHMMSS format
            if (typeof ts === 'string' && ts.length === 14) {
              const year = parseInt(ts.substring(0, 4))
              const month = parseInt(ts.substring(4, 6)) - 1
              const day = parseInt(ts.substring(6, 8))
              const hour = parseInt(ts.substring(8, 10))
              const minute = parseInt(ts.substring(10, 12))
              const second = parseInt(ts.substring(12, 14))
              const date = new Date(year, month, day, hour, minute, second)
              return date.getTime()
            }
            return null
          })
          .filter((ts): ts is number => ts !== null)
          .sort((a, b) => a - b)
        
        // Extract wallet address
        const signatureRevision = revisionEntries.find(([_, rev]: [string, any]) => 
          rev.revision_type === 'signature'
        ) as [string, any] | undefined
        const walletAddress = signatureRevision ? signatureRevision[1].signature_wallet_address : null
        
        // Count revisions
        const fileRevisions = revisionEntries.filter(([_, rev]: [string, any]) => 
          rev.revision_type === 'file'
        )
        const signatureRevisions = revisionEntries.filter(([_, rev]: [string, any]) => 
          rev.revision_type === 'signature'
        )
        
        setVerificationResult({
          success: true,
          aquaTree: reconstructedTree,
          metadata: shareData.aquaData.metadata,
          details: result.data,
          extractedInfo: {
            startTime: timestamps.length > 0 ? timestamps[0] : null,
            endTime: timestamps.length > 0 ? timestamps[timestamps.length - 1] : null,
            walletAddress,
            totalRevisions: revisionEntries.length,
            fileRevisions: fileRevisions.length,
            signatureRevisions: signatureRevisions.length,
          }
        })
      } else {
        console.log('❌ Verification FAILED')
        setVerificationResult({
          success: false,
          errors: result.data
        })
      }
    } catch (err) {
      console.error('Verification error:', err)
      setError('Verification failed')
    } finally {
      setIsVerifying(false)
    }
  }

  // Helper function to reconstruct Uint8Arrays from JSON objects (EXACT COPY FROM VERIFY PAGE)
  function reconstructAquaTree(tree: any): any {
    // Recursively find and convert objects that look like Uint8Arrays
    function convertBuffers(obj: any): any {
      if (obj === null || obj === undefined) return obj
      
      // Check if it's a serialized Uint8Array (object with numeric keys and values)
      if (typeof obj === 'object' && !Array.isArray(obj)) {
        const keys = Object.keys(obj)
        
        // If all keys are numeric strings and all values are numbers 0-255
        const isUint8Array = keys.length > 0 && 
          keys.every(k => !isNaN(Number(k)) && Number(k) >= 0) &&
          Object.values(obj).every(v => typeof v === 'number' && v >= 0 && v <= 255)
        
        if (isUint8Array) {
          // Convert to Uint8Array
          const length = keys.length
          const arr = new Uint8Array(length)
          for (let i = 0; i < length; i++) {
            arr[i] = obj[i]
          }
          return arr
        }
        
        // Otherwise, recursively convert nested objects
        const converted: any = {}
        for (const [key, value] of Object.entries(obj)) {
          converted[key] = convertBuffers(value)
        }
        return converted
      }
      
      if (Array.isArray(obj)) {
        return obj.map(convertBuffers)
      }
      
      return obj
    }
    
    return convertBuffers(tree)
  }

  // Helper to convert base64 to blob
  function base64ToBlob(base64: string, mimeType: string): Blob {
    const byteCharacters = atob(base64)
    const byteNumbers = new Array(byteCharacters.length)
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i)
    }
    const byteArray = new Uint8Array(byteNumbers)
    return new Blob([byteArray], { type: mimeType })
  }

  if (loading) {
    return (
      <>
        <Header />
        <main className="container mx-auto px-4 py-16">
          <div className="flex flex-col items-center justify-center min-h-[60vh]">
            <Loader2 className="w-12 h-12 animate-spin text-blue-500 mb-4" />
            <p className="text-gray-400">Loading recording...</p>
          </div>
        </main>
      </>
    )
  }

  if (error || !data) {
    const isIPFSError = error?.includes('propagating') || error?.includes('IPFS')
    
    return (
      <>
        <Header />
        <main className="container mx-auto px-4 py-16">
          <div className="flex flex-col items-center justify-center min-h-[60vh] max-w-2xl mx-auto">
            <XCircle className="w-16 h-16 text-red-500 mb-4" />
            <h1 className="text-2xl font-bold mb-2">
              {isIPFSError ? 'Files Still Loading...' : 'Recording Not Found'}
            </h1>
            <p className="text-gray-400 text-center mb-6">
              {error || 'This recording does not exist or has been removed.'}
            </p>
            
            {isIPFSError && (
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-6 max-w-md">
                <p className="text-sm text-blue-300 text-center">
                  <strong>What's happening?</strong><br/>
                  Your recording was just uploaded. IPFS files can take 10-30 seconds to propagate across the network.
                </p>
              </div>
            )}
            
            <div className="flex gap-3">
              <button
                onClick={fetchRecording}
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 px-6 py-3 rounded-xl font-semibold flex items-center gap-2 transition"
              >
                {loading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    Retrying...
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Try Again
                  </>
                )}
              </button>
              
              <a
                href="/"
                className="bg-gray-700 hover:bg-gray-600 px-6 py-3 rounded-xl font-semibold transition"
              >
                Go Home
              </a>
            </div>
          </div>
        </main>
      </>
    )
  }

  return (
    <>
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Title */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold mb-2">🎙️ Shared Recording</h1>
          <p className="text-gray-400">
            Recorded on {new Date(data.recording.created_at * 1000).toLocaleString()}
          </p>
        </div>

        {/* Audio Player */}
        {audioUrl && (
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-4">
              <PlayCircle className="w-6 h-6 text-blue-500" />
              <h2 className="text-xl font-bold">Audio Playback</h2>
            </div>
            <CustomAudioPlayer src={audioUrl} />
          </div>
        )}

        {/* Verification Status */}
        <div className="mb-6">
          {isVerifying && (
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 text-center">
              <Loader2 className="w-8 h-8 animate-spin text-blue-500 mx-auto mb-2" />
              <p className="text-gray-400">Verifying authenticity...</p>
            </div>
          )}

          {verificationResult && !isVerifying && (
            <div className={`rounded-xl p-6 border ${
              verificationResult.success 
                ? 'bg-green-500/10 border-green-500/20' 
                : 'bg-red-500/10 border-red-500/20'
            }`}>
              <div className="flex items-center gap-3 mb-4">
                {verificationResult.success ? (
                  <CheckCircle className="w-8 h-8 text-green-500" />
                ) : (
                  <XCircle className="w-8 h-8 text-red-500" />
                )}
                <h2 className="text-2xl font-bold">
                  {verificationResult.success ? '✓ Cryptographically Verified' : '✗ Verification Failed'}
                </h2>
              </div>

              {verificationResult.success && (
                <VerificationDisplay verificationResult={verificationResult} />
              )}
            </div>
          )}
        </div>
      </main>
    </>
  )
}
