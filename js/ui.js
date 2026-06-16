const loader = document.getElementById('loading-overlay');
const loadingText = document.getElementById('loading-text');
const loadingActions = document.getElementById('loading-actions');
const errorBox = document.getElementById('status-error');
const searchResultsSelect = document.getElementById('searchResultsSelect');
const resultsDiv = document.getElementById('results');
const copyBtn = document.getElementById('copyBtn');
const downBtn = document.getElementById('downBtn');
const addToCollectionBtn = document.getElementById('addToCollectionBtn');
const helpBtn = document.getElementById('helpBtn');
const helpOverlay = document.getElementById('helpOverlay');
const closeHelpBtn = document.getElementById('closeHelpBtn');

let cancelPendingLoadingPrompt = null;

export function getDomRefs() {
  return {
    errorBox,
    searchResultsSelect,
    resultsDiv,
    copyBtn,
    downBtn,
    addToCollectionBtn
  };
}

export function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function showError(message) {
  errorBox.style.display = 'block';
  errorBox.innerText = message;
}

export function hideError() {
  errorBox.style.display = 'none';
}

function clearLoadingActions() {
  if (loadingActions) {
    loadingActions.replaceChildren();
  }
  loader.classList.remove('loading-overlay--prompt');
}

function cancelLoadingPrompt() {
  if (!cancelPendingLoadingPrompt) return;
  const cancel = cancelPendingLoadingPrompt;
  cancelPendingLoadingPrompt = null;
  cancel();
}

export function setLoading(isLoading, message = 'Fordere Daten an...') {
  cancelLoadingPrompt();
  clearLoadingActions();
  loader.style.display = isLoading ? 'flex' : 'none';
  loadingText.innerText = message;
}

export function promptLargeGeometryLoad(message, detail = '') {
  cancelLoadingPrompt();
  clearLoadingActions();

  return new Promise((resolve) => {
    loader.style.display = 'flex';
    loader.classList.add('loading-overlay--prompt');
    loadingText.innerText = message;

    const detailNode = document.createElement('p');
    detailNode.className = 'loading-detail';
    detailNode.textContent = detail;

    const loadButton = document.createElement('button');
    loadButton.type = 'button';
    loadButton.className = 'loading-action loading-action--primary';
    loadButton.textContent = 'Vollständige Geometrie laden';

    const cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.className = 'loading-action';
    cancelButton.textContent = 'Nur Vorschau behalten';

    function finish(value) {
      if (cancelPendingLoadingPrompt === finishCancel) {
        cancelPendingLoadingPrompt = null;
      }
      clearLoadingActions();
      resolve(value);
    }

    function finishCancel() {
      finish(false);
    }

    loadButton.addEventListener('click', () => finish(true));
    cancelButton.addEventListener('click', () => finish(false));

    if (detail) {
      loadingActions.appendChild(detailNode);
    }
    loadingActions.appendChild(loadButton);
    loadingActions.appendChild(cancelButton);

    cancelPendingLoadingPrompt = finishCancel;
  });
}

export function showResultMessage(message) {
  const p = document.createElement('p');
  p.style.textAlign = 'center';
  p.textContent = message;
  resultsDiv.replaceChildren(p);
}

export function showInitialHint() {
  const p = document.createElement('p');
  p.style.textAlign = 'center';
  p.style.color = '#888';
  p.textContent = 'Klicke in der Karte auf den gewünschten Ort, um Geo-Daten zu laden';
  resultsDiv.replaceChildren(p);
}

export function resetSearchResultsSelect() {
  searchResultsSelect.replaceChildren();
  searchResultsSelect.style.display = 'none';
}

export function populateSearchResultsSelect(results) {
  resetSearchResultsSelect();
  const placeholderOption = document.createElement('option');
  placeholderOption.value = '';
  placeholderOption.textContent = 'Bitte Treffer auswählen...';
  placeholderOption.disabled = true;
  placeholderOption.selected = true;
  searchResultsSelect.appendChild(placeholderOption);

  results.forEach((result, index) => {
    const option = document.createElement('option');
    option.value = `${result.lat},${result.lon}`;
    option.textContent = result.display_name || `Treffer ${index + 1}`;
    searchResultsSelect.appendChild(option);
  });

  searchResultsSelect.style.display = 'block';
}

export function renderList(elements, onSelectObject) {
  resultsDiv.replaceChildren();
  elements.forEach(el => {
    const t = el.tags;
    const name = t['name:de'] || t['name:en'] || t.name || t.highway || t.amenity || t.building || t.boundary || `ID: ${el.id}`;
    const item = document.createElement('div');
    item.className = 'object-item';

    const title = document.createElement('span');
    title.className = 'object-title';
    title.textContent = `[${el.type.toUpperCase()}] ${name}`;
    item.appendChild(title);

    const details = document.createElement('details');
    const summary = document.createElement('summary');
    summary.textContent = 'Mehr Info';
    details.appendChild(summary);

    const tagGrid = document.createElement('div');
    tagGrid.className = 'tag-grid';
    Object.entries(t).forEach(([key, value]) => {
      const keyNode = document.createElement('b');
      keyNode.textContent = `${key}:`;
      const valueNode = document.createElement('span');
      valueNode.textContent = value;
      tagGrid.appendChild(keyNode);
      tagGrid.appendChild(valueNode);
    });
    details.appendChild(tagGrid);
    item.appendChild(details);

    item.addEventListener('click', (e) => {
      if (e.target.tagName !== 'SUMMARY' && e.target.closest('details') === null) {
        onSelectObject(el, item);
      }
    });
    resultsDiv.appendChild(item);
  });
}

export function clearItemSelection() {
  document.querySelectorAll('.object-item').forEach(i => i.classList.remove('selected'));
}

export function selectItem(domElement) {
  domElement.classList.add('selected');
}

export function setExportButtonsActive(isActive) {
  copyBtn.classList.toggle('active', isActive);
  downBtn.classList.toggle('active', isActive);
}

export function setAddToCollectionButtonActive(isActive) {
  addToCollectionBtn.classList.toggle('active', isActive);
}

export function updateCollectionButtonCount(count) {
  if (count > 0) {
    addToCollectionBtn.innerText = `${count} Element(e) in der Kollektion`;
    return;
  }
  addToCollectionBtn.innerText = 'Füge der Kollektion hinzu';
}

export function setExportButtonTemporaryText(button, text, timeoutMs = 2000) {
  const originalText = button.innerText;
  button.innerText = text;
  setTimeout(() => {
    button.innerText = originalText;
  }, timeoutMs);
}

export function initHelpOverlay() {
  const closeOverlay = () => {
    helpOverlay.classList.remove('active');
    helpOverlay.setAttribute('aria-hidden', 'true');
  };

  helpBtn.addEventListener('click', () => {
    helpOverlay.classList.add('active');
    helpOverlay.setAttribute('aria-hidden', 'false');
  });

  closeHelpBtn.addEventListener('click', closeOverlay);

  helpOverlay.addEventListener('click', (event) => {
    if (event.target === helpOverlay) {
      closeOverlay();
    }
  });

  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      closeOverlay();
    }
  });
}
