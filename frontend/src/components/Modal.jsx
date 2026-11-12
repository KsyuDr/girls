import { useEffect, useRef, useState } from 'react';
import './Modal.css';

const FOCUSABLE =
  'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])';

/**
 * Окно поверх страницы: плавно появляется и так же плавно исчезает.
 * Фокус переходит внутрь (на элемент с data-autofocus или первую кнопку), Tab не выходит
 * за пределы окна, Escape и клик по фону закрывают. После закрытия фокус возвращается туда,
 * где был до открытия.
 */
export default function Modal({
  open,
  onClose,
  role = 'dialog',
  labelledBy,
  describedBy,
  className = '',
  children,
}) {
  const [rendered, setRendered] = useState(open);
  const [closing, setClosing] = useState(false);
  const [prevOpen, setPrevOpen] = useState(open);
  const cardRef = useRef(null);
  const returnFocusRef = useRef(null);
  const onCloseRef = useRef(onClose);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  // Открытие и закрытие — во время рендера, без лишнего кадра с устаревшим состоянием
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setRendered(true);
      setClosing(false);
    } else if (rendered) {
      setClosing(true);
    }
  }

  useEffect(() => {
    if (!rendered || closing) return undefined;
    returnFocusRef.current = document.activeElement;
    const card = cardRef.current;
    const target = card?.querySelector('[data-autofocus]') || card?.querySelector(FOCUSABLE);
    target?.focus({ preventScroll: true });

    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onCloseRef.current?.();
        return;
      }
      if (e.key !== 'Tab' || !card) return;
      const items = [...card.querySelectorAll(FOCUSABLE)];
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [rendered, closing]);

  // Страница под окном не прокручивается
  useEffect(() => {
    if (!rendered) return undefined;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [rendered]);

  if (!rendered) return null;

  const finishClosing = (e) => {
    if (!closing || e.target !== e.currentTarget) return;
    setRendered(false);
    setClosing(false);
    const back = returnFocusRef.current;
    if (back && document.contains(back)) back.focus({ preventScroll: true });
  };

  return (
    <div
      className={`ui-modal ${closing ? 'ui-modal--closing' : ''}`}
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCloseRef.current?.();
      }}
      onAnimationEnd={finishClosing}
    >
      <div
        ref={cardRef}
        className={`ui-modal__card ${className}`}
        role={role}
        aria-modal="true"
        aria-labelledby={labelledBy}
        aria-describedby={describedBy}
      >
        {children}
      </div>
    </div>
  );
}
