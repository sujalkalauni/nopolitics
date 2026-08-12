/**
 * NoPolitics - Live Playground & Simulator Controller
 */

import { classifyPostText } from '../lib/classifier.js';

// Pre-packaged realistic sample feed data
const SAMPLE_TWITTER_FEED = [
  {
    id: 'tw-1',
    author: 'TechRadar',
    handle: '@techradar',
    avatar: 'TR',
    avatarColor: '#2563eb',
    time: '20m',
    text: 'NVIDIA just unveiled their next-generation AI chip architecture with 4x memory bandwidth and dramatic efficiency gains. Here is everything announced today! ⚡💻'
  },
  {
    id: 'tw-2',
    author: 'Political Wire',
    handle: '@polwire',
    avatar: 'PW',
    avatarColor: '#dc2626',
    time: '35m',
    text: 'Breaking: New battleground state poll shows a dead heat between the presidential candidates. Voter turnout in suburban districts could decide the election. #Election2024 #MAGA'
  },
  {
    id: 'tw-3',
    author: 'PlayStation Gamer',
    handle: '@ps5gaming',
    avatar: 'PG',
    avatarColor: '#4f46e5',
    time: '45m',
    text: 'Just completed the single player campaign of the new space RPG. The final boss fight took me 6 tries but the ending was worth it! 🎮'
  },
  {
    id: 'tw-4',
    author: 'India Daily Express',
    handle: '@indiadaily',
    avatar: 'ID',
    avatarColor: '#ea580c',
    time: '1h',
    text: 'Prime Minister Narendra Modi addressed a massive rally today, launching new welfare initiatives as the BJP prepares for the upcoming Lok Sabha constituency debates.'
  },
  {
    id: 'tw-5',
    author: 'Nature & Zen Vibes',
    handle: '@zenmoments',
    avatar: 'ZN',
    avatarColor: '#10b981',
    time: '2h',
    text: 'A quiet rainy morning in Kyoto, Japan. Take a deep breath, put your phone down for 10 minutes, and enjoy the moment. 🍃☕'
  },
  {
    id: 'tw-6',
    author: 'Westminster Beat',
    handle: '@ukpoliticsnow',
    avatar: 'UK',
    avatarColor: '#7c3aed',
    time: '2h',
    text: 'Prime Minister Keir Starmer faces intense scrutiny during PMQs as the Conservative opposition criticizes the newly proposed national taxation bill.'
  },
  {
    id: 'tw-7',
    author: 'Standup Daily',
    handle: '@comedycentral',
    avatar: 'CC',
    avatarColor: '#f59e0b',
    time: '3h',
    text: 'My doctor told me I need to avoid stress so I immediately deleted all political discussion groups and started watching cat videos. 10/10 recommendation.'
  }
];

const SAMPLE_INSTAGRAM_FEED = [
  {
    id: 'ig-1',
    username: 'travel_voyager',
    avatar: 'TV',
    caption: 'Sunset over Amalfi Coast, Italy 🌅✨ Grateful for peaceful evenings like this. Tag someone you would bring here!',
    tags: ['#travel', '#italy', '#wanderlust', '#sunset']
  },
  {
    id: 'ig-2',
    username: 'national_news_digest',
    avatar: 'ND',
    caption: 'Protests erupt outside government parliament building as citizens demand election reform and constitutional amendments. Full report on our story.',
    tags: ['#politics', '#protest', '#democracy', '#election']
  },
  {
    id: 'ig-3',
    username: 'foodie_delights',
    avatar: 'FD',
    caption: 'Handmade artisan sourdough pizza with fresh burrata and basil leaves 🍕 Nothing brings people together like good food.',
    tags: ['#foodie', '#pizza', '#delicious', '#cooking']
  },
  {
    id: 'ig-4',
    username: 'bharat_updates_online',
    avatar: 'BO',
    caption: 'Massive crowd gathers as Rahul Gandhi and Congress leaders hold a state press conference criticizing the current government and EVM voting process.',
    tags: ['#rahulgandhi', '#congress', '#indiaalliance', '#elections']
  }
];

