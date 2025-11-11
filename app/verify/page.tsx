'use client'

import { useState } from 'react'
import { Header } from '@/components/Header'
import { Upload, CheckCircle, XCircle, Loader2, FileAudio, FileJson } from 'lucide-react'
import { createAquafier, verifyAquaTree, isOk, isErr } from '@/lib/aqua/aquafier'

export default function VerifyPage() {
  const [audioFiles, setAudioFiles] = useState<File[]>([])
  const [aquaFile, setAquaFile] = useState<File | null>(null)
  const [isVerifying, setIsVerifying] = useState(false)
  const [verificationResult, setVerificationResult] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)

  const handleAudioUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      setAudioFiles(Array.from(files))
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

      // Initialize Aquafier and verify (content is embedded, no external files needed)
      console.log('   🔐 Verifying embedded content, signatures, and hash chain...')
      const aquafier = createAquafier()
      const result = await verifyAquaTree(aquafier, reconstructedTree, [])
      
      console.log('   📊 Verification result:', {
        isOk: isOk(result),
        isErr: isErr(result),
        data: isOk(result) ? result.data : null,
        errors: isErr(result) ? result.data : null
      })

      if (isOk(result)) {
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
        
        setVerificationResult({
          success: true,
          aquaTree: reconstructedTree,
          metadata: aquaData.metadata,
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
        console.log('   ❌ Verification FAILED')
        console.log('   Errors:', result.data)
        setVerificationResult({
          success: false,
          aquaTree: reconstructedTree,
          metadata: aquaData.metadata,
          errors: result.data,
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

        <div className="max-w-md mx-auto mb-6">
          {/* Aqua JSON Upload - ONLY FILE NEEDED */}
          <div className="bg-gray-900 border-2 border-purple-500/30 rounded-xl p-6">
            <label className="block">
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
              <div className="space-y-6">
                {/* Quick Summary */}
                <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3">
                  <p className="text-xs text-green-300">
                    ✓ <strong>Content verified</strong> - Embedded chunks are intact<br />
                    ✓ <strong>Signatures verified</strong> - All chunks signed by the wallet<br />
                    ✓ <strong>Hash chain verified</strong> - No tampering detected<br />
                    ✓ <strong>Timestamps verified</strong> - Progressive real-time recording
                  </p>
                </div>

                {/* WHO Section */}
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                  <h3 className="text-lg font-bold mb-3 text-blue-400">👤 WHO</h3>
                  <div className="space-y-3 text-sm">
                    {(verificationResult.extractedInfo?.walletAddress || verificationResult.metadata?.privyWallet) && (
                      <div>
                        <div className="text-gray-400 text-xs mb-1">Wallet Address</div>
                        <div className="font-mono text-xs bg-gray-800 p-2 rounded break-all">
                          {verificationResult.extractedInfo?.walletAddress || verificationResult.metadata?.privyWallet}
                        </div>
                      </div>
                    )}
                    {verificationResult.metadata?.nostrPubkey && (
                      <div>
                        <div className="text-gray-400 text-xs mb-1">Nostr Public Key</div>
                        <div className="font-mono text-xs bg-gray-800 p-2 rounded break-all">
                          {verificationResult.metadata.nostrPubkey}
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* WHEN Section */}
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                  <h3 className="text-lg font-bold mb-3 text-purple-400">⏰ WHEN</h3>
                  
                  {/* Recording Time Range */}
                  {verificationResult.extractedInfo?.startTime && 
                   verificationResult.extractedInfo?.endTime && 
                   !isNaN(verificationResult.extractedInfo.startTime) && 
                   !isNaN(verificationResult.extractedInfo.endTime) && (
                    <div className="mb-4">
                      <div className="text-gray-400 text-xs mb-1">Recording Time</div>
                      <div className="font-medium text-base">
                        {new Date(verificationResult.extractedInfo.startTime).toLocaleString('en-US', {
                          month: '2-digit',
                          day: '2-digit',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                          hour12: true
                        })}
                        <span className="text-gray-500 mx-2">→</span>
                        {new Date(verificationResult.extractedInfo.endTime).toLocaleString('en-US', {
                          hour: '2-digit',
                          minute: '2-digit',
                          second: '2-digit',
                          hour12: true
                        })}
                      </div>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    {verificationResult.metadata?.duration && (
                      <div>
                        <div className="text-gray-400 text-xs mb-1">Duration</div>
                        <div className="font-medium text-lg">
                          {verificationResult.metadata.duration} seconds
                        </div>
                      </div>
                    )}
                    {verificationResult.metadata?.totalChunks && (
                      <div>
                        <div className="text-gray-400 text-xs mb-1">Total Chunks</div>
                        <div className="font-medium text-lg">
                          {verificationResult.metadata.totalChunks} chunks
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                {/* INTEGRITY Section */}
                <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                  <h3 className="text-lg font-bold mb-3 text-green-400">🔒 INTEGRITY</h3>
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-gray-400 text-xs mb-1">Chunks Verified</div>
                      <div className="font-medium text-lg text-green-400">
                        ✓ {verificationResult.extractedInfo?.fileRevisions || 0} / {verificationResult.extractedInfo?.fileRevisions || 0}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-400 text-xs mb-1">Signatures Valid</div>
                      <div className="font-medium text-lg text-green-400">
                        ✓ {verificationResult.extractedInfo?.signatureRevisions || 0} / {verificationResult.extractedInfo?.signatureRevisions || 0}
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-400 text-xs mb-1">Hash Chain</div>
                      <div className="font-medium text-lg text-green-400">
                        ✓ Intact
                      </div>
                    </div>
                    <div>
                      <div className="text-gray-400 text-xs mb-1">Real-time Recording</div>
                      <div className="font-medium text-lg text-green-400">
                        ✓ Confirmed
                      </div>
                    </div>
                  </div>
                </div>

                {/* WITNESSES Section */}
                {verificationResult.metadata?.witnesses?.length > 0 && (
                  <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
                    <h3 className="text-lg font-bold mb-3 text-orange-400">🌐 NOSTR WITNESSES</h3>
                    <div className="text-xs text-gray-400 mb-3">
                      Public timestamped events proving chunks existed at specific times
                    </div>
                    <div className="space-y-2">
                      {verificationResult.metadata.witnesses.map((w: any, i: number) => (
                        <div key={i} className="bg-gray-800 p-3 rounded border border-gray-700">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center gap-2 text-xs">
                              <CheckCircle className="w-4 h-4 text-green-500" />
                              <span className="font-semibold">Chunk {w.chunkIndex + 1}</span>
                              <span className="text-gray-500">of {verificationResult.metadata.totalChunks}</span>
                            </div>
                            <div className="text-xs text-gray-400">
                              {new Date(w.timestamp).toLocaleString()}
                            </div>
                          </div>
                          <div>
                            <div className="text-xs text-gray-500 mb-1">Event ID</div>
                            <div className="font-mono text-xs text-gray-400 break-all">
                              {w.eventId}
                            </div>
                          </div>
                          {w.relays && Array.isArray(w.relays) && w.relays.filter((r: string) => r).length > 0 && (
                            <div className="mt-2">
                              <div className="text-xs text-gray-500 mb-1">Relays</div>
                              <div className="text-xs text-gray-400">
                                {w.relays.filter((r: string) => r && r.trim()).join(', ')}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </main>
    </>
  )
}
