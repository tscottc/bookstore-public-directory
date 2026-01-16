// John K. King Bookstore - Public Directory App
// Search Directory Functionality

// --- Constants ---
const DIRECTORY_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS2iABeNRjSNn_F__Dcd4SAJWYwno0ajUk9tyRf9WmY240V28Q3jZMxW6NBpZWNtc0visIoj128Kc__/pub?gid=0&single=true&output=csv';
const FAQ_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vT_rXkbRD1rRq3Fb08uX5fboYgmbqWWKKNB9poXgu1Bv1wHklLmz67_PcEvcTpkBPKfyjq3VIYy32Rl/pub?output=csv';

// --- State Variables ---
let directoryData = [];
let directoryFuse;
let isDirectoryInitialized = false;

let faqData = [];
let faqFuse;
let isFaqInitialized = false;

// --- DOM Elements (will be initialized after DOM loads) ---
let elements = {};

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

  // Clear existing dynamically added options, keeping the first static "All Floors" option
  while (elements.floorFilter.children.length > 1) { // Keep the first child (the static "All Floors" option)
    elements.floorFilter.removeChild(elements.floorFilter.lastChild);
  }

  const floors = [...new Set(directoryData.map(item => item['FLOOR']))]
    .filter(floor => {
      const parsed = parseInt(floor);
      return !isNaN(parsed) && parsed > 0; // Only include positive integers
    })
    .sort((a, b) => a - b);

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
          <p class="suggestion-text">Please consider suggesting a subject area to add to the directory.</p>
          <iframe src="https://docs.google.com/forms/d/e/1FAIpQLSfbHuDXDbKlq85_eDGzYY6xtzqNEXCi7pUlR2I5C0t2EawzIA/viewform?embedded=true" width="640" height="600" frameborder="0" marginheight="0" marginwidth="0">Loading…</iframe>
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

// --- FAQ Functions ---

/**
 * Initialize the FAQ page - fetch data and set up Fuse.js
 * Adapted from old-app-code/public/index.html:899-909
 */
async function initializeFaqPage() {
  isFaqInitialized = true;
  try {
    const response = await fetch(FAQ_CSV_URL);
    const text = await response.text();
    faqData = parseCSV(text);

    // Initialize Fuse.js for weighted fuzzy search
    faqFuse = new Fuse(faqData, {
      keys: [
        { name: 'Question', weight: 0.6 },
        { name: 'Answer', weight: 0.3 },
        { name: 'Keywords', weight: 0.5 }
      ],
      threshold: 0.4,
      ignoreLocation: true
    });

    renderFaqCards(faqData);
    elements.faqRowCount.textContent = `Showing all ${faqData.length} questions.`;
  } catch (e) {
    console.error("FAQ Init Error", e);
    elements.faqResultsContainer.innerHTML = `<p class="error">Error loading FAQ data. Please refresh the page.</p>`;
  }
}

/**
 * Render FAQ results as expandable cards
 * Adapted from old-app-code/public/index.html:935-964
 */
function renderFaqCards(data, query = '') {
  if (elements.faqLoadingMessage) elements.faqLoadingMessage.style.display = 'none';

  if (!data || data.length === 0) {
    if (query) {
      elements.faqResultsContainer.innerHTML = `
        <div class="no-results">
          <p>No results found for "<strong>${query}</strong>".</p>
          <p class="suggestion-text">Try searching with different keywords or check the spelling.</p>
        </div>`;
    } else {
      elements.faqResultsContainer.innerHTML = `<p class="no-results">No results found.</p>`;
    }
    return;
  }

  let cardHTML = '<div class="faq-cards-container">';
  data.forEach((entry) => {
    const question = entry['Question'] || 'No Question';
    const answer = entry['Answer'] || 'No Answer.';
    const category = entry['Category'] || '';

    cardHTML += `
      <div class="faq-card">
        <div class="faq-question">
          <div><span class="faq-icon">❓</span> ${question}</div>
          <span class="faq-toggle-icon">▼</span>
        </div>
        <div class="faq-answer">
          <p>${answer.replace(/\n/g, '<br>')}</p>
          ${category ? `<div class="faq-category">Category: ${category}</div>` : ''}
        </div>
      </div>`;
  });
  elements.faqResultsContainer.innerHTML = cardHTML + '</div>';

  // Add click handlers for FAQ accordion
  document.querySelectorAll('.faq-question').forEach(qDiv => {
    qDiv.addEventListener('click', () => {
      qDiv.nextElementSibling.classList.toggle('expanded');
      qDiv.querySelector('.faq-toggle-icon').classList.toggle('rotated');
    });
  });
}

/**
 * Perform FAQ search
 * Adapted from old-app-code/public/index.html:1254-1275
 */