// Simulator State
let simState = {
  isEnabled: true,
  filterStyle: 'blur', // 'blur' | 'pill' | 'ghost'
  strictness: 'balanced', // 'relaxed' | 'balanced' | 'strict'
  platform: 'twitter', // 'twitter' | 'instagram'
  customKeywords: [],
  enabledRegions: { us: true, india: true, uk_eu_global: true, general: true },
  posts: [...SAMPLE_TWITTER_FEED],
  revealedPostIds: new Set()
};

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const simMasterToggle = document.getElementById('simMasterToggle');
  const styleButtons = document.querySelectorAll('.seg-btn[data-style]');
  const strictnessButtons = document.querySelectorAll('.seg-btn[data-strictness]');
  const btnShowTwitter = document.getElementById('btnShowTwitter');
  const btnShowInstagram = document.getElementById('btnShowInstagram');
  const simCustomInput = document.getElementById('simCustomInput');
  const simAddCustomBtn = document.getElementById('simAddCustomBtn');
  const simTagsRow = document.getElementById('simTagsRow');
  const simNewPostText = document.getElementById('simNewPostText');
  const simInjectPostBtn = document.getElementById('simInjectPostBtn');
  const resetSampleFeedBtn = document.getElementById('resetSampleFeedBtn');

  const topFilteredCount = document.getElementById('topFilteredCount');
  const topScannedCount = document.getElementById('topScannedCount');
  const feedViewport = document.getElementById('feedViewport');
  const platformLogo = document.getElementById('platformLogo');
  const platformTitle = document.getElementById('platformTitle');

  // Render Feed
  function renderFeed() {
    feedViewport.innerHTML = '';
    let filteredCount = 0;
    const totalCount = simState.posts.length;

    simState.posts.forEach((item) => {
      const fullText = item.text || (item.caption + ' ' + (item.tags ? item.tags.join(' ') : ''));
      
      // Classify
      let result = { isPolitical: false, score: 0, matches: [] };
      if (simState.isEnabled) {
        result = classifyPostText(fullText, {
          strictness: simState.strictness,
          enabledRegions: simState.enabledRegions,
          customKeywords: simState.customKeywords
        });
      }

      if (result.isPolitical) {
        filteredCount++;
      }

      // Build DOM element
      let postEl;
      if (simState.platform === 'twitter') {
        postEl = buildTwitterPostElement(item);
      } else {
        postEl = buildInstagramPostElement(item);
      }

      // Apply Filter UI if political
      if (result.isPolitical && simState.isEnabled) {
        applySimulatorFilter(postEl, result, item.id);
      }

      feedViewport.appendChild(postEl);
    });

    topFilteredCount.textContent = filteredCount;
    topScannedCount.textContent = totalCount;
  }

  function buildTwitterPostElement(item) {
    const article = document.createElement('article');
    article.setAttribute('data-testid', 'tweet');
    article.id = item.id;

    article.innerHTML = `
      <div class="tweet-header">
        <div class="tweet-author">
          <div class="tweet-avatar" style="background: ${item.avatarColor || '#3b82f6'};">${item.avatar}</div>
          <div class="author-names">
            <span class="display-name">${escapeHtml(item.author)}</span>
            <span class="handle-time">${escapeHtml(item.handle)} · ${item.time}</span>
          </div>
        </div>
      </div>
      <div data-testid="tweetText">${escapeHtml(item.text)}</div>
      <div class="tweet-actions-bar">
        <span>💬 48</span>
        <span>🔁 124</span>
        <span>❤️ 892</span>
        <span>📊 14.2K</span>
      </div>
    `;
    return article;
  }

  function buildInstagramPostElement(item) {
    const article = document.createElement('article');
    article.className = 'instagram-post';
    article.id = item.id;

    const tagsHtml = (item.tags || []).map(t => `<a href="#">${escapeHtml(t)}</a>`).join(' ');

    article.innerHTML = `
      <div class="insta-header">
        <div class="insta-avatar">
          <div class="insta-avatar-inner">${item.avatar}</div>
        </div>
        <span class="insta-username">${escapeHtml(item.username)}</span>
      </div>
      <div class="insta-media-box">
        📸 Photo Post Preview
      </div>
      <div class="insta-caption-box">
        <span class="_ap3a"><strong>${escapeHtml(item.username)}</strong> ${escapeHtml(item.caption)}</span>
        <div class="insta-tags">${tagsHtml}</div>
      </div>
    `;
    return article;
  }

  function applySimulatorFilter(postEl, result, postId) {
    // If user clicked reveal for this post, don't hide
    if (simState.revealedPostIds.has(postId)) {
      postEl.classList.add('nopolitics-revealed');
      return;
    }

    const style = simState.filterStyle;

    if (style === 'ghost') {
      postEl.classList.add('nopolitics-ghost');
      return;
    }

    if (style === 'pill') {
      postEl.style.display = 'none';

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
        simState.revealedPostIds.add(postId);
        postEl.style.display = '';
        pill.remove();
      });

      postEl.parentNode.insertBefore(pill, postEl);
      return;
    }

    // Default: 'blur'
    postEl.classList.add('nopolitics-blurred-container');

    const contentWrapper = document.createElement('div');
    contentWrapper.className = 'nopolitics-blurred-content';
    while (postEl.firstChild) {
      contentWrapper.appendChild(postEl.firstChild);
    }
    postEl.appendChild(contentWrapper);

    const overlay = document.createElement('div');
    overlay.className = 'nopolitics-overlay';

    const topKeywords = result.matches.slice(0, 3).map(m => m.keyword);
    const keywordsHtml = topKeywords.length > 0
      ? topKeywords.map(k => `<span class="nopolitics-keyword-tag">#${escapeHtml(k)}</span>`).join(' ')
      : '<span class="nopolitics-keyword-tag">Political Content</span>';

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
          <button class="nopolitics-reveal-btn">👁️ Show Post</button>
        </div>
      </div>
    `;

    overlay.querySelector('.nopolitics-reveal-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      simState.revealedPostIds.add(postId);
      postEl.classList.add('nopolitics-revealed');
    });

    postEl.appendChild(overlay);
  }

  // Event Handlers
  simMasterToggle.addEventListener('change', () => {
    simState.isEnabled = simMasterToggle.checked;
    renderFeed();
  });

  styleButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      styleButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      simState.filterStyle = btn.dataset.style;
      simState.revealedPostIds.clear();
      renderFeed();
    });
  });

  strictnessButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      strictnessButtons.forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      simState.strictness = btn.dataset.strictness;
      renderFeed();
    });
  });

  btnShowTwitter.addEventListener('click', () => {
    btnShowTwitter.classList.add('active');
    btnShowInstagram.classList.remove('active');
    simState.platform = 'twitter';
    simState.posts = [...SAMPLE_TWITTER_FEED];
    simState.revealedPostIds.clear();
    platformLogo.textContent = '𝕏';
    platformTitle.textContent = 'Twitter / X Live Timeline Simulation';
    renderFeed();
  });

  btnShowInstagram.addEventListener('click', () => {
    btnShowInstagram.classList.add('active');
    btnShowTwitter.classList.remove('active');
    simState.platform = 'instagram';
    simState.posts = [...SAMPLE_INSTAGRAM_FEED];
    simState.revealedPostIds.clear();
    platformLogo.textContent = '📸';
    platformTitle.textContent = 'Instagram Live Feed Simulation';
    renderFeed();
  });

  // Custom keywords
  function renderTags() {
    simTagsRow.innerHTML = '';
    simState.customKeywords.forEach((kw, index) => {
      const tag = document.createElement('span');
      tag.className = 'nopolitics-keyword-tag';
      tag.style.cursor = 'pointer';
      tag.innerHTML = `${escapeHtml(kw)} &times;`;
      tag.addEventListener('click', () => {
        simState.customKeywords.splice(index, 1);
        renderTags();
        renderFeed();
      });
      simTagsRow.appendChild(tag);
    });
  }

  simAddCustomBtn.addEventListener('click', addCustomWord);
  simCustomInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') addCustomWord();
  });

  function addCustomWord() {
    const val = simCustomInput.value.trim().toLowerCase();
    if (!val) return;
    if (!simState.customKeywords.includes(val)) {
      simState.customKeywords.push(val);
      renderTags();
      renderFeed();
    }
    simCustomInput.value = '';
  }

  // Inject New Post
  simInjectPostBtn.addEventListener('click', () => {
    const text = simNewPostText.value.trim();
    if (!text) return;

    const newPost = simState.platform === 'twitter'
      ? {
          id: 'custom-' + Date.now(),
          author: 'Live User Post',
          handle: '@you',
          avatar: 'ME',
          avatarColor: '#ec4899',
          time: 'Just now',
          text: text
        }
      : {
          id: 'custom-' + Date.now(),
          username: 'you_insta',
          avatar: 'ME',
          caption: text,
          tags: []
        };

    simState.posts.unshift(newPost);
    simNewPostText.value = '';
    renderFeed();
  });

  resetSampleFeedBtn.addEventListener('click', () => {
    simState.revealedPostIds.clear();
    simState.posts = simState.platform === 'twitter' ? [...SAMPLE_TWITTER_FEED] : [...SAMPLE_INSTAGRAM_FEED];
    renderFeed();
  });

  // Initial render
  renderFeed();

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
