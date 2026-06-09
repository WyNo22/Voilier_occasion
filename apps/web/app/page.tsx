"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Search, Anchor, BarChart3, Zap, Globe, Star, ChevronRight, Waves, Ship, MapPin, TrendingUp } from "lucide-react"

const PLACEHOLDER_EXAMPLES = [
  "Voilier 10m Méditerranée budget 45k€",
  "Catamaran pour traversée atlantique",
  "First 31.7 Bretagne moins de 30k",
  "Amel super maramu grand voyage",
  "Voilier habitable 12m avec dessalinisateur",
  "Bavaria 40 moins de 5 ans Côte d'Azur",
]

const EXAMPLE_CHIPS = [
  "Voilier 10m Méditerranée 45k€",
  "First 31.7 Bretagne",
  "Traversée Atlantique 80k€",
  "Catamaran famille 4 cabines",
  "Amel grand voyage",
]

const PLATFORMS = [
  "Leboncoin", "Band of Boats", "YachtWorld",
  "Facebook", "Youboat", "Boat24", "iNautia",
]

const FEATURES = [
  {
    icon: Search,
    title: "Recherche IA naturelle",
    description: "Décrivez simplement votre voilier idéal en français. Notre IA comprend vos besoins.",
    color: "text-teal-400",
  },
  {
    icon: Globe,
    title: "15 plateformes agrégées",
    description: "Leboncoin, Band of Boats, YachtWorld, Facebook et plus encore — tout en un seul endroit.",
    color: "text-blue-400",
  },
  {
    icon: BarChart3,
    title: "Score de correspondance",
    description: "Chaque annonce reçoit un score 0-100 basé sur vos critères et l'état du bateau.",
    color: "text-gold-400",
  },
  {
    icon: TrendingUp,
    title: "Historique des prix",
    description: "Suivez l'évolution des prix dans le temps et détectez les bonnes affaires.",
    color: "text-green-400",
  },
  {
    icon: Zap,
    title: "Résultats en temps réel",
    description: "Regardez les résultats arriver en direct pendant que nous cherchons sur toutes les plateformes.",
    color: "text-yellow-400",
  },
  {
    icon: Star,
    title: "Analyse IA des annonces",
    description: "Extraction automatique des équipements, résumé et questions à poser au vendeur.",
    color: "text-purple-400",
  },
]

