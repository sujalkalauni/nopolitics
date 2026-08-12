/**
 * NoPolitics - Background Service Worker
 * Handles badge counters, AI dispatch, caching, and state synchronization.
 */

import { DEFAULT_SETTINGS, getSettings, saveSettings, incrementFilteredStats } from '../lib/storage.js';
import { classifyWithGemini, hashText } from '../lib/classifier.js';

// Cache for AI responses to avoid duplicate API calls and reduce latency to 0ms
const aiMemoryCache = new Map();

// Initialize settings on install
chrome.runtime.onInstalled.addListener(async (details) => {
  const current = await getSettings();
  if (details.reason === 'install') {
    await saveSettings({ ...DEFAULT_SETTINGS, ...current });
    console.log('[NoPolitics] Extension installed with default settings.');
  }

  // Set initial badge
  updateBadge(current?.stats?.todayFiltered || 0);
});

// Update badge icon with today's filtered count
function updateBadge(count) {
  if (!chrome.action) return;
  if (count > 0) {
    chrome.action.setBadgeText({ text: count > 99 ? '99+' : String(count) });
    chrome.action.setBadgeBackgroundColor({ color: '#6366f1' }); // Indigo glow
  } else {
    chrome.action.setBadgeText({ text: '' });
  }
}

// Handle messages from content script or popup
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (!message || !message.type) return;

  switch (message.type) {
    case 'INCREMENT_FILTERED': {
      incrementFilteredStats(1).then((stats) => {
        updateBadge(stats.todayFiltered);
        sendResponse({ success: true, stats });
      });
      return true; // async sendResponse
    }

    case 'ADD_WHITELIST_KEYWORD': {
      getSettings().then(async (settings) => {
        const list = settings.customWhitelist || [];
        const clean = message.keyword.trim().toLowerCase();
        if (clean && !list.includes(clean)) {
          list.push(clean);
          await saveSettings({ customWhitelist: list });
        }
        sendResponse({ success: true, customWhitelist: list });
      });
      return true;
    }

    case 'ADD_CUSTOM_KEYWORD': {
      getSettings().then(async (settings) => {
        const list = settings.customKeywords || [];
        const clean = message.keyword.trim().toLowerCase();
        if (clean && !list.includes(clean)) {
          list.push(clean);
          await saveSettings({ customKeywords: list });
        }
        sendResponse({ success: true, customKeywords: list });
      });
      return true;
    }

    case 'VERIFY_WITH_AI': {
      handleAiVerification(message.text)
        .then((result) => sendResponse({ success: true, result }))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    }

    case 'TEST_GEMINI_KEY': {
      testGeminiKey(message.apiKey)
        .then((res) => sendResponse({ success: true, message: res }))
        .catch((err) => sendResponse({ success: false, error: err.message }));
      return true;
    }

    case 'GET_STATS': {
      getSettings().then((s) => sendResponse({ stats: s.stats }));
      return true;
    }
  }
});

// AI Verification Worker
async function handleAiVerification(text) {
  if (!text) throw new Error('No text provided');
  const textHash = hashText(text);

  // 1. Check in-memory cache
  if (aiMemoryCache.has(textHash)) {
    return aiMemoryCache.get(textHash);
  }

  // 2. Check storage cache
  const stored = await chrome.storage.local.get('ai_cache');
  const cacheObj = stored.ai_cache || {};
  if (cacheObj[textHash]) {
    aiMemoryCache.set(textHash, cacheObj[textHash]);
    return cacheObj[textHash];
  }

  // 3. Call Gemini
  const settings = await getSettings();
  if (!settings.aiBoosterEnabled || !settings.geminiApiKey) {
    throw new Error('AI Booster is not enabled or API key is missing');
  }

  const result = await classifyWithGemini(text, settings.geminiApiKey);

  // 4. Save to cache (limit size to 400 entries)
  aiMemoryCache.set(textHash, result);
  cacheObj[textHash] = result;
  const keys = Object.keys(cacheObj);
  if (keys.length > 400) {
    delete cacheObj[keys[0]]; // purge oldest
  }
  await chrome.storage.local.set({ ai_cache: cacheObj });

  return result;
}

// Test user Gemini API key
async function testGeminiKey(apiKey) {
  const sample = "The election debate was heated between the presidential candidates last night.";
  const res = await classifyWithGemini(sample, apiKey);
  if (res && typeof res.isPolitical === 'boolean') {
    return 'API key verified successfully! Gemini is ready.';
  }
  throw new Error('Unexpected response format from Gemini');
}
