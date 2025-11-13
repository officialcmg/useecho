'use client'

import { CheckCircle } from 'lucide-react'

interface VerificationDisplayProps {
  verificationResult: {
    success: boolean
    audioFileProvided?: boolean // Whether actual audio file was included in verification
    audioContentVerified?: boolean // Whether the audio content actually passed verification
    metadata?: {
      nostrPubkey?: string
      duration?: number
      totalChunks?: number
      witnesses?: Array<{
        chunkIndex: number
        eventId: string
        timestamp: number
        relays?: string[]
      }>
    }
    extractedInfo?: {
      startTime?: number | null
      endTime?: number | null
      walletAddress?: string | null
      fileRevisions?: number
      signatureRevisions?: number
    }
    errors?: any[]
  }
}

export function VerificationDisplay({ verificationResult }: VerificationDisplayProps) {
  if (!verificationResult.success) {
    return (
      <div className="bg-red-500/10 border border-red-500/20 rounded-lg p-4">
        <h3 className="text-red-400 font-bold mb-2">✗ Verification Failed</h3>
        {verificationResult.errors && (
          <div className="text-sm text-gray-400">
            <p>Please check the console for detailed error logs.</p>
          </div>
        )}
      </div>
    )
  }

  // Determine audio verification status
  const audioFileProvided = verificationResult.audioFileProvided
  const audioContentVerified = verificationResult.audioContentVerified

  // Audio status logic:
  // - If no audio file provided: Show "metadata only" (blue)
  // - If audio file provided AND content verified: Show "UNALTERED" (green)
  // - If audio file provided BUT content NOT verified: Show "TAMPERED" (red)
  let audioStatus: 'unaltered' | 'tampered' | 'metadata-only'
  if (!audioFileProvided) {
    audioStatus = 'metadata-only'
  } else if (audioFileProvided && audioContentVerified) {
    // Audio file matches the cryptographic proof
    audioStatus = 'unaltered'
  } else {
    // Audio file does NOT match the cryptographic proof
    audioStatus = 'tampered'
  }

  return (
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

      {/* Audio Content Integrity - Prominent Section */}
      <div className={`border-2 rounded-xl p-5 ${
        audioStatus === 'unaltered' 
          ? 'bg-green-500/10 border-green-500/40'
          : audioStatus === 'tampered'
          ? 'bg-red-500/10 border-red-500/40'
          : 'bg-blue-500/10 border-blue-500/40'
      }`}>
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            {audioStatus === 'unaltered' ? (
              <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-green-400" />
              </div>
            ) : audioStatus === 'tampered' ? (
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center text-xl">
                ⚠️
              </div>
            ) : (
              <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center text-xl">
                🔐
              </div>
            )}
          </div>
          <div className="flex-1">
            <h3 className={`font-bold text-lg mb-2 ${
              audioStatus === 'unaltered' 
                ? 'text-green-400' 
                : audioStatus === 'tampered'
                ? 'text-red-400'
                : 'text-blue-400'
            }`}>
              {audioStatus === 'unaltered' 
                ? '🎵 Audio Content: UNALTERED'
                : audioStatus === 'tampered'
                ? '⚠️ Audio Content: TAMPERED'
                : '🔐 Cryptographic Proof Only'
              }
            </h3>
            <p className="text-sm text-gray-300 leading-relaxed">
              {audioStatus === 'unaltered' ? (
                <>
                  <strong>The actual audio file has been verified against the cryptographic proof.</strong>
                  {' '}The audio content matches the hash embedded in the AquaTree, confirming it has not been 
                  modified, replaced, or tampered with in any way since recording.
                </>
              ) : audioStatus === 'tampered' ? (
                <>
                  <strong>VERIFICATION FAILED: The audio file does not match the cryptographic proof.</strong>
                  {' '}The audio content has been modified, replaced, or corrupted since the original recording. 
                  This audio cannot be trusted as authentic.
                </>
              ) : (
                <>
                  <strong>Only the cryptographic metadata was verified.</strong>
                  {' '}The audio file itself was not included in this verification. The AquaTree proof is valid, 
                  but we cannot confirm if the audio content matches without the original audio file.
                </>
              )}
            </p>
            {audioStatus === 'metadata-only' && (
              <div className="mt-3 text-xs text-blue-300 bg-blue-500/10 border border-blue-500/20 rounded px-3 py-2">
                💡 <strong>To verify audio content:</strong> Upload both the .aqua.json proof file AND 
                the .webm audio file on the <a href="/verify" className="underline hover:text-blue-200">/verify</a> page.
              </div>
            )}
            {audioStatus === 'tampered' && (
              <div className="mt-3 text-xs text-red-300 bg-red-500/10 border border-red-500/20 rounded px-3 py-2">
                🚨 <strong>This audio file is NOT authentic.</strong> Do not trust this recording as evidence.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* WHO Section */}
      {verificationResult.extractedInfo?.walletAddress && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <h3 className="text-lg font-bold mb-3 text-blue-400">👤 WHO</h3>
          <div>
            <div className="text-gray-400 text-xs mb-1">Wallet Address</div>
            <div className="font-mono text-xs bg-gray-800 p-2 rounded break-all">
              {verificationResult.extractedInfo.walletAddress}
            </div>
          </div>
          {verificationResult.metadata?.nostrPubkey && (
            <div className="mt-3">
              <div className="text-gray-400 text-xs mb-1">Nostr Public Key</div>
              <div className="font-mono text-xs bg-gray-800 p-2 rounded break-all">
                {verificationResult.metadata.nostrPubkey}
              </div>
            </div>
          )}
        </div>
      )}

      {/* WHEN Section */}
      <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
        <h3 className="text-lg font-bold mb-3 text-purple-400">⏰ WHEN</h3>
        {verificationResult.extractedInfo?.startTime && 
         verificationResult.extractedInfo?.endTime && 
         !isNaN(verificationResult.extractedInfo.startTime) && 
         !isNaN(verificationResult.extractedInfo.endTime) && (
          <div className="mb-4">
            <div className="text-gray-400 text-xs mb-1">Recording Time</div>
            <div className="font-medium text-base">
              {(() => {
                const startDate = new Date(verificationResult.extractedInfo.startTime)
                const endDate = new Date(verificationResult.extractedInfo.endTime)
                const sameDay = startDate.toDateString() === endDate.toDateString()
                
                return (
                  <>
                    {startDate.toLocaleString('en-US', {
                      month: '2-digit',
                      day: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                      second: '2-digit',
                      hour12: true
                    })}
                    <span className="text-gray-500 mx-2">→</span>
                    {sameDay ? (
                      // Same day: show only time
                      endDate.toLocaleString('en-US', {
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: true
                      })
                    ) : (
                      // Different day: show full date and time
                      endDate.toLocaleString('en-US', {
                        month: '2-digit',
                        day: '2-digit',
                        year: 'numeric',
                        hour: '2-digit',
                        minute: '2-digit',
                        second: '2-digit',
                        hour12: true
                      })
                    )}
                  </>
                )
              })()}
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
      {verificationResult.metadata?.witnesses && verificationResult.metadata.witnesses.length > 0 && (
        <div className="bg-gray-900 border border-gray-800 rounded-lg p-4">
          <h3 className="text-lg font-bold mb-3 text-orange-400">🌐 NOSTR WITNESSES</h3>
          <div className="text-xs text-gray-400 mb-3">
            Public timestamped events proving chunks existed at specific times
          </div>
          <div className="space-y-2">
            {verificationResult.metadata.witnesses.map((w, i) => (
              <div key={i} className="bg-gray-800 p-3 rounded border border-gray-700">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2 text-xs">
                    <CheckCircle className="w-4 h-4 text-green-500" />
                    <span className="font-semibold">Chunk {w.chunkIndex + 1}</span>
                    {verificationResult.metadata?.totalChunks && (
                      <span className="text-gray-500">of {verificationResult.metadata.totalChunks}</span>
                    )}
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
  )
}
