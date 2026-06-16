import { CONFIG, fetchOverpassJson, searchNominatim } from './api.js';
import {
  boundsFromElement,
  clearHighlightLayer,
  drawGeoJsonHighlight,
  drawRelationPreviewBounds,
  relationPreviewShouldShowGeomHint,
  resolveAreaGeometryTarget,
  setClickMarkerAt
} from './map.js';
import {
  getDomRefs,
  hideError,
  populateSearchResultsSelect,
  promptLargeGeometryLoad,
  renderList,
  resetSearchResultsSelect,
  selectItem,
  setAddToCollectionButtonActive,
  setExportButtonsActive,
  setExportButtonTemporaryText,
  setLoading,
  showError,
  showResultMessage,
  clearItemSelection
} from './ui.js';
import {
  getCollectionItems,
  getSelectedObjectData,
  setSelectedObjectData
} from './state.js';
import { addSelectedObjectToCollection } from './features.js';

let activeListController = null;
let activeGeometryController = null;
let listRequestId = 0;
let geometryRequestId = 0;

export { addSelectedObjectToCollection };

function abortController(controller) {
  if (controller && !controller.signal.aborted) {
    controller.abort();
  }
}

function abortListRequest() {
  abortController(activeListController);
  activeListController = null;
}

function abortGeometryRequest() {
  abortController(activeGeometryController);
  activeGeometryController = null;
}

function startListRequest() {
  abortListRequest();
  abortGeometryRequest();
  activeListController = new AbortController();
  listRequestId += 1;
  const requestId = listRequestId;
  const controller = activeListController;

  return {
    signal: controller.signal,
    isCurrent: () => activeListController === controller && listRequestId === requestId && !controller.signal.aborted,
    clear: () => {
      if (activeListController === controller) {
        activeListController = null;
      }
    }
  };
}

function startGeometryRequest() {
  abortGeometryRequest();
  activeGeometryController = new AbortController();
  geometryRequestId += 1;
  const requestId = geometryRequestId;
  const controller = activeGeometryController;

  return {
    signal: controller.signal,
    isCurrent: () => activeGeometryController === controller && geometryRequestId === requestId && !controller.signal.aborted,
    clear: () => {
      if (activeGeometryController === controller) {
        activeGeometryController = null;
      }
    }
  };
}

function isAbortError(err) {
  return err?.name === 'AbortError';
}

function paintNextFrame() {
  return new Promise(resolve => requestAnimationFrame(() => resolve()));
}

function formatBoundsDetail(bounds) {
  const latSpan = Math.abs(bounds.getNorth() - bounds.getSouth());
  const lonSpan = Math.abs(bounds.getEast() - bounds.getWest());
  return `Die Vorschau zeigt die ungefähre Ausdehnung (${latSpan.toFixed(2)}° × ${lonSpan.toFixed(2)}°). Der vollständige Export kann bei Ländern oder großen Verwaltungsgrenzen mehrere Minuten dauern.`;
}

function buildPhaseHandler(operation) {
  return (message) => {
    if (operation.isCurrent()) {
      setLoading(true, message);
    }
  };
}

function getCollectionFeatureCollection() {
  return {
    type: 'FeatureCollection',
    features: getCollectionItems()
  };
}

function getSelectedFeatureCollection() {
  const selectedData = getSelectedObjectData();
  if (!selectedData || !Array.isArray(selectedData.features) || selectedData.features.length === 0) {
    return null;
  }
  return {
    type: 'FeatureCollection',
    features: selectedData.features
  };
}

function updateExportButtonsForCurrentState() {
  const hasCollectionItems = getCollectionItems().length > 0;
  const hasSelectedGeometry = Boolean(getSelectedFeatureCollection());
  setExportButtonsActive(hasCollectionItems || hasSelectedGeometry);
}

function getExportPayload() {
  const collectionItems = getCollectionItems();
  if (collectionItems.length > 0) {
    return {
      data: getCollectionFeatureCollection(),
      filename: 'geojson-kollektion.geojson'
    };
  }

  const selectedData = getSelectedFeatureCollection();
  if (selectedData) {
    return {
      data: selectedData,
      filename: 'geojson-auswahl.geojson'
    };
  }

  return null;
}

