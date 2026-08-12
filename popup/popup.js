/**
 * NoPolitics - Popup Interaction Controller
 */

import { getSettings, saveSettings } from '../lib/storage.js';

document.addEventListener('DOMContentLoaded', async () => {
  let settings = await getSettings();

  // Elements
  const masterToggle = document.getElementById('masterToggle');
  const statusIndicator = document.getElementById('statusIndicator');
  const statusLabel = document.getElementById('statusLabel');

  const statToday = document.getElementById('statToday');
  const statTotal = document.getElementById('statTotal');
  const statTime = document.getElementById('statTime');

  const filterStyleButtons = document.querySelectorAll('#filterStyleControl .segment-btn');
  const strictnessButtons = document.querySelectorAll('#strictnessControl .segment-btn');
  const strictnessBadge = document.getElementById('strictnessBadge');

  const toggleTwitter = document.getElementById('toggleTwitter');
  const toggleInstagram = document.getElementById('toggleInstagram');

  const quickKeywordInput = document.getElementById('quickKeywordInput');
  const quickAddBtn = document.getElementById('quickAddBtn');
  const quickTags = document.getElementById('quickTags');

  const aiBadge = document.getElementById('aiBadge');
  const openSettingsBtn = document.getElementById('openSettingsBtn');
  const openPlaygroundBtn = document.getElementById('openPlaygroundBtn');

  // 1. Initial State Render
  function renderState() {
    // Master Switch
    const isEnabled = settings.isEnabled !== false;
    masterToggle.checked = isEnabled;
    if (isEnabled) {
      statusIndicator.classList.remove('paused');
      statusLabel.textContent = 'Shield Active';
    } else {
      statusIndicator.classList.add('paused');
      statusLabel.textContent = 'Shield Paused';
    }

    // Stats
    const stats = settings.stats || {};
    statToday.textContent = stats.todayFiltered || 0;
    statTotal.textContent = stats.totalFiltered || 0;
    statTime.textContent = `${stats.timeSavedMinutes || 0}m`;

    // Filter Style
    const activeStyle = settings.filterStyle || 'blur';
    filterStyleButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.style === activeStyle);
    });

    // Strictness
    const activeStrictness = settings.strictness || 'balanced';
    strictnessButtons.forEach(btn => {
      btn.classList.toggle('active', btn.dataset.strictness === activeStrictness);
    });
    strictnessBadge.textContent = activeStrictness.charAt(0).toUpperCase() + activeStrictness.slice(1);

    // Platforms
    toggleTwitter.checked = settings.enabledPlatforms?.twitter !== false;
    toggleInstagram.checked = settings.enabledPlatforms?.instagram !== false;

    // AI Status
    if (settings.aiBoosterEnabled && settings.geminiApiKey) {
      aiBadge.textContent = 'Active (Gemini 1.5)';
      aiBadge.classList.add('active');
    } else {
      aiBadge.textContent = 'Offline (Heuristic only)';
      aiBadge.classList.remove('active');
    }

    // Custom Keywords
    renderQuickTags();
  }

  function renderQuickTags() {
    quickTags.innerHTML = '';
    const keywords = settings.customKeywords || [];
    keywords.forEach((kw, index) => {
      const tag = document.createElement('div');
      tag.className = 'tag-item';
      tag.innerHTML = `
        <span>${escapeHtml(kw)}</span>
        <span class="tag-remove" data-index="${index}" title="Remove">&times;</span>
      `;
      quickTags.appendChild(tag);
    });
  }

  renderState();

  // 2. Event Listeners

  // Master Toggle
  masterToggle.addEventListener('change', async () => {
    settings.isEnabled = masterToggle.checked;
    await persistAndBroadcast();
    renderState();
  });

  // Filter Style
  filterStyleButtons.forEach(btn => {
    btn.addEventListener('click', async () => {
      settings.filterStyle = btn.dataset.style;
      await persistAndBroadcast();
      renderState();
    });
  });

  // Strictness
  strictnessButtons.forEach(btn => {
    btn.addEventListener('click', async () => {
      settings.strictness = btn.dataset.strictness;
      await persistAndBroadcast();
      renderState();
    });
  });

  // Platforms
  toggleTwitter.addEventListener('change', async () => {
    if (!settings.enabledPlatforms) settings.enabledPlatforms = {};
    settings.enabledPlatforms.twitter = toggleTwitter.checked;
    await persistAndBroadcast();
  });

  toggleInstagram.addEventListener('change', async () => {
    if (!settings.enabledPlatforms) settings.enabledPlatforms = {};
    settings.enabledPlatforms.instagram = toggleInstagram.checked;
    await persistAndBroadcast();
  });

  // Add Custom Keyword
  async function addCustomKeyword() {
    const val = quickKeywordInput.value.trim().toLowerCase();
    if (!val) return;

    if (!settings.customKeywords) settings.customKeywords = [];
    if (!settings.customKeywords.includes(val)) {
      settings.customKeywords.push(val);
      await persistAndBroadcast();
      renderQuickTags();
    }
    quickKeywordInput.value = '';
  }

  quickAddBtn.addEventListener('click', addCustomKeyword);
  quickKeywordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addCustomKeyword();
  });

  // Remove Custom Keyword
  quickTags.addEventListener('click', async (e) => {
    const removeBtn = e.target.closest('.tag-remove');
    if (!removeBtn) return;
    const index = parseInt(removeBtn.dataset.index, 10);
    if (!isNaN(index) && settings.customKeywords) {
      settings.customKeywords.splice(index, 1);
      await persistAndBroadcast();
      renderQuickTags();
    }
  });

  // Open Options / Dashboard
  openSettingsBtn.addEventListener('click', () => {
    if (chrome.runtime.openOptionsPage) {
      chrome.runtime.openOptionsPage();
    } else {
      window.open(chrome.runtime.getURL('options/options.html'));
    }
  });

  // Open Playground
  openPlaygroundBtn.addEventListener('click', () => {
    chrome.tabs.create({ url: chrome.runtime.getURL('playground/index.html') });
  });

  // Persist settings and notify open tabs
  async function persistAndBroadcast() {
    await saveSettings(settings);
    if (chrome.tabs && chrome.tabs.query) {
      chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs && tabs[0]) {
          chrome.tabs.sendMessage(tabs[0].id, {
            type: 'SETTINGS_UPDATED',
            settings
          }).catch(() => {});
        }
      });
    }
  }

  function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g, (m) => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[m]));
  }
});
