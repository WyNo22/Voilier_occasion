"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Image from "next/image"
import { motion, AnimatePresence } from "framer-motion"
import {
  Anchor, MapPin, Calendar, Ruler, Users, Zap,
  ExternalLink, ChevronLeft, ChevronRight, Brain,
  HelpCircle, CheckCircle2, XCircle, Loader2,
  BarChart3, Ship, Gauge
} from "lucide-react"
import type { BoatListing } from "@voilierscope/types"
import { ScoreDisplay, ScoreBar } from "@/components/ScoreDisplay"

const EQUIPMENT_LABELS: Record<string, string> = {
  autopilot: "Pilote automatique",
  windlass: "Guindeau électrique",
  radar: "Radar",
  ais: "AIS (transpondeur)",
  solarPanels: "Panneaux solaires",
  waterMaker: "Dessalinisateur",
  generator: "Génératrice",
  heating: "Chauffage",
  dinghy: "Annexe + moteur",
  electricWinches: "Winchs électriques",
  bowThruster: "Propulseur d'étrave",
  vhf: "VHF (fixe)",
  chartplotter: "Traceur GPS/Chartplotter",
  depthSounder: "Sondeur",
  windInstruments: "Instruments de vent",
  lifeRaft: "Radeau de survie",
  epirb: "EPIRB/PLB",
  sprayhood: "Capote",
  bimini: "Bimini",
  furlingHeadsail: "Génois à enroulement",
  furlingMainsail: "Grande voile à enroulement",
  batteryMonitor: "Contrôleur de batteries",
  inverter: "Onduleur",
}

function formatPrice(price?: number, currency?: string): string {
  if (!price) return "Prix sur demande"
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: currency || "EUR",
    maximumFractionDigits: 0,
  }).format(price)
}

