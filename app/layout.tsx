import './globals.css'
import { ReactNode } from 'react'
import { Footer } from '@/components/Footer'
import { NavBar } from '@/components/NavBar'

export const metadata = {
  title: 'echoHZAU-citrus-lab',
  description: '柑橘精油提取条件智能筛选系统'
}

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>
        <NavBar />
        <main className="container main-shell">{children}</main>
        <Footer />
      </body>
    </html>
  )
}
