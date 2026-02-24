import React, { useEffect, useRef } from 'react';

/**
 * Reusable confirm dialog (replaces browser confirm()).
 * Supports keyboard navigation (Tab trap, Escape to cancel).
 */
export const ConfirmDialog = ({ isOpen, title, message, onConfirm, onCancel, confirmLabel = 'Bevestigen', cancelLabel = 'Annuleren', variant = 'danger' }) => {
  const modalRef = useRef(null);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onCancel();
      if (e.key === 'Tab') {
        const focusable = modalRef.current?.querySelectorAll('button');
        if (!focusable?.length) return;
        const first = focusable[0], last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    setTimeout(() => modalRef.current?.querySelector('[data-cancel]')?.focus(), 50);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-end sm:items-center justify-center z-[60] p-4"
      role="dialog" aria-modal="true" aria-label={title} ref={modalRef}>
      <div className="bg-white dark:bg-gray-800 rounded-t-2xl sm:rounded-2xl p-6 max-w-sm w-full shadow-xl">
        <h2 className="text-lg font-bold text-gray-800 mb-2">{title}</h2>
        <p className="text-gray-600 mb-6">{message}</p>
        <div className="flex gap-3">
          <button onClick={onCancel} data-cancel
            className="flex-1 py-3 rounded-lg border-2 border-gray-300 dark:border-gray-600 font-semibold text-gray-700 hover:bg-gray-50 active:scale-95 transition-all focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2">
            {cancelLabel}
          </button>
          <button onClick={onConfirm}
            className={`flex-1 py-3 rounded-lg font-semibold text-white active:scale-95 transition-all focus-visible:ring-2 focus-visible:ring-offset-2 ${
              variant === 'danger' ? 'bg-primary hover:bg-primary-dark focus-visible:ring-primary' : 'bg-green-600 hover:bg-green-700 focus-visible:ring-green-500'
            }`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};
