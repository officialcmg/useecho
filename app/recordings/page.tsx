'use client'

import { useEffect, useState } from 'react'
import { usePrivy } from '@privy-io/react-auth'
import { Header } from '@/components/Header'
import { Loader2, ExternalLink, Calendar, Copy, CheckCircle } from 'lucide-react'
import Link from 'next/link'

interface Recording {
  id: string
  share_id: string
  audio_cid: string
  aqua_cid: string
  created_at: number
  is_private: boolean
}

export default function RecordingsPage() {
  const { ready, authenticated, user } = usePrivy()
  const [recordings, setRecordings] = useState<Recording[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copiedId, setCopiedId] = useState<string | null>(null)

  useEffect(() => {
    if (!ready || !authenticated || !user?.wallet?.address) {
      setLoading(false)
      return
    }

    async function fetchRecordings() {
      try {
        const response = await fetch(`/api/user/recordings?evm_address=${user?.wallet?.address}`)
        if (!response.ok) {
          throw new Error('Failed to fetch recordings')
        }
        const data = await response.json()
        setRecordings(data.recordings || [])
      } catch (err) {
        console.error('Failed to fetch recordings:', err)
        setError(err instanceof Error ? err.message : 'Failed to load recordings')
      } finally {
        setLoading(false)
      }
    }

    fetchRecordings()
  }, [ready, authenticated, user?.wallet?.address])

  const copyShareLink = async (shareId: string) => {
    const url = `${window.location.origin}/share/${shareId}`
    await navigator.clipboard.writeText(url)
    setCopiedId(shareId)
    
    // Clear copied state after 2 seconds
    setTimeout(() => {
      setCopiedId(null)
    }, 2000)
  }

  if (!ready || loading) {
    return (
      <>
        <Header />
        <main className="container mx-auto px-4 py-16">
          <div className="flex items-center justify-center min-h-[60vh]">
            <Loader2 className="w-8 h-8 animate-spin text-blue-500" />
          </div>
        </main>
      </>
    )
  }

  if (!authenticated) {
    return (
      <>
        <Header />
        <main className="container mx-auto px-4 py-16">
          <div className="mb-8 text-center">
            <h1 className="text-4xl font-bold mb-2">📼 Your Recordings</h1>
            <p className="text-gray-400">All recordings verified with aqua proof</p>
          </div>
        </main>
      </>
    )
  }

  return (
    <>
      <Header />
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-4xl font-bold mb-2">📼 Your Recordings</h1>
          <p className="text-gray-400">
            {recordings.length} recording{recordings.length !== 1 ? 's' : ''} saved
          </p>
        </div>

        {/* Error State */}
        {error && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6">
            <p className="text-red-400">{error}</p>
          </div>
        )}

        {/* Empty State */}
        {!error && recordings.length === 0 && (
          <div className="text-center py-12">
            <ExternalLink className="w-16 h-16 text-gray-600 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">No Recordings Yet</h2>
            <p className="text-gray-400 mb-6">
              Record your first audio to see it here
            </p>
            <Link
              href="/"
              className="inline-block bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-xl font-semibold transition"
            >
              Start Recording
            </Link>
          </div>
        )}

        {/* Recordings List */}
        {recordings.length > 0 && (
          <div className="grid gap-4 sm:gap-6">
            {recordings.map((recording, index) => {
              const recordingDate = new Date(recording.created_at * 1000)
              const recordingTitle = `Recording #${recordings.length - index}`
              
              return (
                <div
                  key={recording.id}
                  className="bg-gray-900 border border-gray-800 rounded-2xl overflow-hidden hover:border-gray-700 transition group"
                >
                  {/* Header */}
                  <div className="bg-gradient-to-r from-blue-600/10 to-purple-600/10 p-4 sm:p-6 border-b border-gray-800">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-3 mb-2">
                          <div className="w-10 h-10 sm:w-12 sm:h-12 bg-blue-600 rounded-xl flex items-center justify-center flex-shrink-0">
                            <ExternalLink className="w-5 h-5 sm:w-6 sm:h-6" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <h3 className="font-bold text-base sm:text-lg text-white truncate">
                              {recordingTitle}
                            </h3>
                            <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-400 mt-0.5">
                              <Calendar className="w-3 h-3 sm:w-4 sm:h-4 flex-shrink-0" />
                              <time className="truncate">
                                {recordingDate.toLocaleDateString('en-US', {
                                  month: 'short',
                                  day: 'numeric',
                                  year: 'numeric',
                                })}
                                {' at '}
                                {recordingDate.toLocaleTimeString('en-US', {
                                  hour: 'numeric',
                                  minute: '2-digit'
                                })}
                              </time>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Content */}
                  <div className="p-4 sm:p-6">
                    {/* Action Buttons */}
                    <div className="grid grid-cols-2 gap-3">
                      <Link
                        href={`/share/${recording.share_id}`}
                        className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-600 hover:bg-blue-700 rounded-xl font-semibold transition text-sm sm:text-base"
                      >
                        <ExternalLink className="w-4 h-4 sm:w-5 sm:h-5" />
                        <span>View Recording</span>
                      </Link>
                      <button
                        onClick={() => copyShareLink(recording.share_id)}
                        className={`flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold transition text-sm sm:text-base ${
                          copiedId === recording.share_id
                            ? 'bg-green-600 text-white'
                            : 'bg-gray-800 hover:bg-gray-700 text-gray-200'
                        }`}
                      >
                        {copiedId === recording.share_id ? (
                          <>
                            <CheckCircle className="w-4 h-4 sm:w-5 sm:h-5" />
                            <span>Copied!</span>
                          </>
                        ) : (
                          <>
                            <Copy className="w-4 h-4 sm:w-5 sm:h-5" />
                            <span>Copy Link</span>
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* CTA */}
        {recordings.length > 0 && (
          <div className="mt-8 text-center">
            <Link
              href="/"
              className="inline-block bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-xl font-semibold transition"
            >
              Record New Audio
            </Link>
          </div>
        )}
      </main>
    </>
  )
}