export default function HomePage() {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [placeholderIndex, setPlaceholderIndex] = useState(0)
  const [isSubmitting, setIsSubmitting] = useState(false)

  useEffect(() => {
    const interval = setInterval(() => {
      setPlaceholderIndex((i) => (i + 1) % PLACEHOLDER_EXAMPLES.length)
    }, 3000)
    return () => clearInterval(interval)
  }, [])

  const handleSearch = (searchQuery: string) => {
    if (!searchQuery.trim()) return
    setIsSubmitting(true)
    router.push(`/search?q=${encodeURIComponent(searchQuery.trim())}`)
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    handleSearch(query)
  }

  return (
    <main className="min-h-screen overflow-hidden relative">
      {/* Animated ocean background */}
      <div
        className="fixed inset-0 ocean-gradient animate-wave-bg"
        style={{ backgroundSize: "400% 400%" }}
      />

      {/* Floating orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div
          className="absolute w-96 h-96 rounded-full opacity-10"
          style={{
            background: "radial-gradient(circle, #00b4d8, transparent)",
            top: "10%",
            left: "5%",
          }}
          animate={{ x: [0, 30, 0], y: [0, 20, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute w-80 h-80 rounded-full opacity-8"
          style={{
            background: "radial-gradient(circle, #f4a261, transparent)",
            bottom: "20%",
            right: "10%",
          }}
          animate={{ x: [0, -20, 0], y: [0, 30, 0] }}
          transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        />
        <motion.div
          className="absolute w-64 h-64 rounded-full opacity-5"
          style={{
            background: "radial-gradient(circle, #90e0ef, transparent)",
            top: "50%",
            left: "50%",
          }}
          animate={{ x: [0, 15, 0], y: [0, -15, 0] }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut", delay: 4 }}
        />
      </div>

      <div className="relative z-10">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-5 max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            className="flex items-center gap-2"
          >
            <div className="w-9 h-9 rounded-xl bg-teal-500 flex items-center justify-center">
              <Anchor className="w-5 h-5 text-navy-900" />
            </div>
            <span className="text-xl font-bold text-white">VoilierScope</span>
          </motion.div>

          <motion.nav
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="hidden md:flex items-center gap-6 text-sm text-white/60"
          >
            <a href="#features" className="hover:text-white transition-colors">Fonctionnalités</a>
            <a href="#platforms" className="hover:text-white transition-colors">Plateformes</a>
            <button className="bg-white/10 hover:bg-white/15 text-white px-4 py-2 rounded-lg transition-colors border border-white/10">
              Connexion
            </button>
          </motion.nav>
        </header>

        {/* Hero Section */}
        <section className="min-h-[85vh] flex flex-col items-center justify-center px-6 pt-10 pb-20">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7 }}
            className="text-center max-w-4xl mx-auto"
          >
            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: 0.2 }}
              className="inline-flex items-center gap-2 bg-teal-500/10 border border-teal-500/30 text-teal-400 text-sm font-medium px-4 py-2 rounded-full mb-8"
            >
              <Zap className="w-3.5 h-3.5" />
              Analyse IA en temps réel
            </motion.div>

            {/* Main title */}
            <h1 className="text-5xl md:text-7xl font-black text-white mb-6 leading-tight tracking-tight">
              Le{" "}
              <span className="text-gradient">Skyscanner</span>
              <br />
              des voiliers d&apos;occasion
            </h1>

            <p className="text-lg md:text-xl text-white/60 max-w-2xl mx-auto mb-12 leading-relaxed">
              Recherchez parmi des milliers d&apos;annonces agrégées depuis toutes les plateformes.
              Notre IA analyse, score et compare chaque voilier selon vos critères.
            </p>

            {/* Search bar */}
            <motion.form
              onSubmit={handleSubmit}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="relative max-w-2xl mx-auto mb-6"
            >
              <div className="flex items-center glass-card rounded-2xl p-2 gap-2 focus-within:border-teal-500/60 transition-all duration-300"
                style={{ border: "1px solid rgba(255,255,255,0.1)" }}>
                <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-teal-500/10 flex items-center justify-center">
                  <Search className="w-5 h-5 text-teal-400" />
                </div>
                <div className="flex-1 relative">
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    className="w-full bg-transparent text-white placeholder-white/30 outline-none text-base py-2 pr-4"
                    autoFocus
                  />
                  {!query && (
                    <div className="absolute inset-0 pointer-events-none flex items-center">
                      <AnimatePresence mode="wait">
                        <motion.span
                          key={placeholderIndex}
                          initial={{ opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -8 }}
                          transition={{ duration: 0.3 }}
                          className="text-white/30 text-base"
                        >
                          {PLACEHOLDER_EXAMPLES[placeholderIndex]}
                        </motion.span>
                      </AnimatePresence>
                    </div>
                  )}
                </div>
                <motion.button
                  type="submit"
                  disabled={isSubmitting || !query.trim()}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex-shrink-0 btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                >
                  {isSubmitting ? (
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                      className="w-5 h-5 border-2 border-navy-900/30 border-t-navy-900 rounded-full"
                    />
                  ) : (
                    <>
                      Rechercher
                      <ChevronRight className="w-4 h-4" />
                    </>
                  )}
                </motion.button>
              </div>
            </motion.form>

            {/* Example chips */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6 }}
              className="flex flex-wrap gap-2 justify-center mb-16"
            >
              {EXAMPLE_CHIPS.map((chip, i) => (
                <motion.button
                  key={chip}
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.6 + i * 0.08 }}
                  onClick={() => handleSearch(chip)}
                  className="text-sm text-white/60 hover:text-white bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 px-3 py-1.5 rounded-full transition-all duration-200"
                >
                  {chip}
                </motion.button>
              ))}
            </motion.div>

            {/* Stats bar */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.8 }}
              className="flex flex-wrap gap-8 justify-center"
            >
              {[
                { icon: Ship, value: "127 000+", label: "annonces" },
                { icon: Globe, value: "15", label: "plateformes" },
                { icon: Zap, value: "Analyse", label: "IA incluse" },
                { icon: MapPin, value: "Europe", label: "+ monde" },
              ].map(({ icon: Icon, value, label }) => (
                <div key={label} className="flex flex-col items-center gap-1">
                  <div className="flex items-center gap-1.5 text-white font-bold text-2xl">
                    <Icon className="w-5 h-5 text-teal-400" />
                    {value}
                  </div>
                  <span className="text-white/40 text-xs uppercase tracking-wide">{label}</span>
                </div>
              ))}
            </motion.div>
          </motion.div>
        </section>

        {/* Platforms section */}
        <section id="platforms" className="py-20 px-6">
          <div className="max-w-4xl mx-auto text-center">
            <motion.p
              initial={{ opacity: 0 }}
              whileInView={{ opacity: 1 }}
              viewport={{ once: true }}
              className="text-white/40 text-sm uppercase tracking-widest mb-8"
            >
              Agrégation simultanée depuis
            </motion.p>
            <div className="flex flex-wrap gap-3 justify-center">
              {PLATFORMS.map((platform, i) => (
                <motion.div
                  key={platform}
                  initial={{ opacity: 0, scale: 0.9 }}
                  whileInView={{ opacity: 1, scale: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.05 }}
                  className="glass-card px-4 py-2 rounded-xl text-white/70 text-sm font-medium"
                >
                  {platform}
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="py-20 px-6">
          <div className="max-w-6xl mx-auto">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              className="text-center mb-16"
            >
              <h2 className="text-4xl font-bold text-white mb-4">
                Tout ce dont vous avez besoin pour{" "}
                <span className="text-gradient">trouver votre voilier</span>
              </h2>
              <p className="text-white/50 text-lg max-w-2xl mx-auto">
                Des outils puissants pour naviguer dans des milliers d&apos;annonces et trouver exactement ce que vous cherchez.
              </p>
            </motion.div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {FEATURES.map((feature, i) => (
                <motion.div
                  key={feature.title}
                  initial={{ opacity: 0, y: 20 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: i * 0.1 }}
                  className="glass-card-hover p-6 rounded-2xl cursor-default"
                >
                  <div className={`w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center mb-4 ${feature.color}`}>
                    <feature.icon className="w-6 h-6" />
                  </div>
                  <h3 className="text-white font-semibold text-lg mb-2">{feature.title}</h3>
                  <p className="text-white/50 text-sm leading-relaxed">{feature.description}</p>
                </motion.div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-24 px-6">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="max-w-2xl mx-auto text-center"
          >
            <Waves className="w-12 h-12 text-teal-400 mx-auto mb-6 animate-float" />
            <h2 className="text-4xl font-bold text-white mb-4">
              Prêt à trouver votre voilier ?
            </h2>
            <p className="text-white/50 mb-8">
              Commencez votre recherche maintenant et laissez notre IA analyser les meilleures annonces pour vous.
            </p>
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => router.push("/search?q=voilier+croisière")}
              className="btn-primary text-lg px-8 py-4 inline-flex items-center gap-2"
            >
              <Anchor className="w-5 h-5" />
              Commencer la recherche
            </motion.button>
          </motion.div>
        </section>

        {/* Footer */}
        <footer className="border-t border-white/5 py-8 px-6">
          <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-4 text-white/30 text-sm">
            <div className="flex items-center gap-2">
              <Anchor className="w-4 h-4 text-teal-500" />
              <span>VoilierScope — Le Skyscanner des voiliers d&apos;occasion</span>
            </div>
            <div className="flex gap-6">
              <a href="#" className="hover:text-white/60 transition-colors">Mentions légales</a>
              <a href="#" className="hover:text-white/60 transition-colors">Contact</a>
              <a href="#" className="hover:text-white/60 transition-colors">API</a>
            </div>
          </div>
        </footer>
      </div>
    </main>
  )
}
