import { Header } from '@/components/Header'
import { AudioRecorder } from '@/components/AudioRecorder'
import Image from 'next/image'
import { ShieldCheck } from 'lucide-react'

export default function Home() {
  return (
    <>
      <Header />
      <main className="container mx-auto px-4 py-12 max-w-4xl">
        {/* Hero Section - Centered Layout */}
        <div className="mb-16 text-center space-y-6">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-blue-600/10 border border-blue-500/30 rounded-full text-xs text-blue-400 backdrop-blur-sm">
            <ShieldCheck className="w-3 h-3" />
            Cryptographically Verified
          </div>

          {/* Main Heading */}
          <div className="space-y-4">
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight leading-tight">
              <span className="bg-gradient-to-r from-blue-400 via-cyan-400 to-blue-500 bg-clip-text text-transparent">
                Tamper-Proof
              </span>
              {' '}
              <span className="text-white">Audio Recording</span>
            </h1>
            
            <p className="text-gray-400 text-lg max-w-2xl mx-auto leading-relaxed">
              Unforgeable proof of authenticity with cryptographic verification<br />
              for every recording you make.
            </p>
          </div>

          {/* Tech Stack Pills with Images */}
          <div className="flex items-center justify-center gap-3 flex-wrap pt-2">
            {/* Aqua Protocol */}
            <div className="flex items-center gap-2 px-4 py-2 bg-gray-900/50 border border-gray-800/50 rounded-lg backdrop-blur-sm hover:border-purple-500/30 transition-colors">
              <div className="relative w-5 h-5 flex items-center justify-center">
                <Image
                  src="https://raw.githubusercontent.com/inblockio/aquafier-js/refs/heads/main/web/public/images/ico.png"
                  alt="Aqua Protocol"
                  width={20}
                  height={20}
                  unoptimized
                  className="object-contain"
                />
              </div>
              <span className="text-sm text-gray-300">Aqua</span>
            </div>

            {/* Nostr */}
            <div className="flex items-center gap-2 px-4 py-2 bg-gray-900/50 border border-gray-800/50 rounded-lg backdrop-blur-sm hover:border-orange-500/30 transition-colors">
              <div className="relative w-5 h-5 flex items-center justify-center">
                <Image
                  src="https://raw.githubusercontent.com/satscoffee/nostr_icons/75b4f001d517220748d36360d21fc21f59ad431e/nostr_logo_blk.svg"
                  alt="Nostr"
                  width={20}
                  height={20}
                  unoptimized
                  className="object-contain invert"
                  style={{ width: 'auto', height: 'auto', maxWidth: '100%', maxHeight: '100%' }}
                />
              </div>
              <span className="text-sm text-gray-300">Nostr</span>
            </div>

            {/* IPFS */}
            <div className="flex items-center gap-2 px-4 py-2 bg-gray-900/50 border border-gray-800/50 rounded-lg backdrop-blur-sm hover:border-cyan-500/30 transition-colors">
              <div className="relative w-5 h-5 flex items-center justify-center">
                <Image
                  src="https://docs.ipfs.tech/images/ipfs-logo.svg"
                  alt="IPFS"
                  width={20}
                  height={20}
                  unoptimized
                  className="object-contain"
                  style={{ width: 'auto', height: 'auto', maxWidth: '100%', maxHeight: '100%' }}
                />
              </div>
              <span className="text-sm text-gray-300">IPFS</span>
            </div>
          </div>
        </div>

        {/* Recorder Component */}
        <AudioRecorder />
      </main>
    </>
  )
}
