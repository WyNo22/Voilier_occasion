"use client"

import { motion } from "framer-motion"
import { MapPin } from "lucide-react"
import type { BoatListing } from "@voilierscope/types"

interface MapViewProps {
  boats: BoatListing[]
  onBoatSelect?: (boat: BoatListing) => void
}

// Placeholder map component - in production would use Leaflet or Mapbox
export function MapView({ boats, onBoatSelect }: MapViewProps) {
  const boatsWithCoords = boats.filter((b) => b.latitude && b.longitude)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="glass-card rounded-2xl overflow-hidden relative"
      style={{ height: "400px" }}
    >
      {/* Map placeholder */}
      <div
        className="absolute inset-0 flex flex-col items-center justify-center"
        style={{
          background: "linear-gradient(135deg, #0d2040 0%, #0a3555 50%, #064663 100%)",
        }}
      >
        {/* Grid lines for map effect */}
        <div className="absolute inset-0 opacity-10">
          {Array.from({ length: 10 }).map((_, i) => (
            <div
              key={`h-${i}`}
              className="absolute w-full border-t border-teal-400/30"
              style={{ top: `${i * 10}%` }}
            />
          ))}
          {Array.from({ length: 12 }).map((_, i) => (
            <div
              key={`v-${i}`}
              className="absolute h-full border-l border-teal-400/30"
              style={{ left: `${i * (100 / 12)}%` }}
            />
          ))}
        </div>

        {/* Boat markers */}
        <div className="absolute inset-0">
          {boatsWithCoords.slice(0, 15).map((boat, i) => {
            // Simple position mapping (lat/lng to percentage)
            const x = Math.max(5, Math.min(95, ((boat.longitude! + 180) / 360) * 100))
            const y = Math.max(5, Math.min(95, ((90 - boat.latitude!) / 180) * 100))

            return (
              <motion.button
                key={boat.id}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: i * 0.08 }}
                whileHover={{ scale: 1.3 }}
                onClick={() => onBoatSelect?.(boat)}
                className="absolute -translate-x-1/2 -translate-y-1/2 group"
                style={{ left: `${x}%`, top: `${y}%` }}
              >
                <div className="relative">
                  <div
                    className="w-6 h-6 rounded-full border-2 border-white flex items-center justify-center text-white text-[9px] font-bold shadow-lg"
                    style={{
                      backgroundColor: getScoreColor(boat.relevanceScore || 0),
                    }}
                  >
                    {boat.relevanceScore || "?"}
                  </div>
                  {/* Tooltip */}
                  <div className="absolute bottom-8 left-1/2 -translate-x-1/2 bg-navy-900 border border-white/10 rounded-lg p-2 text-xs whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10 shadow-xl">
                    <p className="text-white font-medium">{boat.brand} {boat.model}</p>
                    <p className="text-white/60">{formatPrice(boat.price, boat.currency)}</p>
                  </div>
                </div>
              </motion.button>
            )
          })}
        </div>

        {boatsWithCoords.length === 0 && (
          <div className="text-center text-white/30">
            <MapPin className="w-10 h-10 mx-auto mb-2 opacity-30" />
            <p className="text-sm">Aucune localisation disponible</p>
          </div>
        )}

        {/* Map attribution placeholder */}
        <div className="absolute bottom-2 right-2 text-white/20 text-[10px]">
          {boatsWithCoords.length} bateaux localisés
        </div>
      </div>
    </motion.div>
  )
}

function getScoreColor(score: number): string {
  if (score >= 85) return "#22c55e"
  if (score >= 70) return "#84cc16"
  if (score >= 55) return "#eab308"
  return "#ef4444"
}

function formatPrice(price?: number, currency?: string): string {
  if (!price) return "Prix sur demande"
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: currency || "EUR",
    maximumFractionDigits: 0,
  }).format(price)
}
