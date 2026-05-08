import { useMemo } from 'react'
import Portal from '../Portal'

const COLORS = ['#f43f5e', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#06b6d4', '#fbbf24', '#84cc16']

function rand(min, max) { return min + Math.random() * (max - min) }

export default function Confetti({ active }) {
  const particles = useMemo(() => {
    if (!active) return []
    return Array.from({ length: 70 }, (_, i) => ({
      id: i,
      left: rand(1, 99),
      delay: rand(0, 1.4),
      duration: rand(2.2, 3.8),
      size: rand(7, 14),
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      isRect: Math.random() > 0.45,
    }))
  }, [active])

  if (!active) return null

  return (
    <Portal>
      <div className="confetti-wrap">
        {particles.map(p => (
          <div
            key={p.id}
            className="confetti-piece"
            style={{
              left: `${p.left}%`,
              width: p.isRect ? p.size * 0.5 : p.size,
              height: p.isRect ? p.size * 1.7 : p.size,
              borderRadius: p.isRect ? 2 : p.size / 2,
              background: p.color,
              animationDelay: `${p.delay}s`,
              animationDuration: `${p.duration}s`,
            }}
          />
        ))}
      </div>
    </Portal>
  )
}
