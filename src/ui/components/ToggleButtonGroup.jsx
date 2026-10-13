/**
 * An exclusive, segmented set of options rendered as one connected strip —
 * the MUI `ToggleButtonGroup` pattern — for a project's own view-mode
 * controls (e.g. assembled/exploded). Icon-only by convention: pass a
 * `title` per option for the hover tooltip (and any keyboard shortcut hint)
 * instead of a visible label, so the strip stays compact.
 * @param {{
 *   value: string,
 *   onChange: (value: string) => void,
 *   options: { value: string, label: string, icon: import('react').ReactNode, title?: string, testId?: string }[],
 *   className?: string,
 * }} props
 */
export function ToggleButtonGroup({ value, onChange, options, className = '' }) {
  return (
    <div className={['cadbea-toggle-group', className].filter(Boolean).join(' ')} role="group">
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className="cadbea-toggle-group__btn"
          data-active={option.value === value || undefined}
          aria-pressed={option.value === value}
          aria-label={option.label}
          title={option.title ?? option.label}
          data-testid={option.testId}
          onClick={() => onChange(option.value)}
        >
          {option.icon}
        </button>
      ))}
    </div>
  )
}
