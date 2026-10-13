import { Pill } from './components/Pill.jsx'

const BRIDGE_LABELS = {
  disabled: 'Bridge not configured',
  checking: 'Checking bridge…',
  connected: 'Bridge connected',
  disconnected: 'Bridge disconnected',
}

/**
 * Status line + a `children` slot for toolbar controls (the selection-mode
 * toggle, a project's own explode/section buttons, the download button, the
 * theme toggle — see CadbeaApp for the exact composition). The
 * bridge-connection pill renders separately, fixed to the bottom-right
 * corner, out of the way of the toolbar's button row.
 * @param {{ status?: string, bridgeStatus?: { state: string, url: string | null, error: string | null } | null, children?: import('react').ReactNode }} props
 */
export function Topbar({ status, bridgeStatus, children }) {
  return (
    <>
      <div className="cadbea-topbar">
        <div className="cadbea-status">{status}</div>
        <div className="cadbea-controls">{children}</div>
      </div>
      {bridgeStatus ? (
        <div className="cadbea-bridge-status">
          <Pill
            state={bridgeStatus.state}
            title={
              bridgeStatus.error
                ? `${bridgeStatus.error}${bridgeStatus.url ? ` · ${bridgeStatus.url}` : ''}`
                : bridgeStatus.url ?? 'Configure reviewWebhook to connect a review bridge'
            }
          >
            {BRIDGE_LABELS[bridgeStatus.state] ?? 'Bridge status unknown'}
          </Pill>
        </div>
      ) : null}
    </>
  )
}
