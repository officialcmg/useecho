'use client'

import { usePrivy } from '@privy-io/react-auth'
import { Mic, LogOut, ShieldCheck, Music, Settings, Wallet, Mail, Copy } from 'lucide-react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import Image from 'next/image'
import { useState } from 'react'

export function Header() {
  const { ready, authenticated, user, login, logout } = usePrivy()
  const pathname = usePathname()
  const isVerifyPage = pathname === '/verify'
  const isRecordingsPage = pathname === '/recordings'
  const [showMenu, setShowMenu] = useState(false)
  const [copiedAddress, setCopiedAddress] = useState(false)

  return (
    <header className="border-b border-gray-800/50 sticky top-0 bg-[hsl(240,10%,3.9%)]/80 backdrop-blur-sm z-50">
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 hover:opacity-80 transition-all group">
            <div className="relative">
              <Image 
                src="/logo-icon.png" 
                alt="useecho logo" 
                width={40} 
                height={40}
                className="rounded-xl transition-transform group-hover:scale-105"
              />
              <div className="absolute inset-0 bg-blue-500/20 rounded-xl blur-lg opacity-0 group-hover:opacity-100 transition-opacity -z-10"></div>
            </div>
            <div>
              <h1 className="text-xl font-bold bg-gradient-to-r from-white to-gray-300 bg-clip-text text-transparent">useecho</h1>
              <p className="text-xs text-gray-400 group-hover:text-gray-300 transition-colors">Tamper-Proof Audio</p>
            </div>
          </Link>

          <nav className="flex items-center gap-3">
            {/* Prominent Verify Button */}
            <Link
              href="/verify"
              className={`group relative flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                isVerifyPage
                  ? 'bg-purple-600 text-white shadow-lg shadow-purple-500/20'
                  : 'bg-purple-600/10 text-purple-400 hover:bg-purple-600/20 hover:shadow-lg hover:shadow-purple-500/10 border border-purple-500/20 hover:border-purple-500/30'
              }`}
            >
              <ShieldCheck className={`w-4 h-4 transition-transform ${!isVerifyPage && 'group-hover:scale-110'}`} />
              <span className="hidden sm:inline">Verify</span>
              {!isVerifyPage && <div className="absolute inset-0 rounded-lg bg-purple-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>}
            </Link>

            {/* Recordings Button (only when authenticated) */}
            {ready && authenticated && (
              <Link
                href="/recordings"
                className={`group relative flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-all ${
                  isRecordingsPage
                    ? 'bg-blue-600 text-white shadow-lg shadow-blue-500/20'
                    : 'bg-blue-600/10 text-blue-400 hover:bg-blue-600/20 hover:shadow-lg hover:shadow-blue-500/10 border border-blue-500/20 hover:border-blue-500/30'
                }`}
              >
                <Music className={`w-4 h-4 transition-transform ${!isRecordingsPage && 'group-hover:scale-110'}`} />
                <span className="hidden sm:inline">Recordings</span>
                {!isRecordingsPage && <div className="absolute inset-0 rounded-lg bg-blue-500/5 opacity-0 group-hover:opacity-100 transition-opacity"></div>}
              </Link>
            )}

            {ready && !authenticated && (
              <button
                onClick={login}
                className="group relative px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 rounded-lg font-medium transition-all shadow-lg shadow-blue-500/20 hover:shadow-blue-500/40 hover:scale-105"
              >
                Sign In
                <div className="absolute inset-0 rounded-lg bg-white/10 opacity-0 group-hover:opacity-100 transition-opacity"></div>
              </button>
            )}

            {ready && authenticated && (
              <div className="relative">
                <button
                  onClick={() => setShowMenu(!showMenu)}
                  className="group p-2.5 hover:bg-gray-800 rounded-xl transition-all border border-gray-700/50 hover:border-gray-600"
                >
                  <Settings className="w-5 h-5 text-gray-400 group-hover:text-gray-300 transition-colors" />
                </button>

                {showMenu && (
                  <>
                    {/* Backdrop */}
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setShowMenu(false)}
                    />
                    
                    {/* Dropdown Menu - Styled like nav */}
                    <div className="absolute right-0 mt-2 w-80 bg-[hsl(240,10%,3.9%)]/95 backdrop-blur-md border border-gray-800/50 rounded-xl shadow-2xl z-50 overflow-hidden">
                      {/* Wallet Address - No label */}
                      <div className="p-4 border-b border-gray-800/50">
                        <div className="flex items-center gap-3">
                          <Wallet className="w-4 h-4 text-gray-500 flex-shrink-0" />
                          <code className="flex-1 text-sm text-gray-300 font-mono bg-black/20 px-3 py-2.5 rounded-lg truncate border border-gray-800/30">
                            {user?.wallet?.address || '0x...'}
                          </code>
                          <button
                            onClick={() => {
                              if (user?.wallet?.address) {
                                navigator.clipboard.writeText(user.wallet.address)
                                setCopiedAddress(true)
                                setTimeout(() => setCopiedAddress(false), 2000)
                              }
                            }}
                            className="p-2 hover:bg-gray-800/50 rounded-lg transition-colors flex-shrink-0"
                            title="Copy address"
                          >
                            <Copy className={`w-4 h-4 transition-colors ${copiedAddress ? 'text-green-400' : 'text-gray-500'}`} />
                          </button>
                        </div>
                      </div>

                      {/* Email */}
                      <div className="p-4 border-b border-gray-800/50">
                        <div className="flex items-center gap-3 text-gray-400">
                          <Mail className="w-4 h-4 text-gray-500" />
                          <span className="text-sm text-gray-300">{user?.email?.address || 'No email'}</span>
                        </div>
                      </div>

                      {/* Sign Out */}
                      <button
                        onClick={() => {
                          logout()
                          setShowMenu(false)
                        }}
                        className="w-full p-4 flex items-center gap-3 text-left hover:bg-gray-800/30 transition-colors group"
                      >
                        <LogOut className="w-4 h-4 text-gray-500 group-hover:text-red-400 transition-colors" />
                        <span className="text-sm text-gray-400 group-hover:text-red-400 transition-colors">Sign Out</span>
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </nav>
        </div>
      </div>
    </header>
  )
}
