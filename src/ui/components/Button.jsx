/**
 * The one button component the whole UI kit uses — variant covers every look
 * (toolbar buttons, primary actions, ghost icon buttons, destructive
 * actions) instead of a different bespoke button per place it's used.
 * @param {{ as?: import('react').ElementType, variant?: 'default'|'primary'|'ghost'|'danger', active?: boolean, className?: string }} props
 */
export function Button({ as: As = 'button', variant = 'default', active = false, className = '', ...props }) {
  const classes = ['cadbea-btn', `cadbea-btn--${variant}`, className].filter(Boolean).join(' ')
  return <As className={classes} data-active={active || undefined} aria-pressed={active || undefined} {...props} />
}
