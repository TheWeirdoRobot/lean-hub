import Avatar from './Avatar'

/**
 * Overlapping avatars for a task's assignees, with a +N chip once the list
 * runs past `max`. Renders a dashed placeholder when nobody is assigned.
 */
export default function AvatarStack({ people, max = 3, size = 'sm' }) {
  const dim = size === 'sm' ? 28 : 36

  if (!people || people.length === 0) {
    return (
      <div
        title="Unassigned"
        style={{
          width: dim, height: dim, borderRadius: '50%',
          border: '1px dashed var(--border-strong)', flexShrink: 0,
        }}
      />
    )
  }

  const shown = people.slice(0, max)
  const extra = people.length - shown.length

  return (
    <div
      style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}
      title={people.map(p => p.full_name).join(', ')}
    >
      {shown.map((p, i) => (
        <div key={p.id} style={{ marginLeft: i === 0 ? 0 : -8 }}>
          <Avatar name={p.full_name} size={size} style={{ border: '2px solid var(--bg-secondary)' }} />
        </div>
      ))}
      {extra > 0 && (
        <div
          style={{
            marginLeft: -8,
            width: dim, height: dim, borderRadius: '50%',
            background: 'var(--bg-hover)',
            border: '2px solid var(--bg-secondary)',
            color: 'var(--text-secondary)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 10, fontWeight: 600,
          }}
        >
          +{extra}
        </div>
      )}
    </div>
  )
}
