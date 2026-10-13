import { Button } from './components/Button.jsx'
import { DownloadIcon } from './icons.jsx'

/**
 * Compact icon-button version of the print-files download action, for the
 * toolbar — the full labeled card version is still available via
 * `viewer.renderPrintFiles(container)` for a hand-rolled chrome. Renders
 * nothing if the project configured neither a `printBundle` nor individual
 * `printFiles`.
 * @param {{ viewer: import('../viewer.js').createViewer extends (...args: any) => infer R ? R : never }} props
 */
export function DownloadPrintFilesButton({ viewer }) {
  const bundle = viewer.printBundle
  const files = viewer.printFiles ?? []
  if (!bundle && files.length === 0) return null

  if (bundle) {
    return (
      <Button
        as="a"
        href={bundle.url}
        download={bundle.fileName ?? ''}
        title={bundle.label ?? 'Download all print files'}
        aria-label="Download all print files"
        data-testid="download-print-files"
      >
        <DownloadIcon />
      </Button>
    )
  }

  return (
    <Button
      title="Download all print files"
      aria-label="Download all print files"
      data-testid="download-print-files"
      onClick={() => {
        for (const file of files) {
          const link = document.createElement('a')
          link.href = file.url
          link.download = file.fileName ?? ''
          link.click()
        }
      }}
    >
      <DownloadIcon />
    </Button>
  )
}
