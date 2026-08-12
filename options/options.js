/**
 * NoPolitics - Options & Control Center Controller
 */

import { getSettings, saveSettings } from '../lib/storage.js';
import { classifyPostText } from '../lib/classifier.js';

document.addEventListener('DOMContentLoaded', async () => {
  let settings = await getSettings();

  // Navigation
  const navItems = document.querySelectorAll('.nav-item');
  const tabPanels = document.querySelectorAll('.tab-panel');
  const pageTitle = document.getElementById('pageTitle');
  const pageDesc = document.getElementById('pageDesc');
  const toast = document.getElementById('toast');
  const saveAllBtn = document.getElementById('saveAllBtn');

  const TAB_METADATA = {
    regions: {
      title: 'Regional Filters',
      desc: 'Select which geographic regions and political scenes you want to filter out.'
    },
    rules: {
      title: 'Custom Rules & Words',
      desc: 'Manage your custom blocked keywords and safe whitelist exceptions.'
    },
    ai: {
      title: 'Gemini AI Engine',
      desc: 'Configure Google Gemini 1.5 Flash for high-precision nuance detection.'
    },
    appearance: {
      title: 'Appearance & Sensitivity',
      desc: 'Customize the visual presentation of filtered posts and algorithm strictness.'
    },
    analytics: {
      title: 'Analytics & Data',
      desc: 'Review filtered post counts, time saved, and export or import your settings.'
    },
    testsuite: {
      title: 'Live Playground Simulator',
      desc: 'Test any social media post against your active rules and preview the feed UI.'
    }
  };

  // Switch Tabs
  navItems.forEach(btn => {
    btn.addEventListener('click', () => {
      const tabId = btn.dataset.tab;
      navItems.forEach(i => i.classList.remove('active'));
      tabPanels.forEach(p => p.classList.remove('active'));

      btn.classList.add('active');
      document.getElementById(`tab-${tabId}`).classList.add('active');

      if (TAB_METADATA[tabId]) {
        pageTitle.textContent = TAB_METADATA[tabId].title;
        pageDesc.textContent = TAB_METADATA[tabId].desc;
      }
    });
  });

  // 1. Regions Tab
  const regionUS = document.getElementById('region-us');
  const regionIndia = document.getElementById('region-india');
  const regionUKEU = document.getElementById('region-uk_eu_global');
  const regionGeneral = document.getElementById('region-general');

  function loadRegions() {
    const reg = settings.enabledRegions || {};
    regionUS.checked = reg.us !== false;
    regionIndia.checked = reg.india !== false;
    regionUKEU.checked = reg.uk_eu_global !== false;
    regionGeneral.checked = reg.general !== false;
  }

  // 2. Custom Rules Tab
  const addBlockInput = document.getElementById('addBlockInput');
  const addBlockBtn = document.getElementById('addBlockBtn');
  const blockListContainer = document.getElementById('blockListContainer');

  const addWhiteInput = document.getElementById('addWhiteInput');
  const addWhiteBtn = document.getElementById('addWhiteBtn');
  const whiteListContainer = document.getElementById('whiteListContainer');

  function renderRules() {
    // Blocklist
    blockListContainer.innerHTML = '';
    const blockList = settings.customKeywords || [];
    if (blockList.length === 0) {
      blockListContainer.innerHTML = '<span style="color: #64748b; font-size: 12px;">No custom blocked keywords yet.</span>';
    } else {
      blockList.forEach((kw, index) => {
        const bubble = document.createElement('div');
        bubble.className = 'tag-bubble';
        bubble.innerHTML = `
          <span>${escapeHtml(kw)}</span>
          <span class="btn-del" data-type="block" data-index="${index}">&times;</span>
        `;
        blockListContainer.appendChild(bubble);
      });
    }

    // Whitelist
    whiteListContainer.innerHTML = '';
    const whiteList = settings.customWhitelist || [];
    if (whiteList.length === 0) {
      whiteListContainer.innerHTML = '<span style="color: #64748b; font-size: 12px;">No custom whitelisted terms yet.</span>';
    } else {
      whiteList.forEach((kw, index) => {
        const bubble = document.createElement('div');
        bubble.className = 'tag-bubble white';
        bubble.innerHTML = `
          <span>${escapeHtml(kw)}</span>
          <span class="btn-del" data-type="white" data-index="${index}">&times;</span>
        `;
        whiteListContainer.appendChild(bubble);
      });
    }
  }

  addBlockBtn.addEventListener('click', () => {
    const val = addBlockInput.value.trim().toLowerCase();
    if (!val) return;
    if (!settings.customKeywords) settings.customKeywords = [];
    if (!settings.customKeywords.includes(val)) {
      settings.customKeywords.push(val);
      renderRules();
    }
    addBlockInput.value = '';
  });

  addBlockInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addBlockBtn.click();
  });

  addWhiteBtn.addEventListener('click', () => {
    const val = addWhiteInput.value.trim().toLowerCase();
    if (!val) return;
    if (!settings.customWhitelist) settings.customWhitelist = [];
    if (!settings.customWhitelist.includes(val)) {
      settings.customWhitelist.push(val);
      renderRules();
    }
    addWhiteInput.value = '';
  });

  addWhiteInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addWhiteBtn.click();
  });

  // Remove Tag
  document.addEventListener('click', (e) => {
    const delBtn = e.target.closest('.btn-del');
    if (!delBtn) return;
    const type = delBtn.dataset.type;
    const idx = parseInt(delBtn.dataset.index, 10);

    if (type === 'block' && settings.customKeywords) {
      settings.customKeywords.splice(idx, 1);
      renderRules();
    } else if (type === 'white' && settings.customWhitelist) {
      settings.customWhitelist.splice(idx, 1);
      renderRules();
    }
  });

  // 3. AI Booster Tab
  const aiBoosterToggle = document.getElementById('aiBoosterToggle');
  const geminiApiKey = document.getElementById('geminiApiKey');
  const testApiKeyBtn = document.getElementById('testApiKeyBtn');
  const aiTestResult = document.getElementById('aiTestResult');

  function loadAiSettings() {
    aiBoosterToggle.checked = Boolean(settings.aiBoosterEnabled);
    geminiApiKey.value = settings.geminiApiKey || '';
  }

  testApiKeyBtn.addEventListener('click', async () => {
    const key = geminiApiKey.value.trim();
    if (!key) {
      showAiTestResult('Please enter an API key first.', false);
      return;
    }

    testApiKeyBtn.disabled = true;
    testApiKeyBtn.textContent = 'Testing...';

    try {
      if (typeof chrome !== 'undefined' && chrome.runtime && chrome.runtime.sendMessage) {
        chrome.runtime.sendMessage({ type: 'TEST_GEMINI_KEY', apiKey: key }, (res) => {
          testApiKeyBtn.disabled = false;
          testApiKeyBtn.textContent = 'Test Key';
          if (res && res.success) {
            showAiTestResult(res.message, true);
          } else {
            showAiTestResult(res?.error || 'Failed to authenticate with Gemini API.', false);
          }
        });
      } else {
        // Direct test in sandbox / playground
        const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`;
        const resp = await fetch(endpoint, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: 'Ping' }] }] })
        });
        testApiKeyBtn.disabled = false;
        testApiKeyBtn.textContent = 'Test Key';
        if (resp.ok) {
          showAiTestResult('API key is valid and connected to Gemini!', true);
        } else {
          showAiTestResult(`API returned status ${resp.status}`, false);
        }
      }
    } catch (err) {
      testApiKeyBtn.disabled = false;
      testApiKeyBtn.textContent = 'Test Key';
      showAiTestResult(err.message, false);
    }
  });

  function showAiTestResult(msg, isSuccess) {
    aiTestResult.textContent = msg;
    aiTestResult.className = `ai-test-result ${isSuccess ? 'success' : 'error'}`;
  }

  // 4. Appearance & Strictness Tab
  function loadAppearance() {
    const styleRadios = document.querySelectorAll('input[name="displayMode"]');
    const strictRadios = document.querySelectorAll('input[name="optStrictness"]');

    styleRadios.forEach(r => {
      r.checked = r.value === (settings.filterStyle || 'blur');
    });

    strictRadios.forEach(r => {
      r.checked = r.value === (settings.strictness || 'balanced');
    });
  }

  // 5. Analytics Tab
  const metricToday = document.getElementById('metricToday');
  const metricTotal = document.getElementById('metricTotal');
  const metricMinutes = document.getElementById('metricMinutes');
  const resetStatsBtn = document.getElementById('resetStatsBtn');
  const exportSettingsBtn = document.getElementById('exportSettingsBtn');
  const importSettingsBtn = document.getElementById('importSettingsBtn');
  const importFileInput = document.getElementById('importFileInput');

  function renderAnalytics() {
    const stats = settings.stats || {};
    metricToday.textContent = stats.todayFiltered || 0;
    metricTotal.textContent = stats.totalFiltered || 0;
    metricMinutes.textContent = stats.timeSavedMinutes || 0;
  }

  resetStatsBtn.addEventListener('click', async () => {
    if (confirm('Are you sure you want to reset all filtered post statistics?')) {
      settings.stats = {
        totalScanned: 0,
        totalFiltered: 0,
        todayFiltered: 0,
        lastDate: new Date().toISOString().split('T')[0],
        timeSavedMinutes: 0
      };
      await saveSettings(settings);
      renderAnalytics();
      showToast('Statistics reset successfully');
    }
  });

  exportSettingsBtn.addEventListener('click', () => {
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(settings, null, 2));
    const downloadAnchor = document.createElement('a');
    downloadAnchor.setAttribute("href", dataStr);
    downloadAnchor.setAttribute("download", `nopolitics_settings_${new Date().toISOString().slice(0, 10)}.json`);
    document.body.appendChild(downloadAnchor);
    downloadAnchor.click();
    downloadAnchor.remove();
  });

  importSettingsBtn.addEventListener('click', () => {
    importFileInput.click();
  });

  importFileInput.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const imported = JSON.parse(event.target.result);
        settings = { ...settings, ...imported };
        await saveSettings(settings);
        loadAll();
        showToast('Settings imported successfully!');
      } catch (err) {
        alert('Invalid JSON configuration file.');
      }
    };
    reader.readAsText(file);
  });

  // 6. Live Playground Tab
  const playgroundInput = document.getElementById('playgroundInput');
  const runPlaygroundAnalysisBtn = document.getElementById('runPlaygroundAnalysisBtn');
  const loadSamplePostBtn = document.getElementById('loadSamplePostBtn');
  const playgroundVerdict = document.getElementById('playgroundVerdict');
  const scoreBreakdown = document.getElementById('scoreBreakdown');
  const simulatedFeedContainer = document.getElementById('simulatedFeedContainer');

  const SAMPLE_POSTS = [
    "Breaking: President signs new executive order regarding border security and voting regulations ahead of the upcoming election.",
    "Prime Minister Narendra Modi addressed a massive rally in Varanasi today discussing the NDA government's new policies for farmers.",
    "Just finished playing the Call of Duty campaign mode on veteran difficulty! The graphics on the PS5 are mind-blowing.",
    "The parliamentary debate on the new national budget bill was intense today between Labour and the Tories.",
    "Can't believe how good this new coffee shop is down the street. Perfect morning vibes with a warm latte!"
  ];
  let sampleIndex = 0;

  loadSamplePostBtn.addEventListener('click', () => {
    playgroundInput.value = SAMPLE_POSTS[sampleIndex % SAMPLE_POSTS.length];
    sampleIndex++;
    runAnalysis();
  });

  runPlaygroundAnalysisBtn.addEventListener('click', runAnalysis);

  function runAnalysis() {
    const text = playgroundInput.value.trim();
    if (!text) {
      playgroundVerdict.className = 'verdict-banner';
      playgroundVerdict.textContent = 'Please paste post text to analyze.';
      scoreBreakdown.innerHTML = '';
      simulatedFeedContainer.innerHTML = '';
      return;
    }

    // Prepare current settings snapshot
    const activeStrictness = document.querySelector('input[name="optStrictness"]:checked')?.value || 'balanced';
    const activeStyle = document.querySelector('input[name="displayMode"]:checked')?.value || 'blur';

    const testConfig = {
      ...settings,
      strictness: activeStrictness,
      enabledRegions: {
        us: regionUS.checked,
        india: regionIndia.checked,
        uk_eu_global: regionUKEU.checked,
        general: regionGeneral.checked
      }
    };

    const res = classifyPostText(text, testConfig);

    // Update Verdict
    if (res.isPolitical) {
      playgroundVerdict.className = 'verdict-banner political';
      playgroundVerdict.innerHTML = `🛡️ <strong>Political Content Detected</strong> (Score: ${(res.score * 100).toFixed(0)}% | Threshold: ${(res.threshold * 100).toFixed(0)}%)`;
    } else {
      playgroundVerdict.className = 'verdict-banner clean';
      playgroundVerdict.innerHTML = `✅ <strong>Clean / Non-Political Post</strong> (Score: ${(res.score * 100).toFixed(0)}% | Threshold: ${(res.threshold * 100).toFixed(0)}%)`;
    }

    // Breakdown details
    let matchHtml = '';
    if (res.matches && res.matches.length > 0) {
      matchHtml = res.matches.map(m => `<code>"${escapeHtml(m.keyword)}" (${m.category}, wt: ${m.weight})</code>`).join(', ');
    } else {
      matchHtml = '<em>No political keywords or entities detected.</em>';
    }

    scoreBreakdown.innerHTML = `
      <div><strong>Matched Indicators:</strong> ${matchHtml}</div>
      <div style="margin-top: 4px;"><strong>AI Tier 2 Candidate:</strong> ${res.needsAiVerification ? 'Yes (borderline score)' : 'No (definitive heuristic result)'}</div>
    `;

    // Render Simulated Feed Appearance
    renderSimulatedFeed(text, res, activeStyle);
  }

  function renderSimulatedFeed(text, res, style) {
    simulatedFeedContainer.innerHTML = '';

    const postCard = document.createElement('div');
    postCard.style.cssText = `
      background: #0f172a;
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 12px;
      padding: 16px;
      position: relative;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
    `;

    const authorHeader = `
      <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 10px;">
        <div style="width: 36px; height: 36px; border-radius: 50%; background: #3b82f6; display: flex; align-items: center; justify-content: center; font-weight: 700; color: white;">U</div>
        <div>
          <div style="font-weight: 700; color: #ffffff; font-size: 14px;">User Feed Post <span style="color: #64748b; font-weight: 400;">@username</span></div>
          <div style="color: #64748b; font-size: 12px;">2 hours ago</div>
        </div>
      </div>
    `;

    if (!res.isPolitical) {
      postCard.innerHTML = `
        ${authorHeader}
        <div style="color: #e2e8f0; font-size: 14px; line-height: 1.5;">${escapeHtml(text)}</div>
      `;
    } else {
      if (style === 'ghost') {
        postCard.innerHTML = `
          <div style="text-align: center; color: #64748b; font-style: italic; padding: 20px;">
            [ Ghost Mode: Post is completely hidden from feed without trace ]
          </div>
        `;
      } else if (style === 'pill') {
        postCard.innerHTML = `
          <div style="display: flex; align-items: center; justify-content: space-between; background: rgba(30, 41, 59, 0.8); border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 8px; padding: 10px 14px;">
            <div style="display: flex; align-items: center; gap: 8px; font-size: 13px; color: #cbd5e1;">
              <span>🛡️</span>
              <span><strong>Political post hidden</strong> (Matches: <em>${escapeHtml(res.matches[0]?.keyword || 'politics')}</em>)</span>
            </div>
            <button style="background: rgba(99, 102, 241, 0.2); border: 1px solid rgba(99, 102, 241, 0.4); color: #c7d2fe; padding: 4px 10px; border-radius: 6px; cursor: pointer; font-size: 12px;">Show Post</button>
          </div>
        `;
      } else {
        // Blur
        postCard.innerHTML = `
          <div style="filter: blur(12px) opacity(0.3); user-select: none;">
            ${authorHeader}
            <div style="color: #e2e8f0; font-size: 14px; line-height: 1.5;">${escapeHtml(text)}</div>
          </div>
          <div style="position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; background: rgba(15, 23, 42, 0.65);">
            <div style="background: #1e293b; border: 1px solid rgba(99, 102, 241, 0.4); border-radius: 12px; padding: 12px 18px; text-align: center; box-shadow: 0 4px 20px rgba(0,0,0,0.5);">
              <div style="font-weight: 700; color: #ffffff; font-size: 13px; margin-bottom: 4px;">🛡️ Political Content Filtered</div>
              <div style="color: #94a3b8; font-size: 11px; margin-bottom: 10px;">Filtered by NoPolitics (${(res.score * 100).toFixed(0)}% match)</div>
              <button style="background: #6366f1; border: none; color: white; padding: 5px 12px; border-radius: 6px; font-size: 11px; font-weight: 600; cursor: pointer;">👁️ Show Post</button>
            </div>
          </div>
        `;
      }
    }

    simulatedFeedContainer.appendChild(postCard);
  }

  // 7. Save All Changes
  saveAllBtn.addEventListener('click', async () => {
    // Collect regions
    settings.enabledRegions = {
      us: regionUS.checked,
      india: regionIndia.checked,
      uk_eu_global: regionUKEU.checked,
      general: regionGeneral.checked
    };

    // Collect AI
    settings.aiBoosterEnabled = aiBoosterToggle.checked;
    settings.geminiApiKey = geminiApiKey.value.trim();

    // Collect Appearance
    const checkedMode = document.querySelector('input[name="displayMode"]:checked');
    if (checkedMode) settings.filterStyle = checkedMode.value;

    const checkedStrict = document.querySelector('input[name="optStrictness"]:checked');
    if (checkedStrict) settings.strictness = checkedStrict.value;

    await saveSettings(settings);
    showToast('All settings saved successfully!');
  });

  function showToast(msg) {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => {
      toast.classList.remove('show');
    }, 2500);
  }

  function loadAll() {
    loadRegions();
    renderRules();
    loadAiSettings();
    loadAppearance();
    renderAnalytics();
  }

  loadAll();

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
