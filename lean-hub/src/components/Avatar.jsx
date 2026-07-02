const COLORS = [
  ['#A79BE8', 'rgba(167,155,232,0.16)'],
  ['#8B7CD8', 'rgba(139,124,216,0.16)'],
  ['#6CA6E8', 'rgba(108,166,232,0.16)'],
  ['#6BC77A', 'rgba(107,199,122,0.16)'],
  ['#E28FB9', 'rgba(226,143,185,0.16)'],
  ['#D9A73F', 'rgba(217,167,63,0.16)'],
  ['#5FBFC9', 'rgba(95,191,201,0.16)'],
  ['#DE9260', 'rgba(222,146,96,0.16)'],
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
