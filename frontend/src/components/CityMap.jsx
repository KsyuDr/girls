import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './CityMap.css';

// Иконки lucide в виде SVG-строк: маркеры Leaflet — это HTML, не React
const ICON_PATHS = {
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  shield:
    '<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  'triangle-alert':
    '<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  home: '<path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8"/><path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  flame:
    '<path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/>',
  siren:
    '<path d="M7 18v-6a5 5 0 1 1 10 0v6"/><path d="M5 21a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-1a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2z"/><path d="M21 12h1"/><path d="M18.5 4.5 18 5"/><path d="M2 12h1"/><path d="M12 2v1"/><path d="m4.929 4.929.707.707"/><path d="M12 12v6"/>',
};

function iconSvg(name) {
  const paths = ICON_PATHS[name] || ICON_PATHS['triangle-alert'];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths}</svg>`;
}

function escapeHtml(text) {
  return String(text ?? '').replace(
    /[&<>"']/g,
    (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[ch]
  );
}

function markerIcon(marker, selected) {
  const classes = [
    'city-pin',
    marker.kind === 'sos' ? 'city-pin--sos' : '',
    selected ? 'city-pin--selected' : '',
  ].join(' ');
  return L.divIcon({
    className: 'city-pin-wrap',
    html: `<div class="${classes}" style="--pin:${escapeHtml(marker.color)}">${iconSvg(marker.icon)}</div>`,
    iconSize: [40, 40],
    iconAnchor: [20, 20],
  });
}

const USER_ICON = L.divIcon({
  className: 'city-pin-wrap',
  html: '<div class="city-user"><span class="city-user__pulse"></span><span class="city-user__dot"></span></div>',
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

function isPoint(p) {
  return p && typeof p.lat === 'number' && typeof p.lng === 'number';
}

// Отступ при подгонке больше половины маркера (40 px): точки у края не обрезаются
const FIT_PADDING = [48, 48];

/** Подогнать масштаб под точки; одна точка — просто в центр. */
function fitToPoints(map, points, maxZoom) {
  if (points.length === 0) return;
  if (points.length === 1) {
    map.setView([points[0].lat, points[0].lng], Math.min(15, maxZoom));
    return;
  }
  map.fitBounds(L.latLngBounds(points.map((p) => [p.lat, p.lng])), {
    padding: FIT_PADDING,
    maxZoom,
  });
}

/**
 * Настоящая карта города (Leaflet + OpenStreetMap).
 * markers — [{id, lat, lng, color, icon, label, kind: 'place' | 'sos'}];
 * flyTo — {lat, lng, zoom?, key} — перелететь при смене key;
 * fitKey — при смене подогнать масштаб под все маркеры;
 * interactive={false} — превью без перетаскивания и масштаба (не мешает прокрутке страницы);
 * autoFit — держать в кадре все маркеры: после изменения размера контейнера и при появлении
 *   новых точек (мини-карта модератора, где данные приходят позже, чем создаётся карта).
 */
export default function CityMap({
  center,
  userPoint = null,
  markers = [],
  selectedId = null,
  onSelect,
  flyTo = null,
  fitKey = null,
  zoomRequest = null,
  interactive = true,
  autoFit = false,
  zoom = 12,
  ariaLabel = 'Карта города',
  className = '',
}) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const layerRef = useRef(null);
  const userMarkerRef = useRef(null);
  const onSelectRef = useRef(onSelect);
  const markersRef = useRef(markers);
  const autoFitRef = useRef(autoFit);

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  useEffect(() => {
    markersRef.current = markers;
  }, [markers]);

  // Карта создаётся один раз (center и zoom — только начальные)
  useEffect(() => {
    const start = isPoint(center) ? center : { lat: 55.7539, lng: 37.6208 };
    const map = L.map(containerRef.current, {
      center: [start.lat, start.lng],
      zoom,
      zoomControl: false,
      attributionControl: true,
      dragging: interactive,
      scrollWheelZoom: interactive,
      doubleClickZoom: interactive,
      touchZoom: interactive,
      keyboard: interactive,
      boxZoom: interactive,
    });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; участники OpenStreetMap',
    }).addTo(map);
    map.attributionControl.setPrefix(false);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    // Карта в гибкой вёрстке: пересчитываем размер при изменении контейнера. При первом
    // показе размер ещё может быть нулевым — с autoFit подгоняем точки под настоящий размер.
    const observer = new ResizeObserver(() => {
      map.invalidateSize();
      if (autoFitRef.current) fitToPoints(map, markersRef.current.filter(isPoint), 14);
    });
    observer.observe(containerRef.current);

    // Подгоняем масштаб под точки при первом показе
    const points = markersRef.current.filter(isPoint);
    if (points.length > 1) fitToPoints(map, points, 14);

    return () => {
      observer.disconnect();
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
      userMarkerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- карту создаём только при монтировании
  }, []);

  // Маркеры: перерисовываем слой целиком (их немного — десятки)
  useEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    layer.clearLayers();
    markers.filter(isPoint).forEach((m) => {
      const selected = m.id === selectedId;
      const marker = L.marker([m.lat, m.lng], {
        icon: markerIcon(m, selected),
        title: m.label,
        alt: m.label,
        keyboard: interactive,
        zIndexOffset: m.kind === 'sos' ? 2000 : selected ? 1000 : 0,
        riseOnHover: true,
      });
      if (interactive) {
        marker.on('click', () => onSelectRef.current?.(m.id));
      }
      marker.addTo(layer);
    });
  }, [markers, selectedId, interactive]);

  // Точка «Вы здесь»
  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!isPoint(userPoint)) {
      userMarkerRef.current?.remove();
      userMarkerRef.current = null;
      return;
    }
    if (userMarkerRef.current) {
      userMarkerRef.current.setLatLng([userPoint.lat, userPoint.lng]);
    } else {
      userMarkerRef.current = L.marker([userPoint.lat, userPoint.lng], {
        icon: USER_ICON,
        title: 'Вы здесь',
        alt: 'Вы здесь',
        keyboard: false,
        interactive: false,
        zIndexOffset: 500,
      }).addTo(map);
    }
  }, [userPoint]);

  // Перелёт к точке (выбор в списке, «Моё место», SOS)
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !isPoint(flyTo)) return;
    const zoom = flyTo.zoom ?? Math.max(map.getZoom(), 15);
    const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    if (reduceMotion) map.setView([flyTo.lat, flyTo.lng], zoom);
    else map.flyTo([flyTo.lat, flyTo.lng], zoom, { duration: 0.6 });
    // eslint-disable-next-line react-hooks/exhaustive-deps -- реагируем только на новый запрос
  }, [flyTo?.key]);

  // Кнопки масштаба — свои, в стиле интерфейса: {delta, key}
  useEffect(() => {
    const map = mapRef.current;
    if (!map || !zoomRequest) return;
    map.setZoom(map.getZoom() + zoomRequest.delta);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- реагируем только на новый запрос
  }, [zoomRequest?.key]);

  // «Показать всё»
  useEffect(() => {
    const map = mapRef.current;
    if (!map || fitKey === null) return;
    const points = markersRef.current.filter(isPoint);
    if (isPoint(userPoint)) points.push(userPoint);
    fitToPoints(map, points, 15);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- реагируем только на новый запрос
  }, [fitKey]);

  // autoFit: набор точек изменился (а не просто пришло то же самое при обновлении раз в 20 с)
  const pointsKey = autoFit
    ? markers
        .filter(isPoint)
        .map((m) => `${m.id}@${m.lat},${m.lng}`)
        .join('|')
    : '';
  useEffect(() => {
    autoFitRef.current = autoFit;
    const map = mapRef.current;
    if (!map || !autoFit) return;
    fitToPoints(map, markersRef.current.filter(isPoint), 14);
  }, [autoFit, pointsKey]);

  return (
    <div
      ref={containerRef}
      className={`city-map ${className}`}
      role="region"
      aria-label={ariaLabel}
      data-map-ready="true"
    />
  );
}
