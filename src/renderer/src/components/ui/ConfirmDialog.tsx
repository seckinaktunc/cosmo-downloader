type ConfirmDialogProps = {
  title: string
  message: string
  confirmLabel: string
  cancelLabel: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel
}: ConfirmDialogProps): React.JSX.Element {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="w-full max-w-sm rounded-lg border border-white/10 bg-black p-4 text-white shadow-2xl"
      >
        <h2 id="confirm-dialog-title" className="text-lg font-bold">
          {title}
        </h2>
        <p className="mt-2 text-sm text-white/60">{message}</p>
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            className="no-drag rounded-lg bg-white/5 px-4 py-2 text-sm font-bold text-white outline-none transition hover:bg-white/10 focus-visible:ring-2 focus-visible:ring-white/70"
            onClick={onCancel}
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            className="no-drag rounded-lg bg-white px-4 py-2 text-sm font-bold text-black outline-none transition hover:bg-white/80 focus-visible:ring-2 focus-visible:ring-white/70"
            onClick={onConfirm}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
