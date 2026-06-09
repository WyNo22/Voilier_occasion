"use client"

import { motion, AnimatePresence } from "framer-motion"
import { CheckCircle2, XCircle, Loader2, Anchor } from "lucide-react"
import type { PlatformStatus } from "@voilierscope/types"

interface SearchProgressProps {
  platforms: PlatformStatus[]
  totalFound: number
  isComplete: boolean
  message?: string
}

export function SearchProgress({
  platforms,
  totalFound,
  isComplete,
  message,
}: SearchProgressProps) {
  const loadingCount = platforms.filter((p) => p.status === "loading").length
  const doneCount = platforms.filter((p) => p.status === "done" || p.status === "error").length

  return (
    <motion.div
      initial={{ opacity: 0, y: -20 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card rounded-2xl p-6 mb-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          {isComplete ? (
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 300 }}
            >
              <CheckCircle2 className="w-5 h-5 text-teal-400" />
            </motion.div>
          ) : (
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
            >
              <Anchor className="w-5 h-5 text-teal-400" />
            </motion.div>
          )}
          <div>
            <p className="text-white font-semibold text-sm">
              {isComplete
                ? `Recherche terminée — ${totalFound} annonce${totalFound > 1 ? "s" : ""} trouvée${totalFound > 1 ? "s" : ""}`
                : message || "Analyse de votre demande en cours..."}
            </p>
            {!isComplete && (
              <p className="text-white/40 text-xs mt-0.5">
                {doneCount}/{platforms.length} plateformes analysées
                {totalFound > 0 && ` • ${totalFound} annonces trouvées`}
              </p>
            )}
          </div>
        </div>

        {/* Progress bar */}
        <div className="hidden sm:block w-24">
          <div className="h-1 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              className="h-full bg-teal-500 rounded-full"
              initial={{ width: 0 }}
              animate={{
                width: `${(doneCount / Math.max(platforms.length, 1)) * 100}%`,
              }}
              transition={{ duration: 0.4 }}
            />
          </div>
        </div>
      </div>

      {/* Platform list */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
        <AnimatePresence>
          {platforms.map((platform, i) => (
            <motion.div
              key={platform.name}
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: i * 0.05 }}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl border text-xs transition-all duration-300 ${
                platform.status === "done"
                  ? "bg-teal-500/10 border-teal-500/30 text-teal-300"
                  : platform.status === "error"
                  ? "bg-red-500/10 border-red-500/20 text-red-400/70"
                  : platform.status === "loading"
                  ? "bg-white/5 border-white/10 text-white/70"
                  : "bg-white/3 border-white/5 text-white/30"
              }`}
            >
              {platform.status === "loading" && (
                <motion.div
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                >
                  <Loader2 className="w-3 h-3 flex-shrink-0" />
                </motion.div>
              )}
              {platform.status === "done" && (
                <CheckCircle2 className="w-3 h-3 flex-shrink-0 text-teal-400" />
              )}
              {platform.status === "error" && (
                <XCircle className="w-3 h-3 flex-shrink-0" />
              )}
              {platform.status === "pending" && (
                <div className="w-3 h-3 flex-shrink-0 rounded-full border border-white/20" />
              )}

              <span className="truncate font-medium">{platform.displayName}</span>

              {platform.status === "done" && platform.count !== undefined && (
                <span className="ml-auto font-bold text-teal-400 flex-shrink-0">
                  {platform.count}
                </span>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Wave animation when loading */}
      {!isComplete && loadingCount > 0 && (
        <div className="flex items-center gap-1 mt-4 justify-center">
          {[0, 1, 2, 3, 4].map((i) => (
            <motion.div
              key={i}
              className="w-1 h-4 rounded-full bg-teal-500/50"
              animate={{ scaleY: [1, 2, 1] }}
              transition={{
                duration: 0.8,
                repeat: Infinity,
                delay: i * 0.1,
                ease: "easeInOut",
              }}
            />
          ))}
        </div>
      )}
    </motion.div>
  )
}
