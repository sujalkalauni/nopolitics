/**
 * NoPolitics - High Performance Hybrid Classifier Engine
 * Combines smart entity matching, context weighting, and AI fallback.
 */

import { POLITICAL_DICTIONARY, SAFE_CONTEXT_EXCLUSIONS } from './political_dict.js';

// High-weight political figures and parties (single mention almost certainly political)
const HIGH_WEIGHT_ENTITIES = new Set([
  'trump', 'donald trump', 'biden', 'joe biden', 'kamala harris', 'jd vance', 'tim walz',
  'desantis', 'gavin newsom', 'nikki haley', 'bernie sanders', 'aoc', 'alexandria ocasio-cortez',
  'mitch mcconnell', 'chuck schumer', 'nancy pelosi', 'kevin mccarthy', 'matt gaetz', 'mtg',
  'marjorie taylor greene', 'ted cruz', 'democrat', 'democrats', 'republican', 'republicans',
  'gop', 'dnc', 'rnc', 'maga', 'scotus', 'project 2025', 'capitol riot',
  
  'modi', 'narendra modi', 'rahul gandhi', 'amit shah', 'arvind kejriwal', 'yogi adityanath',
  'mamata banerjee', 'mk stalin', 'bjp', 'congress party', 'aam aadmi party', 'hindutva',
  'lok sabha', 'rajya sabha', 'nda', 'india alliance', 'rss', 'article 370', 'waqf bill',
  
  'starmer', 'keir starmer', 'rishi sunak', 'boris johnson', 'nigel farage', 'tory', 'tories',
  'labour party', 'vladimir putin', 'zelensky', 'netanyahu', 'bibi', 'xi jinping'
]);

// Medium-weight political terms (often political, but can appear in general discussions)
const MEDIUM_WEIGHT_TERMS = new Set([
  'election', 'elections', 'electoral', 'ballot', 'voter', 'voters', 'voting',
  'caucus', 'primary election', 'impeachment', 'filibuster', 'lobbyist', 'super pac',
  'parliament', 'senate', 'congress', 'supreme court', 'legislation', 'border wall',
  'ice deportations', 'roe v wade', 'evm', 'caste census', 'farmers protest', 'delhi liquor policy'
]);

/**
 * Fast string hash for local result caching
 */
export function hashText(str) {
  let hash = 0;
  if (!str || str.length === 0) return '0';
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash |= 0; // Convert to 32bit integer
  }
  return Math.abs(hash).toString(36);
}

/**
 * Clean text for tokenization
 */
