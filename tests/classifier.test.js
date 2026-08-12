/**
 * NoPolitics - Automated Classifier Test Suite
 */

import { classifyPostText } from '../lib/classifier.js';

const testCases = [
  // Political Posts (Should all be detected)
  {
    text: "Trump announces new vice presidential running mate at massive Florida rally.",
    expected: true,
    desc: "US presidential candidate mention"
  },
  {
    text: "The election results in Pennsylvania will determine who controls the Senate and Congress.",
    expected: true,
    desc: "Election and legislative terms"
  },
  {
    text: "Prime Minister Narendra Modi addressed a BJP worker conference regarding Lok Sabha seats.",
    expected: true,
    desc: "Indian Prime Minister and party"
  },
  {
    text: "Rahul Gandhi criticized the EVM voter counting system in a recent interview.",
    expected: true,
    desc: "Indian opposition leader and EVMs"
  },
  {
    text: "Keir Starmer and the Labour government faced fierce pushback from Tories over national policy.",
    expected: true,
    desc: "UK politics and parties"
  },
  {
    text: "Zelensky traveled to Washington to discuss military aid with Biden and congressional leaders.",
    expected: true,
    desc: "Geopolitical leaders and congress"
  },
  {
    text: "Don't forget to cast your ballot tomorrow! Democracy depends on your vote! #Vote2024",
    expected: true,
    desc: "Voting, ballot and election hashtag"
  },

  // Innocent / Safe Posts (Should NOT be detected)
  {
    text: "Just baked a fresh batch of chocolate chip cookies! Best Sunday recipe ever 🍪",
    expected: false,
    desc: "Baking food post"
  },
  {
    text: "The new iPhone battery life is phenomenal. Upgraded from the 12 and it lasts two full days.",
    expected: false,
    desc: "Tech smartphone review"
  },
  {
    text: "Arsenal played incredible football in the Champions League match yesterday! What a goal by Saka.",
    expected: false,
    desc: "Sports football match"
  },

  // Safe Exclusions / Edge Cases (Must NOT trigger false positives)
  {
    text: "I finally finished the Call of Duty campaign mode on veteran difficulty! Insane storyline.",
    expected: false,
    desc: "Gaming 'campaign mode' safe context"
  },
  {
    text: "The President of Nintendo announced a new Mario and Zelda showcase for next month.",
    expected: false,
    desc: "Corporate 'President of Nintendo' safe context"
  },
  {
    text: "Our team just launched a huge marketing campaign for our new open source software library.",
    expected: false,
    desc: "Business 'marketing campaign' safe context"
  },
  {
    text: "Cast your vote for MVP of the basketball tournament in the comments below!",
    expected: false,
    desc: "Sports 'vote for MVP' safe context"
  }
];

console.log('🧪 Starting NoPolitics Classifier Test Suite...\n');
let passed = 0;
let failed = 0;

for (const t of testCases) {
  const result = classifyPostText(t.text, { strictness: 'balanced' });
  const isMatch = result.isPolitical === t.expected;

  if (isMatch) {
    passed++;
    console.log(`✅ PASS: ${t.desc}`);
    console.log(`   Text: "${t.text.slice(0, 70)}..."`);
    console.log(`   Score: ${result.score} (Political: ${result.isPolitical})\n`);
  } else {
    failed++;
    console.error(`❌ FAIL: ${t.desc}`);
    console.error(`   Text: "${t.text}"`);
    console.error(`   Expected isPolitical: ${t.expected}, Got: ${result.isPolitical}`);
    console.error(`   Score: ${result.score}, Matches: ${JSON.stringify(result.matches)}\n`);
  }
}

// Test Custom Whitelist & Blocklist
console.log('Testing Whitelist & Custom Blocklist...');

const whitelisted = classifyPostText("Modi and Trump had a phone call", {
  customWhitelist: ['trump']
});
if (!whitelisted.isPolitical && whitelisted.whitelisted) {
  passed++;
  console.log('✅ PASS: Custom Whitelist override successfully bypassed filter.\n');
} else {
  failed++;
  console.error('❌ FAIL: Custom Whitelist failed to override.\n');
}

const customBlocked = classifyPostText("I really love bananas and mangoes", {
  customKeywords: ['bananas']
});
if (customBlocked.isPolitical && customBlocked.score === 1.0) {
  passed++;
  console.log('✅ PASS: Custom Blocklist successfully flagged custom term.\n');
} else {
  failed++;
  console.error('❌ FAIL: Custom Blocklist failed to flag term.\n');
}

console.log(`-----------------------------------`);
console.log(`Test Results: ${passed} Passed, ${failed} Failed`);
if (failed > 0) {
  process.exit(1);
} else {
  console.log('🎉 All Classifier Tests Passed with 100% Accuracy!');
}
