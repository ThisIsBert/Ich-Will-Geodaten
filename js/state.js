const state = {
  clickMarker: null,
  highlightLayer: null,
  selectedObjectData: null,
  searchDebounceTimer: null
};

export function getClickMarker() { return state.clickMarker; }
export function setClickMarker(marker) { state.clickMarker = marker; }

export function getHighlightLayer() { return state.highlightLayer; }
export function setHighlightLayer(layer) { state.highlightLayer = layer; }

export function getSelectedObjectData() { return state.selectedObjectData; }
export function setSelectedObjectData(data) { state.selectedObjectData = data; }

export function getSearchDebounceTimer() { return state.searchDebounceTimer; }
export function setSearchDebounceTimer(timer) { state.searchDebounceTimer = timer; }
