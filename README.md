# NoPolitics (ZenFeed) 
> **Clean your social media feeds from political noise, election rage-bait, and toxic debates on Twitter/X and Instagram.**

Social media was made to connect, have fun, laugh at memes, and follow hobbies. **NoPolitics** restores peace to your feeds using a high-precision hybrid engine (Instant Local Keyword & Entity Intelligence + optional Google Gemini 1.5 Flash AI Booster).

---

## Key Features

1. **Dual Platform Support**:
   - **Twitter / X** (`x.com`, `twitter.com`): Filters tweets, quoted tweets, and retweets in real time as you scroll.
   - **Instagram** (`instagram.com`): Filters feed posts, reels captions, and explore hashtags.

2. **3 Filter Presentation Modes**:
   -  **Soft Zen (Blur Overlay)**: Posts are smoothly blurred with a frosted-glass shield badge showing matched topics. Click **"Show Post"** anytime to peek.
   -  **Clean Pill**: Collapses political posts into a sleek, one-line banner showing the matched reason and an expand button.
   -  **Ghost Mode**: Political posts vanish completely from the timeline without leaving gaps or layout stutter.

3. **Hybrid Detection Engine**:
   - **Tier 1 (Instant 0ms Heuristics)**: Built-in database of thousands of political entities across **United States**, **India**, **UK & Europe**, and **Global Geopolitics**, with multi-term synergy scoring.
   - **False-Positive Shields**: Context-aware exemptions prevent innocent posts from being blocked (e.g. *"Call of Duty campaign"*, *"President of Nintendo"*, *"Marketing campaign"*, *"Vote for MVP"*).
   - **Tier 2 (Gemini 1.5 Flash Booster)**: Optional AI verification for nuanced posts, dogwhistles, or political sarcasm.

4. **Sensitivity & Strictness Control**:
   - **Relaxed (0.75)**: Only blocks active political campaigns, elections, and major politicians.
   - **Balanced (0.50)**: Standard mode (recommended) — catches political commentary, news, debates, and policy discussions.
   - **Strict (0.30)**: Ultra-clean feed — blocks even passing mentions of government or geopolitical conflicts.

5. **Custom Rules & Privacy**:
   - Add custom keywords to block instantly.
   - Whitelist favorite topics or accounts to never filter them.
   - **100% Client-Side & Private**: All evaluation happens locally inside your browser. No personal data, browsing history, or feed contents are ever tracked.

---

##  How to Install in Your Browser (30 Seconds)

Works directly on **Google Chrome**, **Microsoft Edge**, and **Brave**:

1. Open your browser and go to the extensions page:
   - **Chrome**: `chrome://extensions`
   - **Edge**: `edge://extensions`
   - **Brave**: `brave://extensions`
2. Toggle on **"Developer mode"** (top right switch).
3. Click the **"Load unpacked"** button in the top left.
4. Select the project folder:
   ```
   k:\nopolitics
   ```
5. **Done!** The NoPolitics shield icon will appear in your browser toolbar. Pin it for quick access!

---

##  Try the Live Feed Simulator

Want to see how it works before browsing Twitter or Instagram?
You can open the built-in **Live Social Feed Simulator**:

- Start the local dev server:
  ```bash
  npm start
  ```
- Open [http://localhost:3000/playground/index.html](http://localhost:3000/playground/index.html) in any browser!
- Toggle between Twitter and Instagram feeds, change filter styles from Blur to Pill to Ghost, type custom tweets, and watch the feed filter live!

---

##  Control Center & Settings

Click the extension icon in your toolbar to:
- Toggle the shield on or off with the master power switch.
- Check live stats: **Posts Filtered Today**, **All-Time Posts Cleaned**, and **Peace Time Saved**.
- Quickly add custom blocked words.
- Click **"Full Settings & Regions"** to open the options dashboard:
  - Enable/disable specific regional dictionaries (US, India, UK/Europe, General).
  - Manage your custom Blocklist & Whitelist.
  - Enter an optional free Google Gemini API key to activate the Tier 2 AI Booster.
  - Export and import your settings as JSON.

---

##  Running Automated Tests

To verify detection precision and safe-exclusion edge cases:
```bash
npm test
```
All 16 test cases run and validate 100% accuracy across US, Indian, UK, and safe context scenarios.

---

##  Project Structure

```
k:/nopolitics/
├── manifest.json              # Manifest V3 extension configuration
├── icons/                     # Extension icons (16px, 48px, 128px, SVG)
├── lib/
│   ├── political_dict.js      # Multi-regional political entities & dictionaries
│   ├── classifier.js          # Hybrid classification engine & Gemini integration
│   └── storage.js             # Chrome Storage state manager & stats tracker
├── scripts/
│   ├── content.js             # Feed monitor script injected into Twitter & Instagram
│   ├── content.css            # Styles for blur overlay, pill banner, and ghost mode
│   ├── background.js          # Background service worker (badge counts & AI caching)
│   ├── generate_icons.js      # PNG icon generator
│   └── server.js              # Local test dev server
├── popup/
│   ├── popup.html             # Glassmorphism extension popup
│   ├── popup.css              # Popup styling & responsive design
│   └── popup.js               # Popup interactions & live tab sync
├── options/
│   ├── options.html           # Full settings & intelligence dashboard
│   ├── options.css            # Dashboard styling
│   └── options.js             # Settings state & playground tester
├── playground/
│   ├── index.html             # Realistic Twitter & Instagram live simulator
│   ├── playground.css         # Feed card simulation styling
│   └── playground.js          # Interactive mock feed controller
├── tests/
│   └── classifier.test.js     # Automated unit test suite (100% pass)
└── README.md                  # Installation and usage instructions
```
