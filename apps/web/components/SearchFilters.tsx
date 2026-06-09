"use client"

import { useState } from "react"
import { motion } from "framer-motion"
import { SlidersHorizontal, RotateCcw, ChevronDown, ChevronUp } from "lucide-react"
import { Slider } from "./ui/slider"
import { Checkbox } from "./ui/checkbox"
import type { SearchQuery } from "@voilierscope/types"

interface SearchFiltersProps {
  query: SearchQuery
  onFiltersChange: (updates: Partial<SearchQuery>) => void
}

interface FilterSectionProps {
  title: string
  children: React.ReactNode
  defaultOpen?: boolean
}

function FilterSection({ title, children, defaultOpen = true }: FilterSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="border-b border-white/5 pb-4 mb-4 last:border-0 last:mb-0 last:pb-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between w-full text-white/70 hover:text-white text-sm font-semibold mb-3 transition-colors"
      >
        {title}
        {open ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
      </button>
      {open && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          exit={{ opacity: 0, height: 0 }}
        >
          {children}
        </motion.div>
      )}
    </div>
  )
}

export function SearchFilters({ query, onFiltersChange }: SearchFiltersProps) {
  const [priceRange, setPriceRange] = useState([
    query.minPrice ? query.minPrice / 1000 : 0,
    query.maxPrice ? query.maxPrice / 1000 : 500,
  ])
  const [lengthRange, setLengthRange] = useState([
    query.minLength || 0,
    query.maxLength || 25,
  ])
  const [yearRange, setYearRange] = useState([
    query.minYear || 1980,
    query.maxYear || 2024,
  ])

  const handlePriceChange = (values: number[]) => {
    setPriceRange(values)
    onFiltersChange({
      minPrice: values[0] > 0 ? values[0] * 1000 : undefined,
      maxPrice: values[1] < 500 ? values[1] * 1000 : undefined,
    })
  }

  const handleLengthChange = (values: number[]) => {
    setLengthRange(values)
    onFiltersChange({
      minLength: values[0] > 0 ? values[0] : undefined,
      maxLength: values[1] < 25 ? values[1] : undefined,
    })
  }

  const handleYearChange = (values: number[]) => {
    setYearRange(values)
    onFiltersChange({
      minYear: values[0] > 1980 ? values[0] : undefined,
      maxYear: values[1] < 2024 ? values[1] : undefined,
    })
  }

  const handleReset = () => {
    setPriceRange([0, 500])
    setLengthRange([0, 25])
    setYearRange([1980, 2024])
    onFiltersChange({
      minPrice: undefined,
      maxPrice: undefined,
      minLength: undefined,
      maxLength: undefined,
      minYear: undefined,
      maxYear: undefined,
      hullType: undefined,
    })
  }

  return (
    <div className="glass-card rounded-2xl p-5 sticky top-4">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2 text-white font-semibold">
          <SlidersHorizontal className="w-4 h-4 text-teal-400" />
          Filtres
        </div>
        <button
          onClick={handleReset}
          className="flex items-center gap-1 text-xs text-white/40 hover:text-white/70 transition-colors"
        >
          <RotateCcw className="w-3 h-3" />
          Réinitialiser
        </button>
      </div>

      {/* Budget */}
      <FilterSection title="Budget">
        <div className="px-1 space-y-3">
          <Slider
            min={0}
            max={500}
            step={5}
            value={priceRange}
            onValueChange={handlePriceChange}
          />
          <div className="flex items-center justify-between text-xs text-white/50">
            <span>{priceRange[0] > 0 ? `${priceRange[0]}k€` : "Min"}</span>
            <span>{priceRange[1] < 500 ? `${priceRange[1]}k€` : "Max"}</span>
          </div>
        </div>
      </FilterSection>

      {/* Length */}
      <FilterSection title="Longueur">
        <div className="px-1 space-y-3">
          <Slider
            min={0}
            max={25}
            step={0.5}
            value={lengthRange}
            onValueChange={handleLengthChange}
          />
          <div className="flex items-center justify-between text-xs text-white/50">
            <span>{lengthRange[0] > 0 ? `${lengthRange[0]}m` : "Min"}</span>
            <span>{lengthRange[1] < 25 ? `${lengthRange[1]}m` : "Max"}</span>
          </div>
        </div>
      </FilterSection>

      {/* Year */}
      <FilterSection title="Année de construction">
        <div className="px-1 space-y-3">
          <Slider
            min={1970}
            max={2024}
            step={1}
            value={yearRange}
            onValueChange={handleYearChange}
          />
          <div className="flex items-center justify-between text-xs text-white/50">
            <span>{yearRange[0] > 1970 ? yearRange[0] : "Toutes années"}</span>
            <span>{yearRange[1]}</span>
          </div>
        </div>
      </FilterSection>

      {/* Hull type */}
      <FilterSection title="Type de coque">
        <div className="space-y-2">
          {[
            { value: undefined, label: "Tous types" },
            { value: "monohull" as const, label: "Monocoque" },
            { value: "catamaran" as const, label: "Catamaran" },
            { value: "trimaran" as const, label: "Trimaran" },
          ].map((option) => (
            <label
              key={option.label}
              className="flex items-center gap-2.5 cursor-pointer group"
            >
              <Checkbox
                checked={query.hullType === option.value}
                onCheckedChange={() =>
                  onFiltersChange({ hullType: option.value })
                }
              />
              <span className="text-sm text-white/60 group-hover:text-white/80 transition-colors">
                {option.label}
              </span>
            </label>
          ))}
        </div>
      </FilterSection>

      {/* Equipment */}
      <FilterSection title="Équipements" defaultOpen={false}>
        <div className="space-y-2">
          {[
            { key: "dessalinisateur", label: "Dessalinisateur" },
            { key: "panneaux_solaires", label: "Panneaux solaires" },
            { key: "radar", label: "Radar" },
            { key: "ais", label: "AIS" },
            { key: "pilote_automatique", label: "Pilote automatique" },
            { key: "generatrice", label: "Génératrice" },
          ].map(({ key, label }) => (
            <label key={key} className="flex items-center gap-2.5 cursor-pointer group">
              <Checkbox
                checked={query.equipment?.includes(key) || false}
                onCheckedChange={(checked) => {
                  const current = query.equipment || []
                  onFiltersChange({
                    equipment: checked
                      ? [...current, key]
                      : current.filter((e) => e !== key),
                  })
                }}
              />
              <span className="text-sm text-white/60 group-hover:text-white/80 transition-colors">
                {label}
              </span>
            </label>
          ))}
        </div>
      </FilterSection>

      {/* Sort */}
      <FilterSection title="Trier par" defaultOpen={false}>
        <div className="space-y-2">
          {[
            { value: "score_desc" as const, label: "Score (meilleur en premier)" },
            { value: "price_asc" as const, label: "Prix croissant" },
            { value: "price_desc" as const, label: "Prix décroissant" },
            { value: "year_desc" as const, label: "Plus récent" },
          ].map((option) => (
            <label
              key={option.value}
              className="flex items-center gap-2.5 cursor-pointer group"
            >
              <Checkbox
                checked={query.sortBy === option.value}
                onCheckedChange={() => onFiltersChange({ sortBy: option.value })}
              />
              <span className="text-sm text-white/60 group-hover:text-white/80 transition-colors">
                {option.label}
              </span>
            </label>
          ))}
        </div>
      </FilterSection>
    </div>
  )
}
