import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

const FOCUSABLE = [
  'a[href]', 'button:not([disabled])', 'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])', 'textarea:not([disabled])', '[tabindex]:not([tabindex="-1"])',
].join(',');

/**
 * A modal dialog that behaves like one for keyboard and screen-reader users.
 *
 * - Rendered outside #root, and #root is made inert while it is open, so
 *   neither focus nor assistive technology can reach the page behind it.
 * - Focus moves into the dialog on open, Tab and Shift+Tab cycle inside it,
 *   Escape closes it, and focus returns to whatever opened it.
 *
 * `className` styles the full-screen overlay; the child is the visible panel.
 */
const Dialog = ({ label, labelledBy, onClose, className, children }) => {
  const ref = useRef(null);
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const node = ref.current;
    const opener = document.activeElement;
    const root = document.getElementById('root');
    if (root) root.setAttribute('inert', '');
    node.focus();

    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        event.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const items = Array.from(node.querySelectorAll(FOCUSABLE))
        .filter((el) => el.getClientRects().length > 0);
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (event.shiftKey && (active === first || active === node)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && (active === last || !node.contains(active))) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKeyDown);

    return () => {
      document.removeEventListener('keydown', onKeyDown);
      if (root) root.removeAttribute('inert');
      if (opener && typeof opener.focus === 'function' && document.contains(opener)) opener.focus();
    };
  }, []);

  return createPortal(
    <div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-label={label}
      aria-labelledby={labelledBy}
      tabIndex={-1}
      className={`outline-none ${className || ''}`}
    >
      {children}
    </div>,
    document.body,
  );
};

export default Dialog;
