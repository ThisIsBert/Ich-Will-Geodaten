const loader = document.getElementById('loading-overlay');
const loadingText = document.getElementById('loading-text');
const errorBox = document.getElementById('status-error');
const searchResultsSelect = document.getElementById('searchResultsSelect');
const resultsDiv = document.getElementById('results');
const copyBtn = document.getElementById('copyBtn');
const downBtn = document.getElementById('downBtn');
const addToCollectionBtn = document.getElementById('addToCollectionBtn');

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

export function setLoading(isLoading, message = 'Fordere Daten an...') {
  loader.style.display = isLoading ? 'flex' : 'none';
  loadingText.innerText = message;
}

export function showResultMessage(message) {
  resultsDiv.innerHTML = `<p style="text-align:center;">${escapeHtml(message)}</p>`;
}

export function showInitialHint() {
  resultsDiv.innerHTML = '<p style="text-align:center; color: #888;">Klicke in der Karte auf den gewünschten Ort, um Geo-Daten zu laden</p>';
}

export function resetSearchResultsSelect() {
  searchResultsSelect.innerHTML = '';
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
  resultsDiv.innerHTML = '';
  elements.forEach(el => {
    const t = el.tags;
    const name = t['name:de'] || t['name:en'] || t.name || t.highway || t.amenity || t.building || t.boundary || `ID: ${el.id}`;
    const item = document.createElement('div');
    item.className = 'object-item';
    item.innerHTML = `<span class="object-title">[${escapeHtml(el.type.toUpperCase())}] ${escapeHtml(name)}</span>
      <details><summary>Mehr Info</summary><div class="tag-grid">
      ${Object.entries(t).map(([k, v]) => `<b>${escapeHtml(k)}:</b><span>${escapeHtml(v)}</span>`).join('')}
      </div></details>`;

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
