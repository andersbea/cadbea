/**
 * Small status pill — used for bridge connection status, extendable to any
 * other `data-state`-driven indicator instead of one-off styling per use.
 * @param {{ state: string, className?: string, children?: import('react').ReactNode }} props
 */
export function Pill({ state, className = '', children, ...props }) {
  return (
    <span className={['cadbea-pill', className].filter(Boolean).join(' ')} data-state={state} {...props}>
      {children}
    </span>
  )
}