export default function BoatDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [boat, setBoat] = useState<BoatListing | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPhoto, setCurrentPhoto] = useState(0)
  const [aiAnalysis, setAiAnalysis] = useState<{
    aiSummary?: string
    questions?: string[]
  } | null>(null)
  const [isAnalyzing, setIsAnalyzing] = useState(false)

  useEffect(() => {
    async function fetchBoat() {
      try {
        const res = await fetch(`/api/boats/${id}`)
        if (!res.ok) throw new Error("Boat not found")
        const data = await res.json()
        setBoat(data.boat)
      } catch (e) {
        setError(e instanceof Error ? e.message : "Error")
      } finally {
        setIsLoading(false)
      }
    }
    fetchBoat()
  }, [id])

  const handleAnalyze = async () => {
    if (!boat || isAnalyzing) return
    setIsAnalyzing(true)
    try {
      const res = await fetch(`/api/boats/${id}/analyze`, { method: "POST" })
      const data = await res.json()
      setAiAnalysis(data)
    } catch {
      // ignore
    } finally {
      setIsAnalyzing(false)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen ocean-gradient flex items-center justify-center">
        <motion.div
          animate={{ rotate: 360 }}
          transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
        >
          <Anchor className="w-8 h-8 text-teal-400" />
        </motion.div>
      </div>
    )
  }

  if (error || !boat) {
    return (
      <div className="min-h-screen ocean-gradient flex items-center justify-center">
        <div className="text-center">
          <Ship className="w-12 h-12 text-white/20 mx-auto mb-4" />
          <h2 className="text-white text-xl font-semibold mb-2">Annonce introuvable</h2>
          <p className="text-white/40 text-sm mb-6">Cette annonce n&apos;existe pas ou a été supprimée.</p>
          <button
            onClick={() => router.back()}
            className="btn-primary flex items-center gap-2 mx-auto"
          >
            <ChevronLeft className="w-4 h-4" />
            Retour aux résultats
          </button>
        </div>
      </div>
    )
  }

  const photos = boat.photos?.length ? boat.photos : [
    "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=1200"
  ]

  const equipment = boat.equipment as Record<string, boolean> || {}
  const equipmentEntries = Object.entries(equipment).filter(([key]) => key in EQUIPMENT_LABELS)
  const presentEquipment = equipmentEntries.filter(([, v]) => v)
  const absentEquipment = equipmentEntries.filter(([, v]) => !v)

  // Mock price history
  const priceHistory = [
    { month: "Jan", price: (boat.price || 50000) * 1.08 },
    { month: "Fév", price: (boat.price || 50000) * 1.05 },
    { month: "Mar", price: (boat.price || 50000) * 1.03 },
    { month: "Avr", price: (boat.price || 50000) * 1.02 },
    { month: "Mai", price: (boat.price || 50000) * 1.01 },
    { month: "Jun", price: boat.price || 50000 },
  ]

  return (
    <main className="min-h-screen relative">
      <div className="fixed inset-0 ocean-gradient" style={{ backgroundSize: "400% 400%" }} />

      <div className="relative z-10">
        {/* Back button */}
        <div className="max-w-6xl mx-auto px-4 pt-6">
          <button
            onClick={() => router.back()}
            className="flex items-center gap-2 text-white/50 hover:text-white transition-colors text-sm mb-6"
          >
            <ChevronLeft className="w-4 h-4" />
            Retour aux résultats
          </button>
        </div>

        <div className="max-w-6xl mx-auto px-4 pb-12">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left column */}
            <div className="lg:col-span-2 space-y-6">
              {/* Photo gallery */}
              <div className="glass-card rounded-2xl overflow-hidden">
                <div className="relative h-80 sm:h-96">
                  <AnimatePresence mode="wait">
                    <motion.div
                      key={currentPhoto}
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      exit={{ opacity: 0 }}
                      transition={{ duration: 0.3 }}
                      className="absolute inset-0"
                    >
                      <Image
                        src={photos[currentPhoto]}
                        alt={boat.title}
                        fill
                        className="object-cover"
                        priority
                      />
                    </motion.div>
                  </AnimatePresence>

                  {photos.length > 1 && (
                    <>
                      <button
                        onClick={() => setCurrentPhoto((i) => (i - 1 + photos.length) % photos.length)}
                        className="absolute left-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60 transition-colors"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => setCurrentPhoto((i) => (i + 1) % photos.length)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-black/40 backdrop-blur-sm flex items-center justify-center text-white hover:bg-black/60 transition-colors"
                      >
                        <ChevronRight className="w-4 h-4" />
                      </button>

                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                        {photos.map((_, i) => (
                          <button
                            key={i}
                            onClick={() => setCurrentPhoto(i)}
                            className={`w-2 h-2 rounded-full transition-all ${
                              i === currentPhoto ? "bg-white scale-110" : "bg-white/40"
                            }`}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {/* Thumbnails */}
                {photos.length > 1 && (
                  <div className="flex gap-2 p-3 overflow-x-auto">
                    {photos.map((photo, i) => (
                      <button
                        key={i}
                        onClick={() => setCurrentPhoto(i)}
                        className={`flex-shrink-0 w-16 h-12 rounded-lg overflow-hidden border-2 transition-all ${
                          i === currentPhoto
                            ? "border-teal-500"
                            : "border-transparent opacity-60 hover:opacity-80"
                        }`}
                      >
                        <Image src={photo} alt="" width={64} height={48} className="object-cover w-full h-full" />
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Title and basic info */}
              <div className="glass-card rounded-2xl p-6">
                <div className="flex items-start justify-between gap-4 mb-4">
                  <h1 className="text-white font-bold text-xl leading-tight">{boat.title}</h1>
                  {boat.relevanceScore && (
                    <ScoreDisplay score={boat.relevanceScore} size="md" />
                  )}
                </div>

                <div className="text-3xl font-bold text-teal-400 mb-4">
                  {formatPrice(boat.price, boat.currency)}
                </div>

                {/* Specs grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {[
                    { icon: Calendar, label: "Année", value: boat.year?.toString() },
                    { icon: Ruler, label: "Longueur", value: boat.lengthM ? `${boat.lengthM.toFixed(1)} m` : undefined },
                    { icon: Users, label: "Couchages", value: boat.berths?.toString() },
                    { icon: Zap, label: "Moteur", value: boat.enginePower ? `${boat.enginePower} cv` : undefined },
                    { icon: Ship, label: "Tirant d'eau", value: boat.draft ? `${boat.draft} m` : undefined },
                    { icon: Gauge, label: "Heures moteur", value: boat.engineHours ? `${boat.engineHours}h` : undefined },
                    { icon: Users, label: "Cabines", value: boat.cabins?.toString() },
                    { icon: MapPin, label: "Localisation", value: boat.location },
                  ]
                    .filter((s) => s.value)
                    .map(({ icon: Icon, label, value }) => (
                      <div key={label} className="bg-white/5 rounded-xl p-3 border border-white/5">
                        <div className="flex items-center gap-1.5 mb-1">
                          <Icon className="w-3.5 h-3.5 text-teal-400" />
                          <span className="text-white/40 text-xs">{label}</span>
                        </div>
                        <p className="text-white font-semibold text-sm truncate">{value}</p>
                      </div>
                    ))}
                </div>
              </div>

              {/* Description */}
              {boat.description && (
                <div className="glass-card rounded-2xl p-6">
                  <h2 className="text-white font-semibold mb-3 flex items-center gap-2">
                    <Ship className="w-4 h-4 text-teal-400" />
                    Description
                  </h2>
                  <p className="text-white/60 text-sm leading-relaxed">{boat.description}</p>
                </div>
              )}

              {/* Equipment */}
              {equipmentEntries.length > 0 && (
                <div className="glass-card rounded-2xl p-6">
                  <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-teal-400" />
                    Équipements
                  </h2>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {presentEquipment.map(([key]) => (
                      <div key={key} className="flex items-center gap-2 text-sm">
                        <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
                        <span className="text-white/70">{EQUIPMENT_LABELS[key] || key}</span>
                      </div>
                    ))}
                    {absentEquipment.slice(0, 6).map(([key]) => (
                      <div key={key} className="flex items-center gap-2 text-sm">
                        <XCircle className="w-4 h-4 text-white/20 flex-shrink-0" />
                        <span className="text-white/30">{EQUIPMENT_LABELS[key] || key}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Price history */}
              <div className="glass-card rounded-2xl p-6">
                <h2 className="text-white font-semibold mb-4 flex items-center gap-2">
                  <BarChart3 className="w-4 h-4 text-teal-400" />
                  Historique des prix (6 derniers mois)
                </h2>
                <div className="flex items-end gap-2 h-24">
                  {priceHistory.map((entry, i) => {
                    const maxPrice = Math.max(...priceHistory.map((e) => e.price))
                    const height = (entry.price / maxPrice) * 100
                    const isLast = i === priceHistory.length - 1
                    return (
                      <div key={entry.month} className="flex-1 flex flex-col items-center gap-1">
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: `${height}%` }}
                          transition={{ delay: i * 0.1 }}
                          className={`w-full rounded-t-sm ${isLast ? "bg-teal-500" : "bg-white/10"}`}
                          style={{ minHeight: "4px" }}
                        />
                        <span className="text-white/30 text-[10px]">{entry.month}</span>
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* AI Analysis */}
              <div className="glass-card rounded-2xl p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-white font-semibold flex items-center gap-2">
                    <Brain className="w-4 h-4 text-teal-400" />
                    Analyse IA
                  </h2>
                  {!aiAnalysis && (
                    <button
                      onClick={handleAnalyze}
                      disabled={isAnalyzing}
                      className="btn-primary text-sm px-4 py-2 flex items-center gap-2"
                    >
                      {isAnalyzing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Brain className="w-4 h-4" />
                      )}
                      {isAnalyzing ? "Analyse..." : "Analyser"}
                    </button>
                  )}
                </div>

                {aiAnalysis ? (
                  <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">
                    {aiAnalysis.aiSummary && (
                      <div className="bg-teal-500/10 border border-teal-500/20 rounded-xl p-4">
                        <p className="text-white/80 text-sm leading-relaxed">{aiAnalysis.aiSummary}</p>
                      </div>
                    )}
                    {aiAnalysis.questions && (
                      <div>
                        <h3 className="text-white/70 text-sm font-semibold mb-3 flex items-center gap-2">
                          <HelpCircle className="w-4 h-4 text-gold-400" />
                          Questions à poser au vendeur
                        </h3>
                        <ul className="space-y-2">
                          {aiAnalysis.questions.map((q, i) => (
                            <motion.li
                              key={i}
                              initial={{ opacity: 0, x: -10 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.05 }}
                              className="flex items-start gap-2 text-sm text-white/60"
                            >
                              <span className="text-teal-400 font-bold flex-shrink-0">{i + 1}.</span>
                              {q}
                            </motion.li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </motion.div>
                ) : (
                  <p className="text-white/30 text-sm">
                    Cliquez sur &quot;Analyser&quot; pour obtenir un résumé IA et les questions importantes à poser au vendeur.
                  </p>
                )}
              </div>
            </div>

            {/* Right column — sidebar */}
            <div className="space-y-4">
              {/* Score breakdown */}
              {boat.relevanceScore && (
                <div className="glass-card rounded-2xl p-5">
                  <h3 className="text-white font-semibold mb-4 flex items-center gap-2">
                    <BarChart3 className="w-4 h-4 text-teal-400" />
                    Scores de correspondance
                  </h3>
                  <div className="flex justify-center mb-5">
                    <ScoreDisplay score={boat.relevanceScore} size="lg" />
                  </div>
                  <div className="space-y-3">
                    {boat.cruisingScore && (
                      <ScoreBar label="Croisière hauturière" score={boat.cruisingScore} />
                    )}
                    {boat.blueWaterScore && (
                      <ScoreBar label="Grand voyage / Blue water" score={boat.blueWaterScore} />
                    )}
                    {boat.liveaboardScore && (
                      <ScoreBar label="Habitable" score={boat.liveaboardScore} />
                    )}
                  </div>
                </div>
              )}

              {/* Source and CTA */}
              <div className="glass-card rounded-2xl p-5">
                <h3 className="text-white font-semibold mb-3">Voir l&apos;annonce originale</h3>
                <p className="text-white/40 text-xs mb-4">
                  Cette annonce provient de{" "}
                  <span className="text-teal-400 font-medium capitalize">{boat.source}</span>.
                  VoilierScope n&apos;est pas affilié à la plateforme d&apos;origine.
                </p>
                <a
                  href={boat.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn-primary w-full flex items-center justify-center gap-2 text-sm"
                >
                  <ExternalLink className="w-4 h-4" />
                  Voir sur {boat.source}
                </a>
              </div>

              {/* Quick specs */}
              <div className="glass-card rounded-2xl p-5">
                <h3 className="text-white font-semibold mb-4">Caractéristiques</h3>
                <div className="space-y-3 text-sm">
                  {[
                    { label: "Marque", value: boat.brand },
                    { label: "Modèle", value: boat.model },
                    { label: "Type", value: boat.hull === "catamaran" ? "Catamaran" : boat.hull === "trimaran" ? "Trimaran" : "Monocoque" },
                    { label: "Année", value: boat.year?.toString() },
                    { label: "Longueur", value: boat.lengthM ? `${boat.lengthM.toFixed(2)} m` : undefined },
                    { label: "Largeur (bau)", value: boat.beam ? `${boat.beam.toFixed(2)} m` : undefined },
                    { label: "Tirant d'eau", value: boat.draft ? `${boat.draft.toFixed(2)} m` : undefined },
                    { label: "Déplacement", value: boat.displacement ? `${boat.displacement.toLocaleString()} kg` : undefined },
                    { label: "Surface voilure", value: boat.sailArea ? `${boat.sailArea} m²` : undefined },
                    { label: "Moteur", value: boat.engineBrand },
                    { label: "Puissance", value: boat.enginePower ? `${boat.enginePower} cv` : undefined },
                    { label: "Heures moteur", value: boat.engineHours ? `${boat.engineHours.toLocaleString()} h` : undefined },
                    { label: "Cabines", value: boat.cabins?.toString() },
                    { label: "Couchages", value: boat.berths?.toString() },
                    { label: "État", value: boat.condition },
                  ]
                    .filter((s) => s.value)
                    .map(({ label, value }) => (
                      <div key={label} className="flex justify-between items-center">
                        <span className="text-white/40">{label}</span>
                        <span className="text-white/80 font-medium text-right ml-4">{value}</span>
                      </div>
                    ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}
