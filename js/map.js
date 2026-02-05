import { getClickMarker, getHighlightLayer, setClickMarker, setHighlightLayer } from './state.js';

const RELATION_GEOM_AREA_THRESHOLD_DEG2 = 1.0;

export function initMap(onMapClick) {
  const map = L.map('map').setView([51.1657, 10.4515], 6);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
  }).addTo(map);

  map.on('click', function (e) {
    const { lat, lng } = e.latlng;
    setClickMarkerAt(map, lat, lng);
    clearHighlightLayer(map);
    onMapClick(lat, lng);
  });

  return map;
}

export function setClickMarkerAt(map, lat, lon) {
  const marker = getClickMarker();
  if (marker) map.removeLayer(marker);
  setClickMarker(L.circleMarker([lat, lon], { color: 'red', radius: 5, fillOpacity: 0.8 }).addTo(map));
}

export function clearHighlightLayer(map) {
  const layer = getHighlightLayer();
  if (layer) {
    map.removeLayer(layer);
    setHighlightLayer(null);
  }
}

export function drawRelationPreviewBounds(map, bounds) {
  clearHighlightLayer(map);
  const rectangle = L.rectangle(bounds, {
    color: '#ff7800',
    weight: 2,
    opacity: 0.8,
    fillColor: '#ff7800',
    fillOpacity: 0.1
  }).addTo(map);
  setHighlightLayer(rectangle);
  map.fitBounds(bounds, { padding: [40, 40] });
}

export function drawGeoJsonHighlight(map, geojson) {
  clearHighlightLayer(map);
  const layer = L.geoJSON(geojson, {
    style: { color: '#ff7800', weight: 4, opacity: 0.8, fillColor: '#ff7800', fillOpacity: 0.2 }
  }).addTo(map);
  setHighlightLayer(layer);

  const bounds = layer.getBounds();
  if (bounds.isValid()) map.fitBounds(bounds, { padding: [40, 40] });
}

export function boundsFromElement(element) {
  if (!element || !element.bounds) return null;
  const { minlat, minlon, maxlat, maxlon } = element.bounds;
  return L.latLngBounds([minlat, minlon], [maxlat, maxlon]);
}

export function relationPreviewShouldShowGeomHint(bounds) {
  const latSpan = Math.abs(bounds.getNorth() - bounds.getSouth());
  const lonSpan = Math.abs(bounds.getEast() - bounds.getWest());
  const areaDeg2 = latSpan * lonSpan;
  return areaDeg2 >= RELATION_GEOM_AREA_THRESHOLD_DEG2;
}

export function resolveAreaGeometryTarget(type, id) {
  if (type !== 'area') {
    return { type, id, sourceType: type, sourceId: id };
  }
  const areaId = Number(id);
  if (!Number.isFinite(areaId)) return null;

  if (areaId >= 3600000000) {
    return { type: 'relation', id: areaId - 3600000000, sourceType: 'area', sourceId: id };
  }
  if (areaId >= 2400000000) {
    return { type: 'way', id: areaId - 2400000000, sourceType: 'area', sourceId: id };
  }
  return null;
}
