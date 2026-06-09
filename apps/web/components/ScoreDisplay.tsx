"use client"

import { motion } from "framer-motion"
import { getScoreColor, getScoreLabel } from "@/lib/ai/scoreBoat"

interface ScoreDisplayProps {
  score: number
  size?: "sm" | "md" | "lg"
  showLabel?: boolean
  animated?: boolean
}

export function ScoreDisplay({ score, size = "md", showLabel = true, animated = true }: ScoreDisplayProps) {
  const color = getScoreColor(score)
  const label = getScoreLabel(score)

  const sizes = {
    sm: { badge: "w-10 h-10 text-sm", ring: 34, strokeWidth: 3, label: "text-xs" },
    md: { badge: "w-14 h-14 text-base", ring: 46, strokeWidth: 3.5, label: "text-sm" },
    lg: { badge: "w-20 h-20 text-xl", ring: 66, strokeWidth: 4, label: "text-base" },
  }

  const { badge, ring, strokeWidth, label: labelSize } = sizes[size]
  const radius = (ring - strokeWidth * 2) / 2
  const circumference = radius * 2 * Math.PI
  const offset = circumference - (score / 100) * circumference

  return (
    <div className="flex flex-col items-center gap-1">
      <div className={`relative ${badge} flex items-center justify-center`}>
        <svg
          className="absolute inset-0 -rotate-90"
          width={ring}
          height={ring}
          viewBox={`0 0 ${ring} ${ring}`}
        >
          <circle
            cx={ring / 2}
            cy={ring / 2}
            r={radius}
            fill="none"
            stroke="rgba(255,255,255,0.08)"
            strokeWidth={strokeWidth}
          />
          {animated ? (
            <motion.circle
              cx={ring / 2}
              cy={ring / 2}
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset: offset }}
              transition={{ duration: 1, delay: 0.2, ease: "easeOut" }}
            />
          ) : (
            <circle
              cx={ring / 2}
              cy={ring / 2}
              r={radius}
              fill="none"
              stroke={color}
              strokeWidth={strokeWidth}
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
            />
          )}
        </svg>
        <span className="font-bold text-white z-10">{score}</span>
      </div>
      {showLabel && (
        <span className={`font-medium ${labelSize}`} style={{ color }}>
          {label}
        </span>
      )}
    </div>
  )
}

interface ScoreBarProps {
  label: string
  score: number
  animated?: boolean
}

export function ScoreBar({ label, score, animated = true }: ScoreBarProps) {
  const color = getScoreColor(score)

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs">
        <span className="text-white/60">{label}</span>
        <span className="font-semibold" style={{ color }}>{score}/100</span>
      </div>
      <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
        {animated ? (
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: color }}
            initial={{ width: 0 }}
            animate={{ width: `${score}%` }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          />
        ) : (
          <div
            className="h-full rounded-full"
            style={{ backgroundColor: color, width: `${score}%` }}
          />
        )}
      </div>
    </div>
  )
}
