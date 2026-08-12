/**
 * NoPolitics - Storage & Settings State Management
 */

export const DEFAULT_SETTINGS = {
  isEnabled: true,
  filterStyle: 'blur', // 'blur' | 'pill' | 'ghost'
  strictness: 'balanced', // 'relaxed' | 'balanced' | 'strict'
  enabledPlatforms: {
    twitter: true,
    instagram: true
  },
  enabledRegions: {
    general: true,
    us: true,
    india: true,
    uk_eu_global: true
  },
  customKeywords: [],
  customWhitelist: [],
  aiBoosterEnabled: false,
  geminiApiKey: '',
  stats: {
    totalScanned: 0,
    totalFiltered: 0,
    todayFiltered: 0,
    lastDate: new Date().toISOString().split('T')[0],
    timeSavedMinutes: 0
  }
};

/**
 * Load settings from chrome.storage.local
 */
export async function getSettings() {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    return new Promise((resolve) => {
      chrome.storage.local.get(DEFAULT_SETTINGS, (stored) => {
        // Ensure today's stats reset if new day
        const today = new Date().toISOString().split('T')[0];
        const stats = { ...DEFAULT_SETTINGS.stats, ...(stored.stats || {}) };
        if (stats.lastDate !== today) {
          stats.todayFiltered = 0;
          stats.lastDate = today;
          chrome.storage.local.set({ stats });
        }
        resolve({ ...DEFAULT_SETTINGS, ...stored, stats });
      });
    });
  }
  // Fallback for non-extension environments (e.g. test playground)
  const local = localStorage.getItem('nopolitics_settings');
  if (local) {
    try {
      return { ...DEFAULT_SETTINGS, ...JSON.parse(local) };
    } catch {
      return DEFAULT_SETTINGS;
    }
  }
  return DEFAULT_SETTINGS;
}

/**
 * Save settings to chrome.storage.local
 */
export async function saveSettings(newSettings) {
  if (typeof chrome !== 'undefined' && chrome.storage && chrome.storage.local) {
    return new Promise((resolve) => {
      chrome.storage.local.set(newSettings, () => {
        resolve(newSettings);
      });
    });
  }
  localStorage.setItem('nopolitics_settings', JSON.stringify(newSettings));
  return newSettings;
}

/**
 * Increment stats for filtered post
 */
export async function incrementFilteredStats(count = 1) {
  const settings = await getSettings();
  const stats = settings.stats || { ...DEFAULT_SETTINGS.stats };
  const today = new Date().toISOString().split('T')[0];

  if (stats.lastDate !== today) {
    stats.todayFiltered = 0;
    stats.lastDate = today;
  }

  stats.totalScanned += count;
  stats.totalFiltered += count;
  stats.todayFiltered += count;
  // Approx ~20 seconds of emotional energy / doomscrolling saved per political post
  stats.timeSavedMinutes = Math.round((stats.totalFiltered * 20) / 60);

  await saveSettings({ stats });
  return stats;
}

/**
 * Increment total scanned posts count
 */
export async function incrementScannedStats(count = 1) {
  const settings = await getSettings();
  const stats = settings.stats || { ...DEFAULT_SETTINGS.stats };
  stats.totalScanned += count;
  await saveSettings({ stats });
  return stats;
}
