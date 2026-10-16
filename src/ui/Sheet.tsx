import type { ReactNode } from 'react';
import { createPortal } from 'react-dom';

/**
 * Bottom sheet for menus and quick forms. Tapping the backdrop closes it. Rendered at the end of <body>: inside
 * the animated screen wrapper it would sit under the floating tab bar.
 */
export function Sheet({ title, onClose, children }: { title?: string; onClose: () => void; children: ReactNode }) {
  return createPortal(
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
        {title && <h2>{title}</h2>}
        {children}
      </div>
    </div>,
    document.body,
  );
}
