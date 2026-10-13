/**
 * Shared floating-panel chrome (the review panel, the print-files panel).
 * @param {{ title?: string, className?: string, children?: import('react').ReactNode }} props
 */
export function Panel({ title, className = '', children, ...props }) {
  return (
    <div className={['cadbea-panel', className].filter(Boolean).join(' ')} {...props}>
      {title ? <h2 className="cadbea-panel__title">{title}</h2> : null}
      {children}
    </div>
  )
}