export function resetSelection() {
  setSelectedObjectData(null);
  setAddToCollectionButtonActive(false);
  updateExportButtonsForCurrentState();
}

export async function doExport(action) {
  const payload = getExportPayload();
  if (!payload) return;

  const { copyBtn, downBtn } = getDomRefs();
  const btn = action === 'copy' ? copyBtn : downBtn;
  const jsonString = JSON.stringify(payload.data, null, 2);

  try {
    if (action === 'copy') {
      await navigator.clipboard.writeText(jsonString);
      setExportButtonTemporaryText(btn, 'Kopiert!');
      return;
    }

    const blob = new Blob([jsonString], { type: 'application/geo+json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = payload.filename;
    a.click();
    setExportButtonTemporaryText(btn, 'Download OK');
  } catch {
    alert('Export-Fehler');
  }
}

function prepareForNewQuery(map) {
  abortListRequest();
  abortGeometryRequest();
  setLoading(false);
  resetSelection();
  hideError();
  clearHighlightLayer(map);
  resetSearchResultsSelect();
}

function applySearchResult(map, lat, lon) {
  setClickMarkerAt(map, lat, lon);
  map.setView([lat, lon], 16);
  return fetchObjects(map, lat, lon);
}

export async function searchPlace(map, query) {
  if (!query) {
    showError('Bitte gib einen Ort für die Suche ein.');
    return;
  }

  prepareForNewQuery(map);
  setLoading(true, 'Suche Ort...');

  try {
    const results = await searchNominatim(query);
    if (!Array.isArray(results) || results.length === 0) {
      showError('Kein Treffer gefunden. Bitte versuche eine präzisere Suche.');
      return;
    }

    const parsedResults = results
      .map((result) => {
        const latNum = Number(result.lat);
        const lonNum = Number(result.lon);
        if (!Number.isFinite(latNum) || !Number.isFinite(lonNum)) return null;
        return { ...result, lat: latNum, lon: lonNum };
      })
      .filter(Boolean);

    if (parsedResults.length === 0) {
      showError('Ungültige Koordinaten aus der Suche erhalten.');
      return;
    }

    if (parsedResults.length === 1) {
      resetSearchResultsSelect();
      await applySearchResult(map, parsedResults[0].lat, parsedResults[0].lon);
      return;
    }

    populateSearchResultsSelect(parsedResults);
  } catch (err) {
    if (!isAbortError(err)) {
      showError(err.message || 'Unbekannter Fehler bei der Suche.');
    }
  } finally {
    setLoading(false);
  }
}

export async function fetchObjects(map, lat, lon) {
  const operation = startListRequest();
  hideError();
  showResultMessage('Frage Objektliste bei Overpass an...');
  const query = `[out:json][timeout:60]; ( nwr(around:45, ${lat}, ${lon}); is_in(${lat}, ${lon})->.a; nwr(pivot.a); ); out tags center;`;

  try {
    const data = await fetchOverpassJson(query, {
      maxWaitMs: CONFIG.MAX_WAIT_SEARCH_MS,
      signal: operation.signal,
      onPhase: (msg) => {
        if (operation.isCurrent()) showResultMessage(msg);
      },
      onWaitMessage: (msg) => {
        if (operation.isCurrent()) showResultMessage(msg);
      }
    });

    if (!operation.isCurrent()) return;

    const elements = (data.elements || []).filter(el => el.tags);
    if (elements.length === 0) {
      const { resultsDiv } = getDomRefs();
      resultsDiv.textContent = 'Nichts gefunden.';
      return;
    }

    renderList(elements, async (element, itemNode) => {
      await highlightObjectOnMap(map, element.type, element.id, itemNode);
    });
  } catch (err) {
    if (isAbortError(err) || !operation.isCurrent()) return;
    const { resultsDiv } = getDomRefs();
    resultsDiv.textContent = 'Fehler beim Laden der Liste.';
    showError(err.message);
  } finally {
    operation.clear();
  }
}

export async function highlightObjectOnMap(map, type, id, domElement) {
  const operation = startGeometryRequest();
  clearItemSelection();
  selectItem(domElement);
  hideError();
  setLoading(true, 'Bereite Geometrie-Abfrage vor...');
  resetSelection();

  const target = resolveAreaGeometryTarget(type, id);
  if (!target) {
    showError('Area kann nicht auf Way/Relation zurückgeführt werden.');
    setLoading(false);
    operation.clear();
    return;
  }

  const queryType = target.type;
  const queryId = target.id;

  if (queryType === 'relation') {
    const previewQuery = `[out:json][timeout:180][maxsize:${CONFIG.OVERPASS_PREVIEW_MAXSIZE_BYTES}]; relation(${queryId}); out center bb;`;
    try {
      setLoading(true, 'Prüfe Größe der Relation...');
      const previewJson = await fetchOverpassJson(previewQuery, {
        maxWaitMs: CONFIG.MAX_WAIT_GEOM_MS,
        requestTimeoutMs: CONFIG.REQUEST_TIMEOUT_GEOM_MS,
        signal: operation.signal,
        onPhase: buildPhaseHandler(operation),
        onWaitMessage: buildPhaseHandler(operation)
      });

      if (!operation.isCurrent()) return;

      const relation = (previewJson.elements || []).find(el => el.type === 'relation' && el.id === queryId);
      const bounds = boundsFromElement(relation);
      if (bounds && bounds.isValid()) {
        drawRelationPreviewBounds(map, bounds);
        if (relationPreviewShouldShowGeomHint(bounds)) {
          const shouldLoad = await promptLargeGeometryLoad(
            'Diese Relation umfasst einen großen Bereich.',
            formatBoundsDetail(bounds)
          );

          if (!operation.isCurrent() || !shouldLoad) {
            setLoading(false);
            operation.clear();
            return;
          }
        }
      }
    } catch (err) {
      if (!isAbortError(err) && operation.isCurrent()) {
        showError(err.message);
      }
      setLoading(false);
      operation.clear();
      return;
    }
  }

  const query = `[out:json][timeout:180][maxsize:${CONFIG.OVERPASS_GEOM_MAXSIZE_BYTES}]; ${queryType}(${queryId}); out geom;`;

  try {
    setLoading(true, 'Frage vollständige Geometrie bei Overpass an...');
    const osmJson = await fetchOverpassJson(query, {
      maxWaitMs: CONFIG.MAX_WAIT_GEOM_MS,
      requestTimeoutMs: CONFIG.REQUEST_TIMEOUT_GEOM_MS,
      signal: operation.signal,
      onPhase: buildPhaseHandler(operation),
      onWaitMessage: buildPhaseHandler(operation)
    });

    if (!operation.isCurrent()) return;

    setLoading(true, 'Daten empfangen, wandle in GeoJSON um...');
    await paintNextFrame();
    if (!operation.isCurrent()) return;

    const geojson = osmtogeojson(osmJson);
    geojson.features = geojson.features.filter(f => f.id === `${queryType}/${queryId}`);
    if (geojson.features.length === 0) throw new Error('Keine Geometrie gefunden.');

    if (!operation.isCurrent()) return;

    setLoading(true, 'Zeichne Geometrie auf der Karte...');
    await paintNextFrame();
    if (!operation.isCurrent()) return;

    setSelectedObjectData(geojson);
    drawGeoJsonHighlight(map, geojson);
    setAddToCollectionButtonActive(true);
    updateExportButtonsForCurrentState();
  } catch (err) {
    if (!isAbortError(err) && operation.isCurrent()) {
      showError(err.message);
    }
  } finally {
    if (operation.isCurrent()) {
      setLoading(false);
    }
    operation.clear();
  }
}

export async function onSearchSelection(map, value) {
  if (!value) return;
  const [latString, lonString] = value.split(',');
  const lat = Number(latString);
  const lon = Number(lonString);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) {
    showError('Ungültige Koordinaten aus der Auswahl erhalten.');
    return;
  }
  hideError();
  await applySearchResult(map, lat, lon);
}
