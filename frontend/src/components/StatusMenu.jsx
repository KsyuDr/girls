import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown } from 'lucide-react';
import './StatusMenu.css';

/**
 * Выбор статуса: цветная «таблетка» и всплывающее меню вместо системного select.
 * Меню рисуется в body (position: fixed), поэтому его не обрезает карточка таблицы.
 * Клавиатура: стрелки, Home/End, Enter/пробел, Escape, Tab закрывает.
 *
 * options — [{value, label, bg, color}]
 */
export default function StatusMenu({ value, options, onChange, ariaLabel, disabled = false }) {
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [position, setPosition] = useState(null);
  const buttonRef = useRef(null);
  const listRef = useRef(null);

  const current = options.find((o) => o.value === value) || options[0];

  const place = () => {
    const rect = buttonRef.current?.getBoundingClientRect();
    if (!rect) return;
    const menuHeight = options.length * 40 + 12;
    const below = window.innerHeight - rect.bottom;
    const up = below < menuHeight + 12 && rect.top > menuHeight + 12;
    setPosition({
      left: Math.min(rect.left, window.innerWidth - 196),
      top: up ? rect.top - menuHeight - 6 : rect.bottom + 6,
      up,
    });
  };

  const openMenu = () => {
    if (disabled) return;
    place();
    setActiveIndex(
      Math.max(
        0,
        options.findIndex((o) => o.value === value)
      )
    );
    setOpen(true);
  };

  const close = (returnFocus = true) => {
    setOpen(false);
    if (returnFocus) buttonRef.current?.focus({ preventScroll: true });
  };

  const choose = (option) => {
    close();
    if (option.value !== value) onChange?.(option.value);
  };

  // Фокус на выбранный пункт после открытия
  useLayoutEffect(() => {
    if (!open) return;
    listRef.current?.querySelectorAll('[role="option"]')[activeIndex]?.focus();
  }, [open, activeIndex]);

  // Клик мимо, прокрутка или изменение окна закрывают меню
  useEffect(() => {
    if (!open) return undefined;
    const onPointer = (e) => {
      if (listRef.current?.contains(e.target) || buttonRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    const onScroll = (e) => {
      if (listRef.current?.contains(e.target)) return;
      setOpen(false);
    };
    document.addEventListener('pointerdown', onPointer);
    window.addEventListener('scroll', onScroll, true);
    window.addEventListener('resize', onScroll);
    return () => {
      document.removeEventListener('pointerdown', onPointer);
      window.removeEventListener('scroll', onScroll, true);
      window.removeEventListener('resize', onScroll);
    };
  }, [open]);

  const onListKeyDown = (e) => {
    const last = options.length - 1;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIndex((i) => (i >= last ? 0 : i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? last : i - 1));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActiveIndex(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActiveIndex(last);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      close();
    } else if (e.key === 'Tab') {
      close(false);
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      choose(options[activeIndex]);
    }
  };

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        className={`status-menu__trigger ${open ? 'status-menu__trigger--open' : ''}`}
        style={{ '--status-bg': current.bg, '--status-color': current.color }}
        onClick={() => (open ? close() : openMenu())}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
            e.preventDefault();
            openMenu();
          }
        }}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={`${ariaLabel}: ${current.label}`}
        disabled={disabled}
      >
        <span className="status-menu__dot" aria-hidden="true" />
        <span>{current.label}</span>
        <ChevronDown
          size={14}
          strokeWidth={2.6}
          aria-hidden="true"
          className="status-menu__chevron"
        />
      </button>

      {open &&
        position &&
        createPortal(
          <div
            ref={listRef}
            role="listbox"
            aria-label={ariaLabel}
            className={`status-menu__list ${position.up ? 'status-menu__list--up' : ''}`}
            style={{ left: position.left, top: position.top }}
            onKeyDown={onListKeyDown}
          >
            {options.map((option, index) => {
              const selected = option.value === value;
              return (
                <div
                  key={option.value}
                  role="option"
                  tabIndex={index === activeIndex ? 0 : -1}
                  aria-selected={selected}
                  className={`status-menu__option ${selected ? 'status-menu__option--selected' : ''}`}
                  style={{ '--status-bg': option.bg, '--status-color': option.color }}
                  onClick={() => choose(option)}
                  onMouseEnter={() => setActiveIndex(index)}
                >
                  <span className="status-menu__dot" aria-hidden="true" />
                  <span className="status-menu__option-label">{option.label}</span>
                  {selected && (
                    <Check
                      size={16}
                      strokeWidth={2.6}
                      aria-hidden="true"
                      className="status-menu__check"
                    />
                  )}
                </div>
              );
            })}
          </div>,
          document.body
        )}
    </>
  );
}
