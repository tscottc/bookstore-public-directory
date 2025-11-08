// John K. King Bookstore - Public Directory App
// Search Directory Functionality

// --- Constants ---
const DIRECTORY_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS2iABeNRjSNn_F__Dcd4SAJWYwno0ajUk9tyRf9WmY240V28Q3jZMxW6NBpZWNtc0visIoj128Kc__/pub?gid=0&single=true&output=csv';

// --- State Variables ---
let directoryData = [];
let directoryFuse;
let isDirectoryInitialized = false;

// --- DOM Elements ---
const elements = {
  searchBar: document.getElementById('search-bar'),
  searchButton: document.getElementById('search-button'),
  resetButton: document.getElementById('reset-button'),
  floorFilter: document.getElementById('floor-filter'),
  resultsContainer: document.getElementById('results-container'),
  searchStatus: document.getElementById('search-status'),
  rowCount: document.getElementById('row-count'),
  loadingMessage: document.getElementById('loading-message')
};

// --- Helper Functions ---

/**
 * Parse CSV text into array of objects
 * Copied from old-app-code/public/index.html:746-754
 */
function parseCSV(csvText) {
  const lines = csvText.split(/\r?\n/).filter(line => line.trim() !== '');
  if (lines.length < 2) return [];
  const headers = lines[0].split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(h => h.trim().replace(/^"|"$/g, ''));
  return lines.slice(1).map(line => {
    const values = line.split(/,(?=(?:[^"]*"[^"]*")*[^"]*$)/).map(v => v?.trim().replace(/^"|"$/g, '').replace(/""/g, '"'));
    return headers.reduce((obj, header, i) => { (obj[header] = values[i] || ''); return obj; }, {});
  });
}

/**
 * Populate floor filter dropdown with available floors
 * Adapted from old-app-code/public/index.html:875-884
 */
function populateFloorFilter() {
  if (!directoryData || directoryData.length === 0) return;
  const floors = [...new Set(directoryData.map(item => item['FLOOR']))].filter(Boolean).sort((a, b) => a - b);
  floors.forEach(floor => {
    const option = document.createElement('option');
    option.value = floor;
    option.textContent = `Floor ${floor}`;
    elements.floorFilter.appendChild(option);
  });
}

/**
 * Render directory results as a table
 * Copied from old-app-code/public/index.html:912-933
 */
function renderDirectoryTable(data, query = '') {
  if (elements.loadingMessage) elements.loadingMessage.style.display = 'none';

  if (!data || data.length === 0) {
    if (query) {
      elements.resultsContainer.innerHTML = `
        <div class="no-results">
          <p>No results found for "<strong>${query}</strong>".</p>
          <p class="suggestion-text">Try searching with different keywords or check the spelling.</p>
        </div>`;
    } else {
      elements.resultsContainer.innerHTML = `<p class="no-results">No results found.</p>`;
    }
    return;
  }

  const headers = Object.keys(data[0] || {}).filter(h => h.toUpperCase() !== 'KEYWORDS');
  let tableHTML = `<table><thead><tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr></thead><tbody>`;
  data.forEach(row => {
    tableHTML += `<tr>${headers.map(h => `<td>${row[h] || ''}</td>`).join('')}</tr>`;
  });
  elements.resultsContainer.innerHTML = tableHTML + '</tbody></table>';
}

/**
 * Perform directory search based on query and floor filter
 * Adapted from old-app-code/public/index.html:1224-1252
 */
function performDirectorySearch(isFinalSearch = false) {
  const query = elements.searchBar.value.trim();
  const floor = elements.floorFilter.value;

  let results = directoryData;

  if (query) {
    results = directoryFuse.search(query).map(r => r.item);
  }

  if (floor) {
    results = results.filter(r => r['FLOOR'] === floor);
  }

  renderDirectoryTable(results, query);
  elements.rowCount.textContent = `Found ${results.length} of ${directoryData.length} entries.`;

  // Hide keyboard on mobile after search
  if (isFinalSearch && elements.searchBar) {
    elements.searchBar.blur();
  }
}

/**
 * Initialize the directory page - fetch data and set up Fuse.js
 * Adapted from old-app-code/public/index.html:886-897
 */
async function initializeDirectoryPage() {
  isDirectoryInitialized = true;
  try {
    const response = await fetch(DIRECTORY_CSV_URL);
    const text = await response.text();
    directoryData = parseCSV(text);

    // Initialize Fuse.js for fuzzy search
    directoryFuse = new Fuse(directoryData, {
      keys: Object.keys(directoryData[0] || {}),
      threshold: 0.4,
      ignoreLocation: true
    });

    populateFloorFilter();
    renderDirectoryTable(directoryData);
    elements.rowCount.textContent = `Showing all ${directoryData.length} entries.`;
  } catch (e) {
    console.error("Directory Init Error", e);
    elements.resultsContainer.innerHTML = `<p class="error">Error loading directory data. Please refresh the page.</p>`;
  }
}

/**
 * Reset search filters and show all results
 */
function resetSearch() {
  elements.searchBar.value = '';
  elements.floorFilter.value = '';
  renderDirectoryTable(directoryData);
  elements.rowCount.textContent = `Showing all ${directoryData.length} entries.`;
}

// --- Event Listeners ---

// Floor filter change
elements.floorFilter.addEventListener('change', () => performDirectorySearch(true));

// Search input - Enter key
elements.searchBar.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    performDirectorySearch(true);
  }
});

// Search button click
elements.searchButton.addEventListener('click', () => performDirectorySearch(true));

// Reset button click
elements.resetButton.addEventListener('click', resetSearch);

// --- Initialize App ---
document.addEventListener('DOMContentLoaded', () => {
  initializeDirectoryPage();
});
