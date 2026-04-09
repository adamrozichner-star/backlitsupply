import type { Metadata, Viewport } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import './globals.css'
import { cn } from '@/lib/utils'
import Header from '@/components/Header'
import Footer from '@/components/Footer'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})

const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: {
    default: 'Backlit Supply — Custom Backlit Signs for Modern Businesses',
    template: '%s | Backlit Supply',
  },
  description: 'Custom backlit LED signs for your business. Your logo, lit up, shipped in 10 days. Starting at $385.',
  metadataBase: new URL('https://backlitsupply.com'),
  openGraph: {
    title: 'Backlit Supply — Custom Backlit Signs',
    description: 'Your logo. Lit up. In 10 days.',
    url: 'https://backlitsupply.com',
    siteName: 'Backlit Supply',
    type: 'website',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" suppressHydrationWarning className={cn('dark h-full', geistSans.variable, geistMono.variable)}>
      <head>
        {/* Plausible — only loads if domain is configured */}
        {process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN && (
          <script
            defer
            data-domain={process.env.NEXT_PUBLIC_PLAUSIBLE_DOMAIN}
            src="https://plausible.io/js/script.js"
          />
        )}
      </head>
      <body className="flex min-h-full flex-col bg-background font-sans text-foreground antialiased">
        <Header />
        <main className="flex-1 pt-14">{children}</main>
        <Footer />
      </body>
    </html>
  )
}
