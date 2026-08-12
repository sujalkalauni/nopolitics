/**
 * NoPolitics - Social Media Feed Content Script
 * Supports Twitter / X and Instagram
 */

(async function () {
  'use strict';

  // Prevent multiple initializations in the same frame
  if (window.__nopolitics_injected) return;
  window.__nopolitics_injected = true;

  let currentSettings = null;
  let isTwitter = false;
  let isInstagram = false;
  let classifyPostTextFn = null;
  let hashTextFn = null;

  // Processed elements cache to prevent duplicate scans
  const processedNodes = new WeakSet();
  const revealedPosts = new Set(); // posts user clicked to reveal in this session

  // 1. Identify active platform
  const hostname = window.location.hostname;
  isTwitter = hostname.includes('twitter.com') || hostname.includes('x.com');
  isInstagram = hostname.includes('instagram.com');

  if (!isTwitter && !isInstagram) {
    return; // Not a target social platform
  }

  // 2. Load modules dynamically
  try {
    const classifierModuleUrl = chrome.runtime.getURL('lib/classifier.js');
    const { classifyPostText, hashText } = await import(classifierModuleUrl);
    classifyPostTextFn = classifyPostText;
    hashTextFn = hashText;
  } catch (err) {
    console.error('[NoPolitics] Error loading classifier module:', err);
    return;
  }

  // 3. Load settings from storage
  async function loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get(null, (items) => {
        currentSettings = items || {};
        resolve(currentSettings);
      });
    });
  }

  await loadSettings();

  // Listen for settings changes from popup or background
  chrome.storage.onChanged.addListener((changes, area) => {
    if (area === 'local') {
      for (const key in changes) {
        if (!currentSettings) currentSettings = {};
        currentSettings[key] = changes[key].newValue;
      }
      // Re-evaluate feed on settings change
      reapplyFiltersToFeed();
    }
  });

  // Listen for direct messages from popup
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type === 'SETTINGS_UPDATED') {
      currentSettings = message.settings;
      reapplyFiltersToFeed();
      sendResponse({ status: 'ok' });
    }
  });

  // 4. Platform-specific Selectors & Text Extraction
  function getPostElements() {
    if (isTwitter) {
      // Twitter / X tweet articles
      return Array.from(document.querySelectorAll('article[data-testid="tweet"]'));
    } else if (isInstagram) {
      // Instagram feed articles and post containers
      const articles = Array.from(document.querySelectorAll('article'));
      if (articles.length > 0) return articles;
      // Fallback for Instagram reels/dialog feed
      return Array.from(document.querySelectorAll('main div[role="presentation"] > div, div[role="dialog"] article'));
    }
    return [];
  }

  function extractTextFromPost(element) {
    if (isTwitter) {
      const tweetTextEl = element.querySelector('div[data-testid="tweetText"]');
      const authorEl = element.querySelector('div[data-testid="User-Name"]');
      const quotedTweet = element.querySelector('div[role="link"] div[data-testid="tweetText"]');

      const parts = [];
      if (authorEl) parts.push(authorEl.innerText);
      if (tweetTextEl) parts.push(tweetTextEl.innerText);
      if (quotedTweet) parts.push(quotedTweet.innerText);

      return parts.join(' \n ');
    } else if (isInstagram) {
      // Instagram caption spans, headers, and hashtags
      const captions = Array.from(element.querySelectorAll('span._ap3a, h1, h2, ul li span'));
      const textParts = captions.map(el => el.innerText.trim()).filter(Boolean);

      // Collect any visible hashtag links
      const tags = Array.from(element.querySelectorAll('a[href*="/explore/tags/"]'))
        .map(a => a.innerText.trim());

      return [...textParts, ...tags].join(' \n ');
    }
    return element.innerText || '';
  }

  // 5. Main Processing Routine
  function processPost(postEl) {
    if (!currentSettings || currentSettings.isEnabled === false) {
      unfilterPost(postEl);
      return;
    }

    // Check platform specific toggle
    if (isTwitter && currentSettings.enabledPlatforms?.twitter === false) {
      unfilterPost(postEl);
      return;
    }
    if (isInstagram && currentSettings.enabledPlatforms?.instagram === false) {
      unfilterPost(postEl);
      return;
    }

    if (processedNodes.has(postEl) && postEl.dataset.nopoliticsFiltered) {
      return; // Already filtered
    }

    const text = extractTextFromPost(postEl);
    if (!text || text.length < 5) return;

    processedNodes.add(postEl);

    // Run Tier 1 Classifier
    const result = classifyPostTextFn(text, currentSettings);

    if (result.isPolitical) {
      applyFilter(postEl, result, text);
      // Report filtered stat to background
      chrome.runtime.sendMessage({ type: 'INCREMENT_FILTERED' }).catch(() => {});

      // Tier 2 AI check if borderline and enabled
      if (result.needsAiVerification && currentSettings.aiBoosterEnabled && currentSettings.geminiApiKey) {
        checkAiVerification(postEl, text);
      }
    } else {
      postEl.dataset.nopoliticsFiltered = 'false';
    }
  }

  // 6. Visual Filter Application (Blur, Pill, Ghost)
  function applyFilter(postEl, result, text) {
    postEl.dataset.nopoliticsFiltered = 'true';
    const filterStyle = currentSettings.filterStyle || 'blur';

    // If already revealed by user this session, don't re-blur
    const postId = getPostId(postEl, text);
    if (revealedPosts.has(postId)) {
      postEl.classList.add('nopolitics-revealed');
      return;
    }

    // Clean up any previous wrappers/pill
    removeExistingOverlays(postEl);

    if (filterStyle === 'ghost') {
      postEl.classList.add('nopolitics-ghost');
      return;
    }

    if (filterStyle === 'pill') {
      renderPillBanner(postEl, result, postId);
      return;
    }

    // Default: 'blur' overlay
    renderBlurOverlay(postEl, result, postId);
  }

  function renderBlurOverlay(postEl, result, postId) {
    postEl.classList.add('nopolitics-blurred-container');

    // Wrap children in a blurred wrapper if not already wrapped
    let contentWrapper = postEl.querySelector(':scope > .nopolitics-blurred-content');
    if (!contentWrapper) {
      contentWrapper = document.createElement('div');
      contentWrapper.className = 'nopolitics-blurred-content';
      while (postEl.firstChild) {
        contentWrapper.appendChild(postEl.firstChild);
      }
      postEl.appendChild(contentWrapper);
    }

    // Create modern overlay card
    const overlay = document.createElement('div');
    overlay.className = 'nopolitics-overlay';

    const topKeywords = result.matches.slice(0, 3).map(m => m.keyword);
    const keywordsHtml = topKeywords.length > 0
      ? topKeywords.map(k => `<span class="nopolitics-keyword-tag">#${escapeHtml(k)}</span>`).join(' ')
      : '<span class="nopolitics-keyword-tag">Political Debate</span>';

    overlay.innerHTML = `
      <div class="nopolitics-overlay-card">
        <div class="nopolitics-badge-header">
          <svg viewBox="0 0 24 24">
            <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 10.99h7c-.53 4.12-3.28 7.79-7 8.94V12H5V6.3l7-3.11v8.8z"/>
          </svg>
          <span>Political Content Filtered</span>
        </div>
        <div class="nopolitics-reason">
          Filtered by NoPolitics (${Math.round((result.score || 0.8) * 100)}% match)
          <div style="margin-top: 4px;">${keywordsHtml}</div>
        </div>
        <div class="nopolitics-btn-group">
          <button class="nopolitics-reveal-btn" data-action="reveal">👁️ Show Post</button>
          <button class="nopolitics-whitelist-btn" data-action="whitelist">Whitelist Word</button>
        </div>
      </div>
    `;

    // Handle Reveal click
    overlay.querySelector('[data-action="reveal"]').addEventListener('click', (e) => {
      e.stopPropagation();
      revealedPosts.add(postId);
      postEl.classList.add('nopolitics-revealed');

      // Add a small re-hide bar at the top of revealed tweet
      injectRehideBar(postEl, postId);
    });

    // Handle Whitelist click
    overlay.querySelector('[data-action="whitelist"]').addEventListener('click', (e) => {
      e.stopPropagation();
      const firstKw = topKeywords[0] || 'politics';
      const term = prompt(`Whitelist keyword to stop filtering similar posts:\n(e.g., "${firstKw}")`, firstKw);
      if (term && term.trim()) {
        chrome.runtime.sendMessage({
          type: 'ADD_WHITELIST_KEYWORD',
          keyword: term.trim()
        });
        revealedPosts.add(postId);
        postEl.classList.add('nopolitics-revealed');
      }
    });

    postEl.appendChild(overlay);
  }

  function renderPillBanner(postEl, result, postId) {
    postEl.style.display = 'none'; // hide original post

    const pill = document.createElement('div');
    pill.className = 'nopolitics-pill-banner';

    const firstKw = result.matches[0]?.keyword || 'politics';
    pill.innerHTML = `
      <div class="nopolitics-pill-left">
        <span class="nopolitics-pill-icon">🛡️</span>
        <span><strong>Political post hidden</strong> (Matches: <em>${escapeHtml(firstKw)}</em>)</span>
      </div>
      <button class="nopolitics-pill-btn">Show Post</button>
    `;

    pill.querySelector('button').addEventListener('click', () => {
      revealedPosts.add(postId);
      postEl.style.display = '';
      pill.remove();
    });

    postEl.parentNode.insertBefore(pill, postEl);
  }

  function injectRehideBar(postEl, postId) {
    const existing = postEl.querySelector('.nopolitics-rehide-bar');
    if (existing) return;

    const bar = document.createElement('div');
    bar.className = 'nopolitics-rehide-bar';
    bar.innerHTML = `
      <span>🛡️ Post revealed from NoPolitics filter</span>
      <button class="nopolitics-rehide-btn">Re-hide</button>
    `;

    bar.querySelector('button').addEventListener('click', (e) => {
      e.stopPropagation();
      revealedPosts.delete(postId);
      postEl.classList.remove('nopolitics-revealed');
      bar.remove();
    });

    postEl.insertBefore(bar, postEl.firstChild);
  }

  function removeExistingOverlays(postEl) {
    postEl.classList.remove('nopolitics-blurred-container', 'nopolitics-revealed', 'nopolitics-ghost');
    const overlay = postEl.querySelector('.nopolitics-overlay');
    if (overlay) overlay.remove();
    const pill = postEl.previousElementSibling;
    if (pill && pill.classList.contains('nopolitics-pill-banner')) {
      pill.remove();
    }
  }

  function unfilterPost(postEl) {
    removeExistingOverlays(postEl);
    postEl.style.display = '';
    const contentWrapper = postEl.querySelector(':scope > .nopolitics-blurred-content');
    if (contentWrapper) {
      while (contentWrapper.firstChild) {
        postEl.insertBefore(contentWrapper.firstChild, contentWrapper);
      }
      contentWrapper.remove();
    }
    delete postEl.dataset.nopoliticsFiltered;
  }

  function reapplyFiltersToFeed() {
    const posts = getPostElements();
    posts.forEach((postEl) => {
      unfilterPost(postEl);
      processedNodes.delete(postEl);
      processPost(postEl);
    });
  }

  function getPostId(postEl, text) {
    if (hashTextFn) {
      return hashTextFn(text.slice(0, 80));
    }
    return String(text.length);
  }

  // Tier 2 AI Background Verification
  function checkAiVerification(postEl, text) {
    chrome.runtime.sendMessage({
      type: 'VERIFY_WITH_AI',
      text: text
    }, (response) => {
      if (response && response.success && response.result) {
        if (!response.result.isPolitical) {
          // AI concluded the post was innocent/safe! Smoothly unfilter
          unfilterPost(postEl);
        }
      }
    });
  }

  // 7. High-Performance Throttled MutationObserver
  let isScanning = false;
  let scanTimeout = null;

  function scheduleScan() {
    if (scanTimeout) clearTimeout(scanTimeout);
    scanTimeout = setTimeout(() => {
      if (isScanning) return;
      isScanning = true;
      requestAnimationFrame(() => {
        const posts = getPostElements();
        for (let i = 0; i < posts.length; i++) {
          processPost(posts[i]);
        }
        isScanning = false;
      });
    }, 120);
  }

  // Observe dynamically loaded tweets & posts
  const observer = new MutationObserver((mutations) => {
    let hasRelevantNodes = false;
    for (let i = 0; i < mutations.length; i++) {
      if (mutations[i].addedNodes.length > 0) {
        hasRelevantNodes = true;
        break;
      }
    }
    if (hasRelevantNodes) {
      scheduleScan();
    }
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });

  // Initial scan on load
  scheduleScan();

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (m) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[m]));
  }

  console.log('[NoPolitics] Active and shielding your feed from political clutter.');
})();
