import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import './LocationPicker.css';

const MARKER_STYLE = {
  radius: 10,
  color: '#FFFFFF',
  weight: 3,
  fillColor: '#ED0536',
  fillOpacity: 1,
};

/**
 * Выбор точки метки на карте OpenStreetMap: касание карты ставит точку.
 * value — {lat, lng} или null; center — откуда начать, если точки ещё нет.
 */
export default function LocationPicker({ value, center, onChange }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const markerRef = useRef(null);
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Карта создаётся один раз; центр и точка дальше меняются через Leaflet
  useEffect(() => {
    const start = value || center;
    const map = L.map(containerRef.current, {
      center: [start.lat, start.lng],
      zoom: value ? 16 : 12,
    });
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; участники OpenStreetMap',
    }).addTo(map);
    map.on('click', (e) => {
      onChangeRef.current?.({
        lat: Number(e.latlng.lat.toFixed(6)),
        lng: Number(e.latlng.lng.toFixed(6)),
      });
    });
    mapRef.current = map;
    return () => {
      map.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- создаём карту только при монтировании
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (!value) {
      markerRef.current?.remove();
      markerRef.current = null;
      return;
    }
    if (markerRef.current) {
      markerRef.current.setLatLng([value.lat, value.lng]);
    } else {
      markerRef.current = L.circleMarker([value.lat, value.lng], MARKER_STYLE).addTo(map);
    }
    if (!map.getBounds().contains([value.lat, value.lng])) {
      map.setView([value.lat, value.lng], Math.max(map.getZoom(), 15));
    }
  }, [value]);

  return (
    <div
      ref={containerRef}
      className="location-picker"
      role="application"
      aria-label="Карта: коснитесь места происшествия"
    />
  );
}
