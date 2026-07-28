// John K. King Bookstore - Public Directory App
// Search Directory Functionality

// --- Constants ---
const DIRECTORY_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vS2iABeNRjSNn_F__Dcd4SAJWYwno0ajUk9tyRf9WmY240V28Q3jZMxW6NBpZWNtc0visIoj128Kc__/pub?gid=0&single=true&output=csv';
const FAQ_CSV_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vT_rXkbRD1rRq3Fb08uX5fboYgmbqWWKKNB9poXgu1Bv1wHklLmz67_PcEvcTpkBPKfyjq3VIYy32Rl/pub?output=csv';

// --- State Variables ---
let directoryData = [];
let directoryIndex = [];
let isDirectoryInitialized = false;

let faqData = [];
let faqFuse;
let isFaqInitialized = false;

let currentSection = 'directory';
let helpModalOpenedAt = null;

// --- DOM Elements (will be initialized after DOM loads) ---
let elements = {};

const SEARCH_LOG_URL = 'https://script.google.com/macros/s/AKfycbxXtKs2ESAO60892CKNKkSlQlRHz-C8QmmKDjfaXq9fy2GTvXp6fVzHywqg1Eg-Kq9P/exec';

// --- Helper Functions ---

function logSearchQuery(query, resultCount, source, stage) {
  fetch(SEARCH_LOG_URL, {
    method: 'POST',
    mode: 'no-cors',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, resultCount, source, stage })
  }).catch(() => {});
}

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
          <p class="search-tip">Tip: search just the general subject, without extra descriptive words. For example, instead of "rare comic books," try "comic books."</p>
          <p class="suggestion-text">Still no luck? Consider suggesting a subject area to add to the directory.</p>
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

// --- Directory Search Engine ---

function buildDirectoryIndex(rows) {
  return rows.map(row => ({
    row,
    kwPhrases: (row['KEYWORDS'] || '').split(',').map(s => s.trim()).filter(Boolean),
    subjWords: row['SUBJECT'].split(/\s+/).map(w => w.replace(/[^a-zA-Z0-9]/g, '')).filter(Boolean)
  }));
}

function levenshtein(a, b) {
  const m = a.length, n = b.length;
  const dp = Array.from({ length: m + 1 }, (_, i) => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1] ? dp[i-1][j-1] : 1 + Math.min(dp[i-1][j], dp[i][j-1], dp[i-1][j-1]);
  return dp[m][n];
}

// 1 edit allowed for phrases under 5 chars, 2 for longer
function editCap(len) { return len < 5 ? 1 : 2; }

function directorySearch(query) {
  if (!query || directoryIndex.length === 0) return { results: directoryData, stage: 'none' };

  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const wordBoundaryRe = new RegExp(`\\b${escaped}\\b`, 'i');
  const qLower = query.toLowerCase();

  // Stage 1: word-boundary match on SUBJECT, substring match on each KEYWORDS phrase unit.
  // Subject hits ranked above keyword hits; stop here if anything matches.
  const subjectHits = [], keywordHits = [];
  for (const { row, kwPhrases } of directoryIndex) {
    if (wordBoundaryRe.test(row['SUBJECT'])) {
      subjectHits.push(row);
    } else if (kwPhrases.some(p => p.toLowerCase().includes(qLower))) {
      keywordHits.push(row);
    }
  }

  const stage1 = [...subjectHits, ...keywordHits];
  if (stage1.length > 0) {
    const stage = subjectHits.length > 0 && keywordHits.length === 0 ? 'subject'
                : subjectHits.length === 0 ? 'keyword'
                : 'subject+keyword';
    return { results: stage1, stage };
  }

  // Stage 2: Levenshtein fallback — only runs when Stage 1 returns nothing.
  // Checks (a) full SUBJECT phrase, (b) individual words within SUBJECT (cap=1, tighter than
  // editCap, to avoid coincidental character matches like "histery"→"Mystery"), (c) KEYWORDS
  // phrase units. First match wins per entry.
  const fuzzyHits = [];
  for (const { row, kwPhrases, subjWords } of directoryIndex) {
    let matched = false;

    const subj = row['SUBJECT'];
    if (levenshtein(qLower, subj.toLowerCase()) <= editCap(subj.length)) {
      matched = true;
    }

    if (!matched) {
      for (const word of subjWords) {
        if (word.length > 0 && levenshtein(qLower, word.toLowerCase()) <= 1) {
          matched = true;
          break;
        }
      }
    }

    if (!matched) {
      for (const phrase of kwPhrases) {
        if (levenshtein(qLower, phrase.toLowerCase()) <= editCap(phrase.length)) {
          matched = true;
          break;
        }
      }
    }

    if (matched) fuzzyHits.push(row);
  }

  return { results: fuzzyHits, stage: fuzzyHits.length > 0 ? 'fuzzy' : 'no-match' };
}

