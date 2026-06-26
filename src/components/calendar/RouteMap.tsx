"use client";
import { useEffect, useRef } from "react";

// Google's encoded polyline format
function decodePolyline(str: string): [number, number][] {
  const coords: [number, number][] = [];
  let index = 0, lat = 0, lng = 0;
  while (index < str.length) {
    let b: number, shift = 0, result = 0;
    do { b = str.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lat += (result & 1) ? ~(result >> 1) : (result >> 1);
    shift = 0; result = 0;
    do { b = str.charCodeAt(index++) - 63; result |= (b & 0x1f) << shift; shift += 5; } while (b >= 0x20);
    lng += (result & 1) ? ~(result >> 1) : (result >> 1);
    coords.push([lat / 1e5, lng / 1e5]);
  }
  return coords;
}

interface Props {
  polyline?: string;
  center?: [number, number];
}

export default function RouteMap({ polyline, center }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const mapRef = useRef<any>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    // Leaflet CSS via link tag — avoids Next.js CSS-import quirks
    if (!document.querySelector("#leaflet-css")) {
      const link = document.createElement("link");
      link.id = "leaflet-css";
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    let cancelled = false;

    import("leaflet").then((L) => {
      if (cancelled || !containerRef.current) return;

      // Tear down previous instance (e.g. hot reload)
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }

      const coords: [number, number][] = polyline
        ? decodePolyline(polyline)
        : center
        ? [center]
        : [];

      if (coords.length === 0) return;

      const map = L.map(containerRef.current!, {
        zoomControl: false,
        attributionControl: false,
        dragging: false,
        scrollWheelZoom: false,
        doubleClickZoom: false,
        boxZoom: false,
        keyboard: false,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 18,
      }).addTo(map);

      if (coords.length > 1) {
        const track = L.polyline(coords, { color: "#818cf8", weight: 3, opacity: 0.9 });
        track.addTo(map);
        map.fitBounds(track.getBounds(), { padding: [16, 16] });

        // Start/end markers
        const dot = (color: string) =>
          L.divIcon({
            className: "",
            html: `<div style="width:10px;height:10px;border-radius:50%;background:${color};border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.5)"></div>`,
            iconSize: [10, 10],
            iconAnchor: [5, 5],
          });
        L.marker(coords[0], { icon: dot("#22c55e") }).addTo(map);
        L.marker(coords[coords.length - 1], { icon: dot("#ef4444") }).addTo(map);
      } else {
        map.setView(coords[0], 13);
        const dot = L.divIcon({
          className: "",
          html: `<div style="width:12px;height:12px;border-radius:50%;background:#818cf8;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.5)"></div>`,
          iconSize: [12, 12],
          iconAnchor: [6, 6],
        });
        L.marker(coords[0], { icon: dot }).addTo(map);
      }

      mapRef.current = map;
    });

    return () => {
      cancelled = true;
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, [polyline, center]);

  return (
    <div
      ref={containerRef}
      className="w-full rounded-xl overflow-hidden border border-dash-border"
      style={{ height: 200 }}
    />
  );
}
