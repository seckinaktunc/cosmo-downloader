import Button from './Button';

type ConfirmDialogProps = {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  title,
  message,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel
}: ConfirmDialogProps): React.JSX.Element {
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4 backdrop-blur-xs"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-dialog-title"
        className="w-full max-w-sm rounded-lg border border-white/25 bg-black text-white shadow-2xl shadow-black overflow-hidden"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-white/10">
            <h2 id="confirm-dialog-title" className="font-bold">
              {title}
            </h2>
            <Button
              variant="ghost"
              icon="close"
              size="icon"
              className="size-4"
              onClick={onCancel}
            />
          </div>
          <p className="text-sm text-white/60 p-4">{message}</p>
        </div>
        <div className="flex justify-end gap-2 p-4 pt-0">
          <Button variant="secondary" label={cancelLabel} onClick={onCancel} size="sm" />
          <Button variant="primary" label={confirmLabel} onClick={onConfirm} size="sm" ripple />
        </div>
      </div>
    </div>
  );
}
