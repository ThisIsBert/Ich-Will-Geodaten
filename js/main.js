const loader = document.getElementById('loading-overlay');
if (loader && !document.getElementById('loading-actions')) {
  const loadingActions = document.createElement('div');
  loadingActions.id = 'loading-actions';
  loadingActions.className = 'loading-actions';
  loader.appendChild(loadingActions);
}

const [mapModule, featuresModule, stateModule, uiModule] = await Promise.all([
  import('./map.js'),
  import('./features-long-loads.js'),
  import('./state.js'),
  import('./ui.js')
]);

const { initMap } = mapModule;
const { addSelectedObjectToCollection, doExport, fetchObjects, onSearchSelection, resetSelection, searchPlace } = featuresModule;
const { getSearchDebounceTimer, setSearchDebounceTimer } = stateModule;
const { getDomRefs, initHelpOverlay } = uiModule;

const map = initMap((lat, lng) => {
  resetSelection();
  fetchObjects(map, lat, lng);
});

const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const { searchResultsSelect, copyBtn, downBtn, addToCollectionBtn } = getDomRefs();

initHelpOverlay();

function queueSearch() {
  const existingTimer = getSearchDebounceTimer();
  if (existingTimer) {
    clearTimeout(existingTimer);
  }
  const timer = setTimeout(() => {
    searchPlace(map, searchInput.value.trim());
  }, 300);
  setSearchDebounceTimer(timer);
}

searchBtn.addEventListener('click', () => {
  queueSearch();
});

searchInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    queueSearch();
  }
});

searchResultsSelect.addEventListener('change', async (event) => {
  await onSearchSelection(map, event.target.value);
});

copyBtn.addEventListener('click', () => doExport('copy'));
downBtn.addEventListener('click', () => doExport('download'));
addToCollectionBtn.addEventListener('click', addSelectedObjectToCollection);
