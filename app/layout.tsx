import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'XVenture — Book Your Team Experience',
  description: 'Book an immersive virtual team experience with XVenture. Choose your theme, pick a date and time, and pay securely online.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
