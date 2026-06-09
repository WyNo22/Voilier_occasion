"use client"

import { motion } from "framer-motion"
import Image from "next/image"
import Link from "next/link"
import {
  Anchor, MapPin, Calendar, Ruler, Users, Zap, ExternalLink
} from "lucide-react"
import type { BoatListing } from "@voilierscope/types"
import { ScoreDisplay } from "./ScoreDisplay"
import { Badge } from "./ui/badge"

interface BoatCardProps {
  boat: BoatListing
  index?: number
  query?: string
}

const SOURCE_COLORS: Record<string, string> = {
  leboncoin: "bg-orange-500/20 text-orange-400 border-orange-500/30",
  facebook: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  bandofboats: "bg-teal-500/20 text-teal-400 border-teal-500/30",
  youboat: "bg-purple-500/20 text-purple-400 border-purple-500/30",
  yachtworld: "bg-green-500/20 text-green-400 border-green-500/30",
  boat24: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
  inautia: "bg-pink-500/20 text-pink-400 border-pink-500/30",
}

const SOURCE_NAMES: Record<string, string> = {
  leboncoin: "Leboncoin",
  facebook: "Facebook",
  bandofboats: "Band of Boats",
  youboat: "Youboat",
  yachtworld: "YachtWorld",
  boat24: "Boat24",
  inautia: "iNautia",
}

function formatPrice(price?: number, currency?: string): string {
  if (!price) return "Prix sur demande"
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: currency || "EUR",
    maximumFractionDigits: 0,
  }).format(price)
}

export function BoatCard({ boat, index = 0 }: BoatCardProps) {
  const score = boat.relevanceScore ?? 0
  const photo = boat.photos?.[0] || "https://images.unsplash.com/photo-1544551763-46a013bb70d5?w=800"
  const sourceColor = SOURCE_COLORS[boat.source] || "bg-white/10 text-white/60 border-white/10"
  const sourceName = SOURCE_NAMES[boat.source] || boat.source

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, delay: index * 0.05 }}
      className="group"
    >
      <Link href={`/boats/${boat.id}`} className="block">
        <div className="glass-card-hover rounded-2xl overflow-hidden cursor-pointer">
          {/* Photo */}
          <div className="relative h-48 overflow-hidden bg-navy-800">
            <Image
              src={photo}
              alt={boat.title}
              fill
              className="object-cover transition-transform duration-500 group-hover:scale-105"
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
            />
            {/* Overlay gradient */}
            <div className="absolute inset-0 bg-gradient-to-t from-navy-900/60 to-transparent" />

            {/* Source badge */}
            <div className={`absolute top-3 left-3 text-xs font-semibold px-2.5 py-1 rounded-lg border ${sourceColor}`}>
              {sourceName}
            </div>

            {/* Hull type */}
            {boat.hull && (
              <div className="absolute top-3 right-3 bg-black/40 backdrop-blur-sm text-white/80 text-xs font-medium px-2 py-1 rounded-lg border border-white/10">
                {boat.hull === "catamaran" ? "Catamaran" : boat.hull === "trimaran" ? "Trimaran" : "Monocoque"}
              </div>
            )}

            {/* Score badge */}
            <div className="absolute bottom-3 right-3">
              <ScoreDisplay score={score} size="sm" showLabel={false} />
            </div>
          </div>

          {/* Content */}
          <div className="p-4 space-y-3">
            {/* Title and price */}
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-white font-semibold text-sm leading-snug line-clamp-2 flex-1">
                {boat.title}
              </h3>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-teal-400 font-bold text-lg">
                {formatPrice(boat.price, boat.currency)}
              </span>
              {boat.relevanceScore && (
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{
                    backgroundColor: `${getScoreColorHex(score)}20`,
                    color: getScoreColorHex(score),
                    border: `1px solid ${getScoreColorHex(score)}40`,
                  }}
                >
                  Score {score}
                </span>
              )}
            </div>

            {/* Specs row */}
            <div className="flex flex-wrap gap-2 text-xs text-white/50">
              {boat.year && (
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {boat.year}
                </span>
              )}
              {boat.lengthM && (
                <span className="flex items-center gap-1">
                  <Ruler className="w-3 h-3" />
                  {boat.lengthM.toFixed(1)}m
                </span>
              )}
              {boat.berths && (
                <span className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {boat.berths} couchages
                </span>
              )}
              {boat.enginePower && (
                <span className="flex items-center gap-1">
                  <Zap className="w-3 h-3" />
                  {boat.enginePower}cv
                </span>
              )}
            </div>

            {/* Location */}
            {boat.location && (
              <div className="flex items-center gap-1 text-xs text-white/40">
                <MapPin className="w-3 h-3 flex-shrink-0" />
                <span className="truncate">{boat.location}</span>
              </div>
            )}

            {/* Equipment chips */}
            {boat.equipment && (
              <div className="flex flex-wrap gap-1.5 pt-1">
                {Object.entries(boat.equipment)
                  .filter(([, v]) => v === true)
                  .slice(0, 4)
                  .map(([key]) => (
                    <span
                      key={key}
                      className="text-[10px] bg-white/5 text-white/40 px-2 py-0.5 rounded-md border border-white/5"
                    >
                      {formatEquipmentKey(key)}
                    </span>
                  ))}
                {Object.entries(boat.equipment).filter(([, v]) => v === true).length > 4 && (
                  <span className="text-[10px] text-white/30 px-1">
                    +{Object.entries(boat.equipment).filter(([, v]) => v === true).length - 4}
                  </span>
                )}
              </div>
            )}

            {/* View link */}
            <div className="flex items-center justify-between pt-1 border-t border-white/5">
              <span className="text-xs text-teal-400 group-hover:text-teal-300 transition-colors flex items-center gap-1">
                <Anchor className="w-3 h-3" />
                Voir le détail
              </span>
              <ExternalLink className="w-3 h-3 text-white/20 group-hover:text-white/40 transition-colors" />
            </div>
          </div>
        </div>
      </Link>
    </motion.div>
  )
}

