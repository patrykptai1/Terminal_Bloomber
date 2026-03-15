import { JetBrains_Mono } from "next/font/google"
import "./globals.css"
import { cn } from "@/lib/utils"

const fontMono = JetBrains_Mono({
  subsets: ["latin", "latin-ext"],
  variable: "--font-mono",
})

export const metadata = {
  title: "Terminal Bloomberg",
  description: "Stock market terminal for US & Polish markets",
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="pl" className="dark">
      <body className={cn("antialiased min-h-screen bg-background", fontMono.variable, "font-mono")}>
        {children}
      </body>
    </html>
  )
}
