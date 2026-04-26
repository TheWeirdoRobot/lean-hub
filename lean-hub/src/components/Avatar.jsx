const COLORS = [
  ['#A855F7', 'rgba(168,85,247,0.2)'],
  ['#7C3AED', 'rgba(124,58,237,0.2)'],
  ['#3B82F6', 'rgba(59,130,246,0.2)'],
  ['#22C55E', 'rgba(34,197,94,0.2)'],
  ['#EC4899', 'rgba(236,72,153,0.2)'],
  ['#EAB308', 'rgba(234,179,8,0.2)'],
  ['#06B6D4', 'rgba(6,182,212,0.2)'],
  ['#EF4444', 'rgba(239,68,68,0.2)'],
]

export function getAvatarColors(name) {
  const idx = (name?.charCodeAt(0) || 65) % COLORS.length
  return COLORS[idx]
}

export function getInitials(name) {
  if (!name) return '?'
  return name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()
}

export default function Avatar({ name, size = 'md', style = {} }) {
  const [fg, bg] = getAvatarColors(name)
  const initials = getInitials(name)

  return (
    <div
      className={`avatar avatar-${size}`}
      style={{ background: bg, color: fg, border: `1.5px solid ${fg}33`, ...style }}
      title={name}
    >
      {initials}
    </div>
  )
}
