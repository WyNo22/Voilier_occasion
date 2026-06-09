"use client"

import { useState, useRef } from "react"
import { useRouter } from "next/navigation"
import { motion } from "framer-motion"
import { Search, X, Loader2 } from "lucide-react"

interface SearchBarProps {
  defaultValue?: string
  compact?: boolean
}

const SUGGESTIONS = [
  "Voilier 10m Méditerranée 45k€",
  "Catamaran traversée atlantique",
  "Amel Super Maramu grand voyage",
  "Bavaria 40 moins de 80k",
  "First 31.7 Bretagne",
]

export function SearchBar({ defaultValue = "", compact = false }: SearchBarProps) {
  const router = useRouter()
  const [value, setValue] = useState(defaultValue)
  const [isLoading, setIsLoading] = useState(false)
  const [showSuggestions, setShowSuggestions] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!value.trim()) return
    setIsLoading(true)
    setShowSuggestions(false)
    router.push(`/search?q=${encodeURIComponent(value.trim())}`)
  }

  const handleSuggestion = (s: string) => {
    setValue(s)
    setShowSuggestions(false)
    setIsLoading(true)
    router.push(`/search?q=${encodeURIComponent(s)}`)
  }

  return (
    <div className="relative">
      <form onSubmit={handleSubmit}>
        <div
          className={`flex items-center glass-card rounded-xl gap-2 transition-all duration-300 focus-within:border-teal-500/50 ${
            compact ? "p-2" : "p-3"
          }`}
          style={{ border: "1px solid rgba(255,255,255,0.1)" }}
        >
          <Search className={`flex-shrink-0 text-white/40 ${compact ? "w-4 h-4 ml-1" : "w-5 h-5 ml-1"}`} />
          <input
            ref={inputRef}
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onFocus={() => setShowSuggestions(true)}
            onBlur={() => setTimeout(() => setShowSuggestions(false), 200)}
            placeholder="Décrivez votre voilier idéal..."
            className={`flex-1 bg-transparent text-white placeholder-white/30 outline-none ${
              compact ? "text-sm" : "text-base"
            }`}
          />
          {value && (
            <button
              type="button"
              onClick={() => { setValue(""); inputRef.current?.focus() }}
              className="flex-shrink-0 text-white/30 hover:text-white/60 transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          )}
          <motion.button
            type="submit"
            disabled={!value.trim() || isLoading}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className={`flex-shrink-0 btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none ${
              compact ? "text-sm px-3 py-1.5" : ""
            }`}
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              "Chercher"
            )}
          </motion.button>
        </div>
      </form>

      {/* Suggestions dropdown */}
      {showSuggestions && !value && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="absolute top-full left-0 right-0 mt-2 glass-card rounded-xl overflow-hidden z-50"
          style={{ border: "1px solid rgba(255,255,255,0.1)" }}
        >
          <p className="text-xs text-white/30 px-4 pt-3 pb-1">Recherches populaires</p>
          {SUGGESTIONS.map((s) => (
            <button
              key={s}
              onMouseDown={() => handleSuggestion(s)}
              className="w-full text-left px-4 py-2.5 text-sm text-white/60 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2"
            >
              <Search className="w-3.5 h-3.5 text-white/20 flex-shrink-0" />
              {s}
            </button>
          ))}
        </motion.div>
      )}
    </div>
  )
}
