import { useEffect, useRef, useState } from 'react';
import { Siren, Phone, MapPin, X } from 'lucide-react';
import { elapsedLabel } from '../services/adapters';
import './IncomingSosBanner.css';

/**
 * SOS близкого человека: мой номер есть в его экстренных контактах.
 * Висит над любой страницей, пока сигнал активен. «Скрыть» убирает только этот сигнал
 * и только до перезагрузки: новый сигнал покажется снова.
 */
export default function IncomingSosBanner({ signals = [], onShowOnMap }) {
  const [dismissed, setDismissed] = useState(() => new Set());
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  const visible = signals.filter((s) => !dismissed.has(s.id));

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
    <div ref={rootRef} className="incoming-sos" role="alert" aria-live="assertive">
      {visible.map((sos) => (
        <section key={sos.id} className="incoming-sos__row" aria-label={`SOS от ${sos.senderName}`}>
          <div className="incoming-sos__icon" aria-hidden="true">
            <Siren size={22} strokeWidth={2.2} />
          </div>

          <div className="incoming-sos__text">
            <span className="incoming-sos__title">{sos.senderName} просит помощи — сигнал SOS</span>
            <span className="incoming-sos__meta">
              {sos.address} · {elapsedLabel(now - sos.startedAt)} · вы записаны как «{sos.relation}»
            </span>
          </div>

          <div className="incoming-sos__actions">
            <a href={`tel:${sos.phone}`} className="incoming-sos__btn incoming-sos__btn--primary">
              <Phone size={16} strokeWidth={2.2} aria-hidden="true" />
              <span>Позвонить</span>
            </a>
            {sos.hasPoint && (
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
              onClick={() => setDismissed((prev) => new Set(prev).add(sos.id))}
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