/**
 * Perform directory search based on query and floor filter
 */
function performDirectorySearch(isFinalSearch = false) {
  const query = elements.searchBar.value.trim();
  const floor = elements.floorFilter.value;

  if (isFinalSearch && query) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: 'site_search',
      search_term: query,
      search_location: 'directory'
    });
  }

  let results = directoryData;
  let stage = 'none';

  if (query) {
    const searched = directorySearch(query);
    results = searched.results;
    stage = searched.stage;
  }

  if (floor) {
    results = results.filter(r => r['FLOOR'] === floor);
  }

  renderDirectoryTable(results, query);
  elements.rowCount.textContent = `Found ${results.length} of ${directoryData.length} entries.`;

  if (isFinalSearch && query) {
    logSearchQuery(query, results.length, 'directory', stage);
  }

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
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    directoryData = parseCSV(text);

    directoryIndex = buildDirectoryIndex(directoryData);

    populateFloorFilter();
    renderDirectoryTable(directoryData);
    elements.rowCount.textContent = `Showing all ${directoryData.length} entries.`;
  } catch (e) {
    console.error("Directory Init Error", e);
    if (elements.loadingMessage) elements.loadingMessage.style.display = 'none';
    elements.rowCount.textContent = '';
    isDirectoryInitialized = false;
    elements.resultsContainer.innerHTML = `
      <div class="no-results">
        <p>Unable to load directory data. Please check your connection and try again.</p>
        <button id="retry-directory" class="retry-btn">Retry</button>
      </div>`;
    document.getElementById('retry-directory').addEventListener('click', () => {
      elements.resultsContainer.innerHTML = '';
      if (elements.loadingMessage) elements.loadingMessage.style.display = '';
      initializeDirectoryPage();
    }, { once: true });
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
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const text = await response.text();
    faqData = parseCSV(text);

    // Initialize Fuse.js for weighted fuzzy search
    faqFuse = new Fuse(faqData, {
      keys: [
        { name: 'Question', weight: 0.6 },
        { name: 'Answer', weight: 0.3 },
        { name: 'Keywords', weight: 0.5 }
      ],
      threshold: 0.2,
      ignoreLocation: true,
      useExtendedSearch: true,
      findAllMatches: false,
      ignoreFieldNorm: true
    });

    renderFaqCards(faqData);
    elements.faqRowCount.textContent = `Showing all ${faqData.length} questions.`;
  } catch (e) {
    console.error("FAQ Init Error", e);
    if (elements.faqLoadingMessage) elements.faqLoadingMessage.style.display = 'none';
    elements.faqRowCount.textContent = '';
    isFaqInitialized = false;
    elements.faqResultsContainer.innerHTML = `
      <div class="no-results">
        <p>Unable to load FAQ data. Please check your connection and try again.</p>
        <button id="retry-faq" class="retry-btn">Retry</button>
      </div>`;
    document.getElementById('retry-faq').addEventListener('click', () => {
      elements.faqResultsContainer.innerHTML = '';
      if (elements.faqLoadingMessage) elements.faqLoadingMessage.style.display = '';
      initializeFaqPage();
    }, { once: true });
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
}

/**
 * Perform FAQ search
 * Adapted from old-app-code/public/index.html:1254-1275
 */
function performFaqSearch(isFinalSearch = false) {
  const query = elements.faqSearchBar.value.trim();

  if (isFinalSearch && query) {
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: 'site_search',
      search_term: query,
      search_location: 'faq'
    });
  }

  const results = (query && faqFuse) ? faqFuse.search(query).map(r => r.item) : faqData;
  renderFaqCards(results, query);
  elements.faqRowCount.textContent = `Found ${results.length} of ${faqData.length} questions.`;

  if (isFinalSearch && query) {
    logSearchQuery(query, results.length, 'faq');
  }

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
  const isActualSwitch = sectionName !== currentSection;

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

  // Log the switch as a real analytics event rather than relying on hash-based
  // routing to register as a pageview (GA4 history tracking is inconsistent for this).
  if (isActualSwitch) {
    currentSection = sectionName;
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: 'section_view',
      section_name: sectionName
    });
  }

  // Initialize section if needed
  if (sectionName === 'faq' && !isFaqInitialized) {
    initializeFaqPage();
  }
}