function performFaqSearch(isFinalSearch = false) {
  const query = elements.faqSearchBar.value.trim();

  const results = query ? faqFuse.search(query).map(r => r.item) : faqData;
  renderFaqCards(results, query);
  elements.faqRowCount.textContent = `Found ${results.length} of ${faqData.length} questions.`;

  // Hide keyboard on mobile after search
  if (isFinalSearch && elements.faqSearchBar) {
    elements.faqSearchBar.blur();
  }
}

/**
 * Reset FAQ search and show all questions
 */
function resetFaqSearch() {
  elements.faqSearchBar.value = '';
  renderFaqCards(faqData);
  elements.faqRowCount.textContent = `Showing all ${faqData.length} questions.`;
}

// --- Navigation Functions ---

/**
 * Switch between Directory and FAQ sections
 */
function switchSection(sectionName) {
  // Update URL hash
  window.location.hash = sectionName;

  // Update active nav button
  elements.navButtons.forEach(btn => {
    if (btn.dataset.section === sectionName) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  // Update active section
  elements.sections.forEach(section => {
    if (section.id === `${sectionName}-section`) {
      section.classList.add('active');
    } else {
      section.classList.remove('active');
    }
  });

  // Initialize section if needed
  if (sectionName === 'faq' && !isFaqInitialized) {
    initializeFaqPage();
  }
}

// --- Modal Functions ---

/**
 * Open feedback modal
 */
function openFeedbackModal() {
  elements.feedbackModalOverlay.style.display = 'flex';
}

/**
 * Close feedback modal
 */
function closeFeedbackModal() {
  elements.feedbackModalOverlay.style.display = 'none';
}

// --- Initialize App ---
document.addEventListener('DOMContentLoaded', () => {
  // Initialize DOM elements after page loads
  elements = {
    // Directory elements
    searchBar: document.getElementById('search-bar'),
    searchButton: document.getElementById('search-button'),
    resetButton: document.getElementById('reset-button'),
    floorFilter: document.getElementById('floor-filter'),
    resultsContainer: document.getElementById('results-container'),
    searchStatus: document.getElementById('search-status'),
    rowCount: document.getElementById('row-count'),
    loadingMessage: document.getElementById('loading-message'),

    // FAQ elements
    faqSearchBar: document.getElementById('faq-search-bar'),
    faqSearchButton: document.getElementById('faq-search-button'),
    faqResetButton: document.getElementById('faq-reset-button'),
    faqResultsContainer: document.getElementById('faq-results-container'),
    faqSearchStatus: document.getElementById('faq-search-status'),
    faqRowCount: document.getElementById('faq-row-count'),
    faqLoadingMessage: document.getElementById('faq-loading-message'),

    // Navigation and sections
    navButtons: document.querySelectorAll('.nav-btn'),
    sections: document.querySelectorAll('.section'),

    // Modal elements
    feedbackBtn: document.getElementById('feedback-btn'),
    feedbackModalOverlay: document.getElementById('feedback-modal-overlay'),
    closeFeedbackModal: document.getElementById('close-feedback-modal')
  };

  // --- Event Listeners ---

  // Directory Listeners
  elements.floorFilter.addEventListener('change', () => performDirectorySearch(true));

  elements.searchBar.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      performDirectorySearch(true);
    }
  });

  elements.searchButton.addEventListener('click', () => performDirectorySearch(true));
  elements.resetButton.addEventListener('click', resetSearch);

  // FAQ Listeners
  elements.faqSearchBar.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      performFaqSearch(true);
    }
  });

  elements.faqSearchButton.addEventListener('click', () => performFaqSearch(true));
  elements.faqResetButton.addEventListener('click', resetFaqSearch);

  // Navigation Listeners
  elements.navButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const section = btn.dataset.section;
      if (section) {
        switchSection(section);
      }
    });
  });

  // Modal Listeners
  elements.feedbackBtn.addEventListener('click', openFeedbackModal);
  elements.closeFeedbackModal.addEventListener('click', closeFeedbackModal);

  // Close modal when clicking outside
  elements.feedbackModalOverlay.addEventListener('click', (e) => {
    if (e.target === elements.feedbackModalOverlay) {
      closeFeedbackModal();
    }
  });

  // Initialize directory page
  initializeDirectoryPage();

  // Hash-based routing: Read URL hash on page load
  const hash = window.location.hash.slice(1); // Remove '#' from hash
  if (hash === 'faq') {
    switchSection('faq');
  } else if (hash === 'directory') {
    switchSection('directory');
  }
  // If no hash or invalid hash, stay on default (directory) section

  // Listen for hash changes (back/forward button support)
  window.addEventListener('hashchange', () => {
    const newHash = window.location.hash.slice(1);
    if (newHash === 'directory' || newHash === 'faq') {
      switchSection(newHash);
    }
  });
});
