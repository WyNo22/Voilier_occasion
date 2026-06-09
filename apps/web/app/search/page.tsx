"use client"

import { useState, useEffect, useCallback, useRef, Suspense } from "react"
import { useSearchParams, useRouter } from "next/navigation"
import { motion, AnimatePresence } from "framer-motion"
import { Anchor, LayoutGrid, List, Map as MapIcon, SlidersHorizontal, X } from "lucide-react"
import type { BoatListing, PlatformStatus, SearchProgress, SearchQuery } from "@voilierscope/types"
import { PLATFORMS } from "@voilierscope/types"
import { SearchBar } from "@/components/SearchBar"
import { SearchProgress as SearchProgressComponent } from "@/components/SearchProgress"
import { BoatCard, BoatCardSkeleton } from "@/components/BoatCard"
import { SearchFilters } from "@/components/SearchFilters"
import { MapView } from "@/components/MapView"

function SearchPageContent() {
  const searchParams = useSearchParams()
  const router = useRouter()
  const rawQuery = searchParams.get("q") || ""

  const [platforms, setPlatforms] = useState<PlatformStatus[]>(
    PLATFORMS.map((p) => ({
      name: p.id,
      displayName: p.displayName,
      status: "pending" as const,
    }))
  )
  const [allListings, setAllListings] = useState<BoatListing[]>([])
  const [filteredListings, setFilteredListings] = useState<BoatListing[]>([])
  const [isComplete, setIsComplete] = useState(false)
  const [totalFound, setTotalFound] = useState(0)
  const [progressMessage, setProgressMessage] = useState("Analyse de votre demande...")
  const [viewMode, setViewMode] = useState<"grid" | "list" | "map">("grid")
  const [showFilters, setShowFilters] = useState(false)
  const [filters, setFilters] = useState<Partial<SearchQuery>>({})
  const [isLoading, setIsLoading] = useState(true)
  const eventSourceRef = useRef<EventSource | null>(null)

  const applyFilters = useCallback(
    (listings: BoatListing[], currentFilters: Partial<SearchQuery>) => {
      let result = [...listings]

      if (currentFilters.minPrice) {
        result = result.filter((b) => !b.price || b.price >= currentFilters.minPrice!)
      }
      if (currentFilters.maxPrice) {
        result = result.filter((b) => !b.price || b.price <= currentFilters.maxPrice!)
      }
      if (currentFilters.minLength) {
        result = result.filter((b) => !b.lengthM || b.lengthM >= currentFilters.minLength!)
      }
      if (currentFilters.maxLength) {
        result = result.filter((b) => !b.lengthM || b.lengthM <= currentFilters.maxLength!)
      }
      if (currentFilters.minYear) {
        result = result.filter((b) => !b.year || b.year >= currentFilters.minYear!)
      }
      if (currentFilters.maxYear) {
        result = result.filter((b) => !b.year || b.year <= currentFilters.maxYear!)
      }
      if (currentFilters.hullType) {
        result = result.filter((b) => b.hull === currentFilters.hullType)
      }

      // Sort
      if (currentFilters.sortBy === "price_asc") {
        result.sort((a, b) => (a.price || 0) - (b.price || 0))
      } else if (currentFilters.sortBy === "price_desc") {
        result.sort((a, b) => (b.price || 0) - (a.price || 0))
      } else if (currentFilters.sortBy === "year_desc") {
        result.sort((a, b) => (b.year || 0) - (a.year || 0))
      } else {
        result.sort((a, b) => (b.relevanceScore || 0) - (a.relevanceScore || 0))
      }

      return result
    },
    []
  )

  useEffect(() => {
    if (!rawQuery) return

    // Reset state
    setAllListings([])
    setFilteredListings([])
    setIsComplete(false)
    setTotalFound(0)
    setIsLoading(true)
    setPlatforms(
      PLATFORMS.map((p) => ({
        name: p.id,
        displayName: p.displayName,
        status: "pending" as const,
      }))
    )

    // Close existing connection
    if (eventSourceRef.current) {
      eventSourceRef.current.close()
    }

    const url = `/api/search/stream?q=${encodeURIComponent(rawQuery)}`
    const es = new EventSource(url)
    eventSourceRef.current = es

    es.onmessage = (event) => {
      const data: SearchProgress = JSON.parse(event.data)

      if (data.type === "analysis") {
        setProgressMessage(data.message || "Analyse...")
      } else if (data.type === "platform_start") {
        setPlatforms((prev) =>
          prev.map((p) =>
            p.name === data.platform ? { ...p, status: "loading" } : p
          )
        )
      } else if (data.type === "platform_done") {
        setPlatforms((prev) =>
          prev.map((p) =>
            p.name === data.platform
              ? { ...p, status: "done", count: data.count }
              : p
          )
        )
        if (data.listings) {
          setAllListings((prev) => {
            const updated = [...prev, ...data.listings!]
            setFilteredListings(applyFilters(updated, filters))
            return updated
          })
        }
        setTotalFound(data.total || 0)
      } else if (data.type === "platform_error") {
        setPlatforms((prev) =>
          prev.map((p) =>
            p.name === data.platform
              ? { ...p, status: "error", error: data.error }
              : p
          )
        )
      } else if (data.type === "complete") {
        setIsComplete(true)
        setIsLoading(false)
        if (data.listings) {
          setAllListings(data.listings)
          setFilteredListings(applyFilters(data.listings, filters))
        }
        setTotalFound(data.total || 0)
        es.close()
      }
    }

    es.onerror = () => {
      setIsComplete(true)
      setIsLoading(false)
      es.close()
    }

    return () => {
      es.close()
    }
  }, [rawQuery, applyFilters, filters])

  const handleFiltersChange = useCallback(
    (updates: Partial<SearchQuery>) => {
      const newFilters = { ...filters, ...updates }
      setFilters(newFilters)
      setFilteredListings(applyFilters(allListings, newFilters))
    },
    [filters, allListings, applyFilters]
  )

  // Count active scrapers
  const activePlatformsCount = platforms.filter((p) => p.status === "loading").length

  return (
    <main className="min-h-screen relative">
      {/* Background */}
      <div className="fixed inset-0 ocean-gradient" style={{ backgroundSize: "400% 400%" }} />

      <div className="relative z-10">
        {/* Header */}
        <header className="sticky top-0 z-40 border-b border-white/5 bg-navy-900/80 backdrop-blur-xl">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <div className="flex items-center gap-4">
              <button
                onClick={() => router.push("/")}
                className="flex items-center gap-2 flex-shrink-0"
              >
                <div className="w-8 h-8 rounded-lg bg-teal-500 flex items-center justify-center">
                  <Anchor className="w-4 h-4 text-navy-900" />
                </div>
                <span className="font-bold text-white hidden sm:block">VoilierScope</span>
              </button>

              <div className="flex-1 max-w-2xl">
                <SearchBar defaultValue={rawQuery} compact />
              </div>

              <div className="hidden md:flex items-center gap-2">
                {/* View toggles */}
                {(["grid", "list", "map"] as const).map((mode) => (
                  <button
                    key={mode}
                    onClick={() => setViewMode(mode)}
                    className={`p-2 rounded-lg transition-colors ${
                      viewMode === mode
                        ? "bg-teal-500/20 text-teal-400"
                        : "text-white/40 hover:text-white/70 hover:bg-white/5"
                    }`}
                  >
                    {mode === "grid" && <LayoutGrid className="w-4 h-4" />}
                    {mode === "list" && <List className="w-4 h-4" />}
                    {mode === "map" && <MapIcon className="w-4 h-4" />}
                  </button>
                ))}
              </div>

              <button
                onClick={() => setShowFilters(!showFilters)}
                className={`flex items-center gap-2 text-sm px-3 py-2 rounded-lg border transition-colors md:hidden ${
                  showFilters
                    ? "bg-teal-500/20 border-teal-500/30 text-teal-400"
                    : "border-white/10 text-white/60 hover:bg-white/5"
                }`}
              >
                <SlidersHorizontal className="w-4 h-4" />
                Filtres
              </button>
            </div>
          </div>
        </header>

        <div className="max-w-7xl mx-auto px-4 py-6">
          {/* Search progress */}
          <SearchProgressComponent
            platforms={platforms}
            totalFound={totalFound}
            isComplete={isComplete}
            message={progressMessage}
          />

          {/* Mobile filters overlay */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 md:hidden"
              >
                <div
                  className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                  onClick={() => setShowFilters(false)}
                />
                <motion.div
                  initial={{ x: "-100%" }}
                  animate={{ x: 0 }}
                  exit={{ x: "-100%" }}
                  transition={{ type: "spring", stiffness: 300, damping: 30 }}
                  className="absolute left-0 top-0 bottom-0 w-80 bg-navy-900 overflow-y-auto p-4"
                >
                  <div className="flex items-center justify-between mb-4">
                    <span className="text-white font-semibold">Filtres</span>
                    <button onClick={() => setShowFilters(false)}>
                      <X className="w-5 h-5 text-white/60" />
                    </button>
                  </div>
                  <SearchFilters
                    query={{ raw: rawQuery, ...filters }}
                    onFiltersChange={handleFiltersChange}
                  />
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Results count */}
          {(filteredListings.length > 0 || isComplete) && (
            <div className="flex items-center justify-between mb-4">
              <p className="text-white/50 text-sm">
                {filteredListings.length} annonce{filteredListings.length > 1 ? "s" : ""}
                {!isComplete && activePlatformsCount > 0 && (
                  <span className="text-teal-400 ml-2">• {activePlatformsCount} plateformes en cours...</span>
                )}
              </p>
            </div>
          )}

          {/* Main content */}
          <div className="flex gap-6">
            {/* Filters sidebar */}
            <aside className="hidden md:block w-64 flex-shrink-0">
              <SearchFilters
                query={{ raw: rawQuery, ...filters }}
                onFiltersChange={handleFiltersChange}
              />
            </aside>

            {/* Results */}
            <div className="flex-1 min-w-0">
              {viewMode === "map" && (
                <div className="mb-6">
                  <MapView boats={filteredListings} />
                </div>
              )}

              {viewMode === "map" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {filteredListings.slice(0, 6).map((boat, i) => (
                    <BoatCard key={boat.id} boat={boat} index={i} />
                  ))}
                </div>
              )}

              {viewMode === "grid" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                  {/* Skeleton cards while loading */}
                  {isLoading && filteredListings.length === 0 && (
                    <>
                      {Array.from({ length: 6 }).map((_, i) => (
                        <BoatCardSkeleton key={i} />
                      ))}
                    </>
                  )}
                  {filteredListings.map((boat, i) => (
                    <BoatCard key={boat.id} boat={boat} index={i} />
                  ))}
                </div>
              )}

              {viewMode === "list" && (
                <div className="space-y-3">
                  {isLoading && filteredListings.length === 0 && (
                    <>
                      {Array.from({ length: 4 }).map((_, i) => (
                        <BoatCardSkeleton key={i} />
                      ))}
                    </>
                  )}
                  {filteredListings.map((boat, i) => (
                    <BoatCard key={boat.id} boat={boat} index={i} />
                  ))}
                </div>
              )}

              {/* Empty state */}
              {isComplete && filteredListings.length === 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-center py-20"
                >
                  <Anchor className="w-12 h-12 text-white/20 mx-auto mb-4" />
                  <h3 className="text-white/60 font-semibold text-lg mb-2">
                    Aucun résultat trouvé
                  </h3>
                  <p className="text-white/30 text-sm max-w-sm mx-auto">
                    Essayez de modifier vos critères de recherche ou de réinitialiser les filtres.
                  </p>
                </motion.div>
              )}
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}

export default function SearchPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen ocean-gradient flex items-center justify-center">
        <div className="text-white/50">Chargement...</div>
      </div>
    }>
      <SearchPageContent />
    </Suspense>
  )
}