export function normalizeText(text) {
  if (!text) return '';
  return text
    .toLowerCase()
    .replace(/[^\w\s#@]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Check if the text matches any safe non-political context exclusions
 */
export function checkSafeExclusions(normalizedText) {
  for (const safePhrase of SAFE_CONTEXT_EXCLUSIONS) {
    if (normalizedText.includes(safePhrase)) {
      return safePhrase;
    }
  }
  return null;
}

/**
 * Primary Heuristic Classifier
 * @param {string} text Raw post text
 * @param {object} settings User configuration settings
 * @returns {object} Detailed classification result
 */
export function classifyPostText(text, settings = {}) {
  const {
    strictness = 'balanced', // 'relaxed' | 'balanced' | 'strict'
    enabledRegions = { us: true, india: true, uk_eu_global: true, general: true },
    customKeywords = [],
    customWhitelist = []
  } = settings;

  // Strictness score thresholds
  const THRESHOLDS = {
    strict: 0.30,   // Catches any subtle or passing political reference
    balanced: 0.50, // Standard balance: clear political posts & commentary
    relaxed: 0.75   // Only blatant political figures, campaigns & elections
  };
  const activeThreshold = THRESHOLDS[strictness] || 0.50;

  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    return {
      isPolitical: false,
      score: 0,
      confidence: 1,
      matches: [],
      reasons: [],
      needsAiVerification: false
    };
  }

  const normalized = normalizeText(text);

  // 1. Check Custom Whitelist (Instant bypass)
  if (Array.isArray(customWhitelist) && customWhitelist.length > 0) {
    for (const whiteTerm of customWhitelist) {
      const cleanTerm = whiteTerm.trim().toLowerCase();
      if (cleanTerm && normalized.includes(cleanTerm)) {
        return {
          isPolitical: false,
          score: 0,
          confidence: 1,
          matches: [],
          reasons: [`Whitelisted by user keyword: "${cleanTerm}"`],
          needsAiVerification: false,
          whitelisted: true
        };
      }
    }
  }

  // 2. Check Custom Blacklist / User Blocked Keywords (Instant 100% block)
  if (Array.isArray(customKeywords) && customKeywords.length > 0) {
    const userMatches = [];
    for (const blockTerm of customKeywords) {
      const cleanTerm = blockTerm.trim().toLowerCase();
      if (!cleanTerm) continue;

      // Word boundary regex for single words, substring for phrases
      const regex = cleanTerm.includes(' ')
        ? new RegExp(escapeRegex(cleanTerm), 'i')
        : new RegExp(`\\b${escapeRegex(cleanTerm)}\\b`, 'i');

      if (regex.test(normalized)) {
        userMatches.push(cleanTerm);
      }
    }

    if (userMatches.length > 0) {
      return {
        isPolitical: true,
        score: 1.0,
        confidence: 1.0,
        matches: userMatches.map(k => ({ keyword: k, category: 'custom', weight: 1.0 })),
        reasons: [`Matched custom blocked keywords: ${userMatches.join(', ')}`],
        needsAiVerification: false,
        source: 'custom_blocklist'
      };
    }
  }

  // 3. Check Safe Exclusions (e.g. "single player campaign", "president of nintendo")
  const safeExclusion = checkSafeExclusions(normalized);
  let safeDampener = safeExclusion ? 0.35 : 1.0;

  // 4. Scan Enabled Region Dictionaries
  const matches = [];
  const matchedKeywordsSet = new Set();
  let accumulatedScore = 0;

  // Gather categories to scan
  const categoriesToScan = [];
  if (enabledRegions.general !== false) categoriesToScan.push({ name: 'general', list: POLITICAL_DICTIONARY.general });
  if (enabledRegions.us !== false) categoriesToScan.push({ name: 'us', list: POLITICAL_DICTIONARY.us });
  if (enabledRegions.india !== false) categoriesToScan.push({ name: 'india', list: POLITICAL_DICTIONARY.india });
  if (enabledRegions.uk_eu_global !== false) categoriesToScan.push({ name: 'uk_eu_global', list: POLITICAL_DICTIONARY.uk_eu_global });
  categoriesToScan.push({ name: 'hashtags', list: POLITICAL_DICTIONARY.hashtags });

  for (const { name: categoryName, list } of categoriesToScan) {
    for (const item of list) {
      const isHashtag = item.startsWith('#');
      let regex;
      
      if (isHashtag) {
        regex = new RegExp(escapeRegex(item) + '(?![\\w])', 'i');
      } else if (item.includes(' ') || item.includes('-')) {
        // Multi-word phrase: match as phrase
        regex = new RegExp(`\\b${escapeRegex(item)}\\b`, 'i');
      } else {
        // Single word: strict word boundary
        regex = new RegExp(`\\b${escapeRegex(item)}\\b`, 'i');
      }

      if (regex.test(normalized)) {
        if (!matchedKeywordsSet.has(item)) {
          matchedKeywordsSet.add(item);

          let weight = 0.35; // default base weight
          if (HIGH_WEIGHT_ENTITIES.has(item)) {
            weight = 0.85;
          } else if (MEDIUM_WEIGHT_TERMS.has(item)) {
            weight = 0.60;
          } else if (isHashtag) {
            weight = 0.70;
          }

          matches.push({ keyword: item, category: categoryName, weight });
          accumulatedScore += weight;
        }
      }
    }
  }

  // Multi-match synergy boost (e.g. "vote" + "election" + "candidate" together is 100% political)
  if (matches.length >= 3) {
    accumulatedScore *= 1.35;
  } else if (matches.length === 2) {
    accumulatedScore *= 1.15;
  }

  // Apply safe dampener if applicable
  accumulatedScore *= safeDampener;

  // Normalize final score to [0.0, 1.0]
  const finalScore = Math.min(1.0, Math.round(accumulatedScore * 100) / 100);
  const isPolitical = finalScore >= activeThreshold;

  // Determine if post falls in the gray ambiguity zone for Tier 2 AI verification
  // (e.g., borderline score around threshold or moderate score without high-weight entity)
  const hasHighWeight = matches.some(m => m.weight >= 0.85);
  const isBorderline = finalScore >= 0.30 && finalScore <= 0.75;
  const needsAiVerification = isBorderline && !hasHighWeight;

  const reasons = matches.map(m => `"${m.keyword}" (${m.category})`);
  if (safeExclusion) {
    reasons.push(`[Safe context note: detected "${safeExclusion}"]`);
  }

  return {
    isPolitical,
    score: finalScore,
    threshold: activeThreshold,
    confidence: matches.length > 0 ? Math.min(1.0, 0.5 + (matches.length * 0.15)) : 0.9,
    matches,
    reasons,
    needsAiVerification,
    source: 'heuristics'
  };
}

/**
 * Tier 2 AI Classifier using Google Gemini API
 * @param {string} text Post content
 * @param {string} apiKey Gemini API Key
 * @returns {Promise<object>} AI classification verdict
 */
export async function classifyWithGemini(text, apiKey) {
  if (!apiKey || !apiKey.trim()) {
    throw new Error('Gemini API key is required');
  }

  const prompt = `You are a specialized content filter evaluator for social media feeds.
Analyze the following post text and determine if it contains political content.
"Political content" includes:
- Political campaigns, elections, voter appeals, candidate debates
- Current politicians, world leaders, ministers, parliament/congress members
- Government policy debates, legislation, geopolitical conflicts, protests, partisan rhetoric
- Political satire, propaganda, or partisan complaints

Post text to analyze:
"""${text.slice(0, 500)}"""

Respond ONLY with valid JSON in this exact structure:
{
  "is_political": true or false,
  "confidence": 0.0 to 1.0,
  "reason": "short 1-sentence reason"
}`;

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey.trim()}`;

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: 0.1,
        responseMimeType: 'application/json'
      }
    })
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Gemini API error (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawText) {
    throw new Error('Empty response from Gemini API');
  }

  const parsed = JSON.parse(rawText);
  return {
    isPolitical: Boolean(parsed.is_political),
    score: parsed.is_political ? (parsed.confidence || 0.9) : 0.1,
    confidence: parsed.confidence || 0.85,
    reason: parsed.reason || 'AI evaluated content',
    source: 'gemini_ai'
  };
}

function escapeRegex(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
