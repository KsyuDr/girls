import { useEffect, useRef, useState } from 'react';
import { Siren, Phone, MapPin, X, CircleCheck } from 'lucide-react';
import { elapsedLabel } from '../services/adapters';
import './IncomingSosBanner.css';

// Чем закончился сигнал: близкий должен узнать, что всё хорошо, а не гадать, куда пропал баннер
const FINISHED_TITLES = {
  cancelled: (name) => `${name}: сигнал SOS отменён`,
  resolved: (name) => `${name}: помощь пришла, сигнал SOS завершён`,
};

/**
 * SOS близкого человека: мой номер есть в его экстренных контактах.
 * Висит над любой страницей, пока сигнал активен. После завершения ещё час показывает
 * спокойный отбой («отменён» или «помощь пришла»). «Скрыть» убирает только этот сигнал
 * и только до перезагрузки: новый сигнал покажется снова.
 */
export default function IncomingSosBanner({ signals = [], onShowOnMap }) {
  const [dismissed, setDismissed] = useState(() => new Set());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  // Ключ скрытия с учётом статуса: скрытый активный сигнал покажется снова, когда завершится
  const keyOf = (sos) => `${sos.id}:${sos.status}`;
  const visible = signals.filter((s) => !dismissed.has(keyOf(s)));
  const anyActive = visible.some((s) => s.isActive);

  // Высота баннера — в CSS-переменную: боковое меню и карта на весь экран её вычитают
  const rootRef = useRef(null);
  const hasVisible = visible.length > 0;
  useEffect(() => {
    const root = document.documentElement;
    const node = rootRef.current;
    if (!hasVisible || !node) {
      root.style.removeProperty('--incoming-sos-h');
      return undefined;
    }
    const observer = new ResizeObserver(() =>
      root.style.setProperty('--incoming-sos-h', `${node.offsetHeight}px`)
    );
    observer.observe(node);
    return () => {
      observer.disconnect();
      root.style.removeProperty('--incoming-sos-h');
    };
  }, [hasVisible]);

  if (!hasVisible) return null;

  return (
    <div
      ref={rootRef}
      className={`incoming-sos${anyActive ? '' : ' incoming-sos--calm'}`}
      role={anyActive ? 'alert' : 'status'}
      aria-live={anyActive ? 'assertive' : 'polite'}
    >
      {visible.map((sos) => (
        <section
          key={keyOf(sos)}
          className={`incoming-sos__row${sos.isActive ? '' : ' incoming-sos__row--calm'}`}
          aria-label={`SOS от ${sos.senderName}`}
        >
          <div className="incoming-sos__icon" aria-hidden="true">
            {sos.isActive ? (
              <Siren size={22} strokeWidth={2.2} />
            ) : (
              <CircleCheck size={22} strokeWidth={2.2} />
            )}
          </div>

          <div className="incoming-sos__text">
            <span className="incoming-sos__title">
              {sos.isActive
                ? `${sos.senderName} просит помощи — сигнал SOS`
                : (FINISHED_TITLES[sos.status] || FINISHED_TITLES.cancelled)(sos.senderName)}
            </span>
            <span className="incoming-sos__meta">
              {sos.isActive
                ? `${sos.address} · ${elapsedLabel(now - sos.startedAt)} · вы записаны как «${sos.relation}»`
                : `Сигнал завершён ${elapsedLabel(now - (sos.endedAt || now))}`}
            </span>
          </div>

          <div className="incoming-sos__actions">
            <a href={`tel:${sos.phone}`} className="incoming-sos__btn incoming-sos__btn--primary">
              <Phone size={16} strokeWidth={2.2} aria-hidden="true" />
              <span>Позвонить</span>
            </a>
            {sos.isActive && sos.hasPoint && (
              <button
                type="button"
                className="incoming-sos__btn"
                onClick={() =>
                  onShowOnMap?.({
                    type: 'incoming-sos',
                    id: sos.id,
                    lat: sos.lat,
                    lng: sos.lng,
                    title: `SOS: ${sos.senderName}`,
                    subtitle: sos.address,
                    phone: sos.phone,
                  })
                }
              >
                <MapPin size={16} strokeWidth={2.2} aria-hidden="true" />
                <span>На карте</span>
              </button>
            )}
            <button
              type="button"
              className="incoming-sos__close"
              onClick={() => setDismissed((prev) => new Set(prev).add(keyOf(sos)))}
              aria-label="Скрыть уведомление"
              title="Скрыть уведомление"
            >
              <X size={18} strokeWidth={2.2} aria-hidden="true" />
            </button>
          </div>
        </section>
      ))}
    </div>
  );
}
