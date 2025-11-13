'use client'

import { useState } from 'react'
import { Header } from '@/components/Header'
import { VerificationDisplay } from '@/components/VerificationDisplay'
import { Upload, CheckCircle, XCircle, Loader2, FileAudio, FileJson } from 'lucide-react'
import { createAquafier, verifyAquaTreeWithExternalFiles, verifyFileContentManually, isOk, isErr } from '@/lib/aqua/aquafier'

export default function VerifyPage() {
  const [audioFile, setAudioFile] = useState<File | null>(null)
  const [aquaFile, setAquaFile] = useState<File | null>(null)
  const [isVerifying, setIsVerifying] = useState(false)
  const [verificationResult, setVerificationResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setAudioFile(file)
      setVerificationResult(null)
      setError(null)
    }
  }

  const handleAquaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      setAquaFile(file)
      setVerificationResult(null)
      setError(null)
    }
  }

  const handleVerify = async () => {
    if (!aquaFile) {
      setError('Please upload the Aqua proof file')
      return
    }

    try {
      setIsVerifying(true)
      setError(null)

      console.log('🔍 Starting verification...')
      
      // Read the Aqua JSON file
      const aquaText = await aquaFile.text()
      const aquaData = JSON.parse(aquaText)
      console.log('   ✅ Parsed Aqua JSON')
      console.log('   Total chunks:', aquaData.metadata?.totalChunks)
      console.log('   Witnesses:', aquaData.metadata?.witnesses?.length || 0)

      // Reconstruct Uint8Arrays from plain objects (JSON serialization issue)
      console.log('   🔄 Reconstructing Uint8Arrays...')
      const reconstructedTree = reconstructAquaTree(aquaData.aquaTree)
      console.log('   ✅ AquaTree reconstructed')

      // Initialize Aquafier and verify
      console.log('   🔐 Verifying embedded content, signatures, and hash chain...')
      const aquafier = createAquafier()
      
      // Optionally pass audio file for combined file verification
      const fileObjects = []
      let audioFileVerified = null
      
      if (audioFile) {
        console.log('   🎵 Including audio file for combined file verification...')
        const audioContent = await audioFile.arrayBuffer()
        fileObjects.push({
          fileName: 'recording_combined.webm', // Must match final revision filename in AquaTree
          fileContent: new Uint8Array(audioContent),
          path: './recording_combined.webm'
        })
      }
      
      const { structureSuccess, structureData, structureErrors, contentVerified, contentData, contentErrors, overallSuccess } = 
        await verifyAquaTreeWithExternalFiles(aquafier, reconstructedTree, fileObjects)
      
      console.log('   📊 SDK Verification result:', {
        structureSuccess,
        contentVerified,
        overallSuccess,
        structureData,
        structureErrors,
        contentData,
        contentErrors
      })
      
      // Manual hash verification if audio file was provided
      let manualVerificationResult = null
      if (audioFile) {
        console.log('   🔐 Performing manual hash verification...')
        const audioContent = await audioFile.arrayBuffer()
        manualVerificationResult = await verifyFileContentManually(
          reconstructedTree,
          'recording_combined.webm',
          new Uint8Array(audioContent)
        )
        console.log('   📊 Manual verification result:', manualVerificationResult)
      }

      // Determine final audio content verification status
      // Use manual verification if available, otherwise fall back to SDK verification
      const finalAudioContentVerified = manualVerificationResult 
        ? manualVerificationResult.success 
        : contentVerified
      
      // Overall success is based on STRUCTURE verification
      // Even if file verification fails, we still show details if structure passes
      const finalOverallSuccess = structureSuccess

      if (finalOverallSuccess) {
        console.log('   ✅ Verification PASSED')
        
        // Extract detailed information from AquaTree
        const revisions = reconstructedTree.revisions || {}
        const revisionEntries = Object.entries(revisions)
        
        // Extract timestamps from revisions
        const timestamps = revisionEntries
          .map(([_, rev]: [string, any]) => {
            const ts = rev.local_timestamp
            if (!ts) return null
            
            // Parse timestamp format: YYYYMMDDHHMMSS (e.g., "20251111211356")
            if (typeof ts === 'string' && ts.length === 14) {
              const year = parseInt(ts.substring(0, 4))
              const month = parseInt(ts.substring(4, 6)) - 1 // JS months are 0-indexed
              const day = parseInt(ts.substring(6, 8))
              const hour = parseInt(ts.substring(8, 10))
              const minute = parseInt(ts.substring(10, 12))
              const second = parseInt(ts.substring(12, 14))
              
              const date = new Date(year, month, day, hour, minute, second)
              return date.getTime()
            }
            
            // Fallback: try parsing as ISO string or use as number
            const parsed = typeof ts === 'number' ? ts : new Date(ts).getTime()
            return isNaN(parsed) ? null : parsed
          })
          .filter((ts): ts is number => ts !== null)
          .sort((a, b) => a - b)
        
        // Extract wallet address from first signature revision
        const signatureRevision = revisionEntries.find(([_, rev]: [string, any]) => 
          rev.revision_type === 'signature'
        ) as [string, any] | undefined
        const walletAddress = signatureRevision ? signatureRevision[1].signature_wallet_address : null
        
        // Count file and signature revisions
        const fileRevisions = revisionEntries.filter(([_, rev]: [string, any]) => 
          rev.revision_type === 'file'
        )
        const signatureRevisions = revisionEntries.filter(([_, rev]: [string, any]) => 
          rev.revision_type === 'signature'
        )
        
        // Calculate proper start and end time
        // Start time should be the ACTUAL recording start, not first revision timestamp
        // First FILE revision is created ~2 seconds into recording (first chunk)
        // So we subtract the chunk duration to get the actual start
        const firstTimestamp = timestamps.length > 0 ? timestamps[0] : null
        const chunkDurationMs = aquaData.metadata?.chunkDuration 
          ? aquaData.metadata.chunkDuration * 1000 
          : 2000 // Default 2 seconds
        
        // Start time = first revision timestamp - chunk duration
        const startTime = firstTimestamp ? (firstTimestamp - chunkDurationMs) : null
        
        const durationMs = aquaData.metadata?.duration 
          ? aquaData.metadata.duration * 1000 
          : 0
        const endTime = startTime ? startTime + durationMs : (timestamps.length > 0 ? timestamps[timestamps.length - 1] : null)
        
        setVerificationResult({
          success: true,
          aquaTree: reconstructedTree,
          metadata: aquaData.metadata,
          details: structureData,
          audioFileProvided: !!audioFile,
          audioContentVerified: finalAudioContentVerified, // Use manual verification result if available
          manualVerification: manualVerificationResult, // Include manual verification details
          extractedInfo: {
            startTime,
            endTime,
            walletAddress,
            totalRevisions: revisionEntries.length,
            fileRevisions: fileRevisions.length,
            signatureRevisions: signatureRevisions.length,
          }
        })
      } else {
        console.log('   ❌ Verification FAILED')
        console.log('   Structure errors:', structureErrors)
        console.log('   Content errors:', contentErrors)
        if (manualVerificationResult) {
          console.log('   Manual verification error:', manualVerificationResult.error)
        }
        setVerificationResult({
          success: false,
          aquaTree: reconstructedTree,
          metadata: aquaData.metadata,
          audioFileProvided: !!audioFile,
          audioContentVerified: false, // Verification failed
          manualVerification: manualVerificationResult, // Include manual verification details even on failure
          errors: structureErrors || contentErrors || (manualVerificationResult?.error ? [manualVerificationResult.error] : []),
        })
      }
    } catch (err) {
      console.error('Verification error:', err)
      setError(err instanceof Error ? err.message : 'Verification failed')
      setVerificationResult({ success: false })
    } finally {
      setIsVerifying(false)
    }
  }

  // Helper function to reconstruct Uint8Arrays from JSON objects
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

  return (
    <>
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-bold mb-2">Verify Recording</h1>
          <p className="text-gray-400">
            Upload the Aqua proof file to verify authenticity
          </p>
          <p className="text-xs text-gray-500 mt-2">
            The proof contains embedded chunks + signatures + witnesses
          </p>
        </div>

        <div className="max-w-md mx-auto mb-6 space-y-4">
          {/* Audio File Upload - OPTIONAL for Phase 2 verification */}
          <div className="bg-gray-900 border-2 border-blue-500/30 rounded-xl p-6">
            <label className="block cursor-pointer">
              <div className="flex items-center gap-2 mb-3">
                <FileAudio className="w-5 h-5 text-blue-500" />
                <span className="font-semibold">Audio File</span>
                <span className="text-xs bg-blue-500/20 text-blue-300 px-2 py-0.5 rounded-full">Optional</span>
              </div>
              <p className="text-xs text-gray-500 mb-3">
                Upload to verify file integrity (Phase 2 feature)
              </p>
              <input
                type="file"
                accept="audio/*,.webm"
                onChange={handleAudioUpload}
                className="hidden"
              />
              <div className="border-2 border-dashed border-blue-500/30 rounded-lg p-8 text-center hover:border-blue-500 transition">
                {audioFile ? (
                  <div>
                    <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                    <p className="text-sm font-medium">{audioFile.name}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {(audioFile.size / 1024 / 1024).toFixed(2)} MB
                    </p>
                  </div>
                ) : (
                  <div>
                    <Upload className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">Click to upload audio (optional)</p>
                    <p className="text-xs text-gray-600 mt-1">.webm file</p>
                  </div>
                )}
              </div>
            </label>
          </div>

          {/* Aqua JSON Upload - REQUIRED */}
          <div className="bg-gray-900 border-2 border-purple-500/30 rounded-xl p-6">
            <label className="block cursor-pointer">
              <div className="flex items-center gap-2 mb-3">
                <FileJson className="w-5 h-5 text-purple-500" />
                <span className="font-semibold">Aqua Proof</span>
                <span className="text-xs bg-purple-500/20 text-purple-300 px-2 py-0.5 rounded-full">Required</span>
              </div>
              <input
                type="file"
                accept=".json"
                onChange={handleAquaUpload}
                className="hidden"
              />
              <div className="border-2 border-dashed border-purple-500/30 rounded-lg p-8 text-center hover:border-purple-500 transition cursor-pointer">
                {aquaFile ? (
                  <div>
                    <CheckCircle className="w-8 h-8 text-green-500 mx-auto mb-2" />
                    <p className="text-sm font-medium">{aquaFile.name}</p>
                    <p className="text-xs text-gray-500 mt-1">
                      {(aquaFile.size / 1024).toFixed(2)} KB
                    </p>
                  </div>
                ) : (
                  <div>
                    <Upload className="w-8 h-8 text-gray-500 mx-auto mb-2" />
                    <p className="text-sm text-gray-400">Click to upload proof</p>
                    <p className="text-xs text-gray-600 mt-1">.aqua.json</p>
                  </div>
                )}
              </div>
            </label>
          </div>
        </div>

        {/* Verify Button */}
        <button
          onClick={handleVerify}
          disabled={!aquaFile || isVerifying}
          className="w-full max-w-md mx-auto bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed py-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition mb-6"
        >
          {isVerifying ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              Verifying...
            </>
          ) : (
            <>
              <CheckCircle className="w-5 h-5" />
              Verify Recording
            </>
          )}
        </button>

        {/* Error Display */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6">
            <div className="flex items-center gap-2 text-red-400">
              <XCircle className="w-5 h-5" />
              <span className="font-medium">Verification Failed</span>
            </div>
            <p className="text-sm text-red-300 mt-2">{error}</p>
          </div>
        )}

        {/* Verification Result */}
        {verificationResult && (
          <div
            className={`border rounded-xl p-6 ${
              verificationResult.success
                ? 'bg-green-500/10 border-green-500/20'
                : 'bg-red-500/10 border-red-500/20'
            }`}
          >
            <div className="flex items-center gap-2 mb-4">
              {verificationResult.success ? (
                <>
                  <CheckCircle className="w-6 h-6 text-green-500" />
                  <h2 className="text-xl font-bold text-green-400">
                    ✓ Cryptographically Verified
                  </h2>
                </>
              ) : (
                <>
                  <XCircle className="w-6 h-6 text-red-500" />
                  <h2 className="text-xl font-bold text-red-400">✗ Verification Failed</h2>
                </>
              )}
            </div>

            {verificationResult.success && (
              <VerificationDisplay verificationResult={verificationResult} />
            )}
          </div>
        )}
      </main>
    </>
  )
}
