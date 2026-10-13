/**
 * Labeled input/textarea wrapper (the annotation note field today; any other
 * text input the UI kit needs later reuses this instead of a new element).
 * @param {{ label?: string, as?: import('react').ElementType, className?: string }} props
 */
export function Field({ label, as: As = 'textarea', className = '', ...props }) {
  return (
    <label className="cadbea-field">
      {label ? <span className="cadbea-field__label">{label}</span> : null}
      <As className={['cadbea-field__control', className].filter(Boolean).join(' ')} {...props} />
    </label>
  )
}