function getScoreColorHex(score: number): string {
  if (score >= 85) return "#22c55e"
  if (score >= 70) return "#84cc16"
  if (score >= 55) return "#eab308"
  return "#ef4444"
}

function formatEquipmentKey(key: string): string {
  const labels: Record<string, string> = {
    autopilot: "Pilote auto",
    windlass: "Guindeau",
    radar: "Radar",
    ais: "AIS",
    solarPanels: "Solaire",
    waterMaker: "Dessalinisateur",
    generator: "Génératrice",
    heating: "Chauffage",
    dinghy: "Annexe",
    electricWinches: "Winchs élec.",
    bowThruster: "Propulseur AV",
    vhf: "VHF",
    chartplotter: "Traceur GPS",
    depthSounder: "Sondeur",
    windInstruments: "Anémomètre",
    lifeRaft: "Radeau secours",
    epirb: "EPIRB",
    sprayhood: "Capote",
    bimini: "Bimini",
    furlingHeadsail: "Génois enroul.",
    furlingMainsail: "Grande voile enroul.",
    batteryMonitor: "Contrôleur bat.",
    inverter: "Onduleur",
  }
  return labels[key] || key
}

// Skeleton card for loading
export function BoatCardSkeleton() {
  return (
    <div className="glass-card rounded-2xl overflow-hidden">
      <div className="h-48 skeleton" />
      <div className="p-4 space-y-3">
        <div className="h-4 skeleton rounded w-3/4" />
        <div className="h-6 skeleton rounded w-1/2" />
        <div className="flex gap-2">
          <div className="h-3 skeleton rounded w-12" />
          <div className="h-3 skeleton rounded w-12" />
          <div className="h-3 skeleton rounded w-16" />
        </div>
        <div className="h-3 skeleton rounded w-2/3" />
      </div>
    </div>
  )
}
