/**
 * Storyboard acceptance-agent test.
 *
 * Requires services:
 * - CLIP:      http://localhost:8000
 * - Acceptance http://localhost:9000
 */

import fs from 'fs';

const CONFIG = {
  CLIP_URL: 'http://localhost:8000',
  ACCEPT_URL: 'http://localhost:9000',
  TOP_K: 1,
  THRESHOLD: 0.02,
};

const STORYBOARD = [
  {
    scene_id: 'scene_1',
    block_id: 'block_1',
    text: '[特写] 人物紧盯屏幕，额头冒汗',
    emotion: '紧张',
    expected_duration: 3.0,
  },
  {
    scene_id: 'scene_1',
    block_id: 'block_2',
    text: '[中景] 两人室内对话',
    emotion: '平静',
    expected_duration: 4.0,
  },
  {
    scene_id: 'scene_2',
    block_id: 'block_3',
    text: '[全景] 夜晚城市街道，人物奔跑',
    emotion: '紧张',
    expected_duration: 5.0,
  },
  {
    scene_id: 'scene_2',
    block_id: 'block_4',
    text: '[近景] 人物回头张望',
    emotion: '恐惧',
    expected_duration: 2.5,
  },
  {
    scene_id: 'scene_3',
    block_id: 'block_5',
    text: '[特写] 人物握紧拳头',
    emotion: '愤怒',
    expected_duration: 2.0,
  },
  {
    scene_id: 'scene_3',
    block_id: 'block_6',
    text: '[全景] 室外风景，人物深呼吸',
    emotion: '平静',
    expected_duration: 4.5,
  },
];

async function getJson(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`GET ${url} -> ${res.status}`);
  return res.json();
}

async function postJson(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text);
  } catch {
    data = { raw: text };
  }
  if (!res.ok) {
    throw new Error(`POST ${url} -> ${res.status}: ${text.substring(0, 200)}`);
  }
  return data;
}

function normalizeQuery(text) {
  return text
    .replace(/^\[[^\]]+\]\s*/g, '')
    .replace(/\|\s*.*$/g, '')
    .trim();
}

async function main() {
  const clipHealth = await getJson(`${CONFIG.CLIP_URL}/clip`);
  const acceptHealth = await getJson(`${CONFIG.ACCEPT_URL}/accept/health`);
  if (!clipHealth || !acceptHealth) throw new Error('services not healthy');

  const matches = [];
  for (const item of STORYBOARD) {
    const query = normalizeQuery(item.text);
    const search = await postJson(`${CONFIG.CLIP_URL}/clip/search`, {
      query,
      top_k: CONFIG.TOP_K,
      threshold: CONFIG.THRESHOLD,
    });

    const best = (search.results || [])[0];
    if (!best) {
      // leave unmatched to let acceptance score reflect coverage
      continue;
    }

    const emotion = Array.isArray(best.emotions) && best.emotions.length > 0 ? best.emotions[0] : undefined;
    matches.push({
      block_id: item.block_id,
      shot_id: best.shotId,
      file_path: best.filePath,
      similarity: Math.round((best.similarity || 0) * 10000) / 100, // percent scale
      tags: best.tags || [],
      emotion,
      duration: best.duration,
    });
  }

  const review = await postJson(`${CONFIG.ACCEPT_URL}/accept/review`, {
    storyboard: STORYBOARD,
    matches,
  });

  const lines = [];
  lines.push(`# Acceptance Agent Report`);
  lines.push('');
  lines.push(`- passed: ${review.passed}`);
  lines.push(`- coverage: ${review.score?.coverage}`);
  lines.push(`- similarity: ${review.score?.similarity}`);
  lines.push(`- emotion: ${review.score?.emotion}`);
  lines.push(`- duration: ${review.score?.duration}`);
  lines.push('');
  lines.push(`- storyboard_blocks: ${STORYBOARD.length}`);
  lines.push(`- match_items: ${matches.length}`);
  lines.push('');
  if (Array.isArray(review.reasons) && review.reasons.length) {
    lines.push('## Reasons');
    for (const r of review.reasons) lines.push(`- ${r}`);
    lines.push('');
  }
  if (Array.isArray(review.items) && review.items.length) {
    lines.push('## Items');
    for (const it of review.items) {
      lines.push(`- ${it.block_id}: ${it.status} (${it.details})`);
    }
    lines.push('');
  }

  fs.writeFileSync('docs/ACCEPTANCE_AGENT_REPORT.md', lines.join('\n'));

  if (!review.passed) {
    throw new Error('acceptance review did not pass (see docs/ACCEPTANCE_AGENT_REPORT.md)');
  }

  console.log('ACCEPTANCE PASS');
}

main().catch((e) => {
  console.error('ACCEPTANCE FAIL:', e.message);
  process.exit(1);
});
