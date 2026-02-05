import { initMap } from './map.js';
import { addSelectedObjectToCollection, doExport, fetchObjects, onSearchSelection, resetSelection, searchPlace } from './features.js';
import { getSearchDebounceTimer, setSearchDebounceTimer } from './state.js';
import { getDomRefs } from './ui.js';

const map = initMap((lat, lng) => {
  resetSelection();
  fetchObjects(map, lat, lng);
});

const searchInput = document.getElementById('searchInput');
const searchBtn = document.getElementById('searchBtn');
const { searchResultsSelect, copyBtn, downBtn, addToCollectionBtn } = getDomRefs();

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
