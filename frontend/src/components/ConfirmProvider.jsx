import { useCallback, useRef, useState } from 'react';
import { TriangleAlert, CircleCheck, Info } from 'lucide-react';
import Modal from './Modal';
import { ConfirmContext } from './confirmContext';

const TONE_ICONS = {
  danger: TriangleAlert,
  success: CircleCheck,
  primary: Info,
};

/** Даёт всем страницам confirm() — окно подтверждения вместо системного window.confirm. */
export default function ConfirmProvider({ children }) {
  const [open, setOpen] = useState(false);
  // Содержимое остаётся после ответа, чтобы окно исчезло плавно, а не пустым
  const [options, setOptions] = useState(null);
  const resolveRef = useRef(null);

  const confirm = useCallback((next) => {
    resolveRef.current?.(false); // предыдущий вопрос без ответа считаем отменой
    setOptions(next);
    setOpen(true);
    return new Promise((resolve) => {
      resolveRef.current = resolve;
    });
  }, []);

  const answer = (value) => {
    resolveRef.current?.(value);
    resolveRef.current = null;
    setOpen(false);
  };

  const tone = options?.tone || 'primary';
  const Icon = TONE_ICONS[tone] || Info;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={open}
        onClose={() => answer(false)}
        role="alertdialog"
        labelledBy="ui-confirm-title"
        describedBy={options?.message ? 'ui-confirm-message' : undefined}
      >
        {options && (
          <div className={`ui-confirm ui-confirm--${tone}`}>
            <div className="ui-confirm__icon" aria-hidden="true">
              <Icon size={26} strokeWidth={2.2} />
            </div>
            <div className="ui-confirm__text">
              <h2 id="ui-confirm-title" className="ui-confirm__title">
                {options.title}
              </h2>
              {options.message && (
                <p id="ui-confirm-message" className="ui-confirm__message">
                  {options.message}
                </p>
              )}
            </div>
            {options.content}
            <div className="ui-confirm__actions">
              <button
                type="button"
                className="ui-confirm__btn ui-confirm__btn--confirm"
                onClick={() => answer(true)}
                data-autofocus={tone === 'danger' ? undefined : true}
              >
                {options.confirmLabel || 'Подтвердить'}
              </button>
              {/* Для необратимых действий фокус на «Отмене»: Enter по привычке ничего не сломает */}
              <button
                type="button"
                className="ui-confirm__btn"
                onClick={() => answer(false)}
                data-autofocus={tone === 'danger' ? true : undefined}
              >
                {options.cancelLabel || 'Отмена'}
              </button>
            </div>
          </div>
        )}
      </Modal>
    </ConfirmContext.Provider>
  );
}
