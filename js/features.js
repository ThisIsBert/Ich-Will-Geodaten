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
  renderList,
  resetSearchResultsSelect,
  selectItem,
  setExportButtonsActive,
  setExportButtonTemporaryText,
  setLoading,
  showError,
  showResultMessage,
  clearItemSelection
} from './ui.js';
import { getSelectedObjectData, setSelectedObjectData } from './state.js';

export function resetSelection() {
  setSelectedObjectData(null);
  setExportButtonsActive(false);
}

function prepareForNewQuery(map) {
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
    showError(err.message || 'Unbekannter Fehler bei der Suche.');
  } finally {
    setLoading(false);
  }
}

export async function fetchObjects(map, lat, lon) {
  hideError();
  showResultMessage('Suche...');
  const query = `[out:json][timeout:60]; ( nwr(around:45, ${lat}, ${lon}); is_in(${lat}, ${lon})->.a; nwr(pivot.a); ); out tags center;`;

  try {
    const data = await fetchOverpassJson(query, {
      maxWaitMs: CONFIG.MAX_WAIT_SEARCH_MS,
      onWaitMessage: (msg) => showResultMessage(msg)
    });
    const elements = (data.elements || []).filter(el => el.tags);
    if (elements.length === 0) {
      const { resultsDiv } = getDomRefs();
      resultsDiv.innerHTML = 'Nichts gefunden.';
      return;
    }

    renderList(elements, async (element, itemNode) => {
      await highlightObjectOnMap(map, element.type, element.id, itemNode);
    });
  } catch (err) {
    const { resultsDiv } = getDomRefs();
    resultsDiv.innerHTML = 'Fehler beim Laden der Liste.';
    showError(err.message);
  }
}

export async function highlightObjectOnMap(map, type, id, domElement) {
  clearItemSelection();
  selectItem(domElement);
  hideError();
  setLoading(true);
  resetSelection();

  const target = resolveAreaGeometryTarget(type, id);
  if (!target) {
    showError('Area kann nicht auf Way/Relation zurückgeführt werden.');
    setLoading(false);
    return;
  }

  const queryType = target.type;
  const queryId = target.id;

  if (queryType === 'relation') {
    const previewQuery = `[out:json][timeout:180][maxsize:134217728]; relation(${queryId}); out center bb;`;
    try {
      const previewJson = await fetchOverpassJson(previewQuery, {
        maxWaitMs: CONFIG.MAX_WAIT_GEOM_MS,
        onWaitMessage: (msg) => setLoading(true, msg)
      });
      const relation = (previewJson.elements || []).find(el => el.type === 'relation' && el.id === queryId);
      const bounds = boundsFromElement(relation);
      if (bounds && bounds.isValid()) {
        drawRelationPreviewBounds(map, bounds);
        if (relationPreviewShouldShowGeomHint(bounds)) {
          setLoading(true, 'Große Geometrie wird geladen...');
        }
      }
    } catch (err) {
      showError(err.message);
      setLoading(false);
      return;
    }
  }

  const query = `[out:json][timeout:180][maxsize:134217728]; ${queryType}(${queryId}); out geom;`;

  try {
    const osmJson = await fetchOverpassJson(query, {
      maxWaitMs: CONFIG.MAX_WAIT_GEOM_MS,
      onWaitMessage: (msg) => setLoading(true, msg)
    });

    const geojson = osmtogeojson(osmJson);
    geojson.features = geojson.features.filter(f => f.id === `${queryType}/${queryId}`);
    if (geojson.features.length === 0) throw new Error('Keine Geometrie gefunden.');

    setSelectedObjectData(geojson);
    drawGeoJsonHighlight(map, geojson);
    setExportButtonsActive(true);
  } catch (err) {
    showError(err.message);
  } finally {
    setLoading(false);
  }
}

export async function doExport(action) {
  const data = getSelectedObjectData();
  if (!data) return;

  const { copyBtn, downBtn } = getDomRefs();
  const btn = action === 'copy' ? copyBtn : downBtn;
  const jsonString = JSON.stringify(data, null, 2);

  try {
    if (action === 'copy') {
      await navigator.clipboard.writeText(jsonString);
      setExportButtonTemporaryText(btn, 'Kopiert!');
    } else {
      const blob = new Blob([jsonString], { type: 'application/json' });
      const a = document.createElement('a');
      const name = data.features[0].id.replace('/', '_');
      a.href = URL.createObjectURL(blob);
      a.download = `${name}.geojson`;
      a.click();
      setExportButtonTemporaryText(btn, 'Download OK');
    }
  } catch {
    alert('Export-Fehler');
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
