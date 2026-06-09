import type { Metadata } from "next"
import { Inter } from "next/font/google"
import "./globals.css"

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
})

export const metadata: Metadata = {
  title: "VoilierScope — Le Skyscanner des voiliers d'occasion",
  description:
    "Recherchez parmi 127 000+ annonces de voiliers d'occasion sur 15 plateformes. Analyse IA, comparaison de prix, et scores de correspondance personnalisés.",
  keywords: [
    "voilier occasion",
    "voilier à vendre",
    "bateau occasion",
    "achat voilier",
    "comparateur voilier",
    "catamaran occasion",
  ],
  authors: [{ name: "VoilierScope" }],
  openGraph: {
    title: "VoilierScope — Le Skyscanner des voiliers d'occasion",
    description:
      "Recherchez parmi 127 000+ annonces de voiliers d'occasion sur 15 plateformes.",
    type: "website",
    locale: "fr_FR",
  },
  twitter: {
    card: "summary_large_image",
    title: "VoilierScope",
    description: "Le Skyscanner des voiliers d'occasion",
  },
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="fr" className="dark">
      <body className={`${inter.variable} font-sans antialiased min-h-screen`}>
        {children}
      </body>
    </html>
  )
}
