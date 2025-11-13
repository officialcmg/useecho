'use client'

import { PrivyProvider } from '@privy-io/react-auth'
import { base } from 'viem/chains'

export function Providers({ children }: { children: React.ReactNode }) {
  const appId = process.env.NEXT_PUBLIC_PRIVY_APP_ID

  if (!appId) {
    throw new Error('NEXT_PUBLIC_PRIVY_APP_ID is not set')
  }

  return (
    // Note: suppressHydrationWarning in layout.tsx handles Privy's modal hydration warnings
    // This is a known issue with Privy's modal rendering invalid HTML structure (<div> in <p>)
    // See: https://github.com/privy-io/privy-js/issues
    <PrivyProvider
      appId={appId}
      config={{
        loginMethods: ['email'], // Email only
        appearance: {
          theme: 'dark',
          accentColor: '#3b82f6',
          logo: '/logo.png',
        },
        embeddedWallets: {
          ethereum: {
            createOnLogin: 'all-users', // AUTOMATICALLY create wallet on login!
          },
          showWalletUIs: false, // Silent signing - no popups!
        },
        defaultChain: base,
        supportedChains: [base],
      }}
    >
      {children}
    </PrivyProvider>
  )
}