// --- Modal Functions ---

const INTRO_MODAL_STORAGE_KEY = 'jkk-directory-intro-last-seen';
const INTRO_MODAL_REPEAT_MS = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Open intro modal
 */
function openIntroModal() {
  elements.introModalOverlay.style.display = 'flex';
}

/**
 * Close intro modal
 */
function closeIntroModal() {
  elements.introModalOverlay.style.display = 'none';
}

/**
 * Show the intro modal automatically if the visitor hasn't seen it
 * in the last 24 hours
 */
function maybeShowIntroModal() {
  const lastSeen = Number(localStorage.getItem(INTRO_MODAL_STORAGE_KEY));
  if (lastSeen && Date.now() - lastSeen < INTRO_MODAL_REPEAT_MS) return;

  openIntroModal();
  localStorage.setItem(INTRO_MODAL_STORAGE_KEY, String(Date.now()));
}

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

/**
 * Open help modal
 */
function openHelpModal() {
  elements.helpModalOverlay.style.display = 'flex';
  helpModalOpenedAt = Date.now();
  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: 'help_modal_open' });
}

/**
 * Close help modal
 */
function closeHelpModal(closeMethod = 'button') {
  elements.helpModalOverlay.style.display = 'none';
  if (helpModalOpenedAt !== null) {
    const timeOpenSeconds = Math.round((Date.now() - helpModalOpenedAt) / 1000);
    window.dataLayer = window.dataLayer || [];
    window.dataLayer.push({
      event: 'help_modal_close',
      close_method: closeMethod,
      time_open_seconds: timeOpenSeconds
    });
    helpModalOpenedAt = null;
  }
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

    // Intro modal elements
    introModalOverlay: document.getElementById('intro-modal-overlay'),
    closeIntroModal: document.getElementById('close-intro-modal'),
    introModalOk: document.getElementById('intro-modal-ok'),

    // Modal elements
    feedbackBtn: document.getElementById('feedback-btn'),
    feedbackModalOverlay: document.getElementById('feedback-modal-overlay'),
    closeFeedbackModal: document.getElementById('close-feedback-modal'),

    // Help modal elements
    helpBtn: document.getElementById('help-btn'),
    helpModalOverlay: document.getElementById('help-modal-overlay'),
    closeHelpModal: document.getElementById('close-help-modal')
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

  // FAQ accordion - single delegated listener on the parent container
  elements.faqResultsContainer.addEventListener('click', (e) => {
    const card = e.target.closest('.faq-card');
    if (!card) return;
    card.querySelector('.faq-answer').classList.toggle('expanded');
    card.querySelector('.faq-toggle-icon').classList.toggle('rotated');
  });

  // Navigation Listeners
  elements.navButtons.forEach(btn => {
    btn.addEventListener('click', (event) => {
      const section = btn.dataset.section;
      if (section) {
        switchSection(section);
      } else {
        // If there's no data-section, it's likely an external link, so let default behavior happen
        // Prevent default only if it's not an external link, or handle it differently if needed.
        // For now, allow default for external links.
      }
    });
  });

  // Intro Modal Listeners
  elements.closeIntroModal.addEventListener('click', closeIntroModal);
  elements.introModalOk.addEventListener('click', closeIntroModal);
  elements.introModalOverlay.addEventListener('click', (e) => {
    if (e.target === elements.introModalOverlay) {
      closeIntroModal();
    }
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

  // Help Modal Listeners
  elements.helpBtn.addEventListener('click', openHelpModal);
  elements.closeHelpModal.addEventListener('click', () => closeHelpModal('button'));
  elements.helpModalOverlay.addEventListener('click', (e) => {
    if (e.target === elements.helpModalOverlay) {
      closeHelpModal('overlay');
    }
  });

  // Initialize directory page
  initializeDirectoryPage();

  // Show the intro modal for first-time (or 24h-lapsed) visitors
  maybeShowIntroModal();

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
