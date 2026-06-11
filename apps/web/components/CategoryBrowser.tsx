"use client"

import { motion } from "framer-motion"
import {
  Sailboat,
  Ship,
  Waves,
  Anchor,
  Cog,
  Caravan,
  Zap,
  Container,
  type LucideIcon,
} from "lucide-react"
import { VEHICLE_CATEGORIES, type VehicleCategory } from "@voilierscope/types"

/** Résolution nom d'icône (types partagés) → composant lucide. */
const ICONS: Record<string, LucideIcon> = {
  sailboat: Sailboat,
  ship: Ship,
  waves: Waves,
  anchor: Anchor,
  cog: Cog,
  caravan: Caravan,
  zap: Zap,
  container: Container,
}

interface CategoryBrowserProps {
  onSelect: (category: VehicleCategory) => void
  className?: string
}

/**
 * Sélecteur de catégories de véhicules marins (DA cartes illustrées).
 * Les catégories désactivées sont affichées « à venir » pour montrer
 * l'ambition d'inventaire sans promettre des données non encore collectées.
 */
export function CategoryBrowser({ onSelect, className = "" }: CategoryBrowserProps) {
  return (
    <div className={className}>
      <div className="flex gap-3 overflow-x-auto pb-3 -mx-1 px-1 snap-x">
        {VEHICLE_CATEGORIES.map((cat, i) => {
          const Icon = ICONS[cat.icon] ?? Anchor
          const disabled = !cat.enabled
          return (
            <motion.button
              key={cat.id}
              type="button"
              disabled={disabled}
              onClick={() => !disabled && onSelect(cat.id)}
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              whileHover={disabled ? undefined : { y: -4 }}
              whileTap={disabled ? undefined : { scale: 0.97 }}
              className={`group relative flex-shrink-0 w-36 snap-start glass-card-hover rounded-2xl p-4 text-left ${
                disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer"
              }`}
              aria-label={cat.label}
            >
              <div className="w-12 h-12 rounded-xl bg-teal-500/10 flex items-center justify-center mb-3 group-hover:bg-teal-500/20 transition-colors">
                <Icon className="w-6 h-6 text-teal-300" />
              </div>
              <div className="text-white font-semibold text-sm leading-tight">{cat.label}</div>
              <div className="text-white/40 text-xs mt-0.5">{cat.tagline}</div>
              {disabled && (
                <span className="absolute top-2 right-2 text-[10px] uppercase tracking-wide text-white/40 bg-white/5 px-1.5 py-0.5 rounded">
                  bientôt
                </span>
              )}
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}
