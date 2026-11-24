/**
 * Generates data/commit-stats.json and data/recent-activity.json from the GitHub API.
 * Run: GITHUB_TOKEN=ghp_xxx node scripts/generate-commit-stats.js
 * Token must have `repo` scope to include private repositories.
 * Self-check (no network): node scripts/generate-commit-stats.js --self-test
 *
 * Published activity for a private repository is the date, the day's count,
 * the repository name and the commit headline. No private URL, diff or path list.
 */
const fs = require('fs');
const https = require('https');

const API_ROOT = 'https://api.github.com';
const MAX_PER_REPO = 2;
const FEED_LIMIT = 25;
const RECENT_DAYS = 14;
const HEATMAP_DAYS = 365;

function authHeaders() {
  const token = process.env.GITHUB_TOKEN || process.env.GH_PAT;
  return {
    Authorization: `Bearer ${token}`,
    'User-Agent': 'shipstream-generator/1.0',
    Accept: 'application/vnd.github.v3+json',
  };
}

function classifyStatus(status, stopStatuses) {
  if (stopStatuses.includes(status)) return 'stop';
  if (status >= 400) return 'error';
  return 'ok';
}

function apiGet(path, { okStatuses = [200] } = {}) {
  return new Promise((resolve, reject) => {
    const req = https.get(new URL(path, API_ROOT), { headers: authHeaders() }, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        const status = res.statusCode || 0;
        const kind = classifyStatus(status, okStatuses.filter((code) => code !== 200));
        if (kind === 'stop') return resolve([]);
        if (kind === 'error') return reject(new Error(`${path} → ${status}`));
        try { resolve(JSON.parse(body)); }
        catch { reject(new Error(`JSON parse error for ${path}`)); }
      });
    });
    req.on('error', reject);
  });
}

async function apiPaginate(path, { stopStatuses = [], get } = {}) {
  const fetchPage = get || ((p) => apiGet(p, { okStatuses: [200, ...stopStatuses] }));
  const results = [];
  const sep = path.includes('?') ? '&' : '?';
  for (let page = 1; page <= 100; page++) {
    const batch = await fetchPage(`${path}${sep}per_page=100&page=${page}`);
    if (!Array.isArray(batch) || batch.length === 0) break;
    results.push(...batch);
    if (batch.length < 100) break;
  }
  return results;
}

function utcMidnight(now) {
  const d = new Date(now);
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function fillDayRange(dayCounts, now = new Date(), span = HEATMAP_DAYS) {
  const today = utcMidnight(now);
  const start = new Date(today);
  start.setUTCDate(start.getUTCDate() - (span - 1));
  const days = {};
  let total = 0;
  for (let d = new Date(start); d.getTime() <= today.getTime(); d.setUTCDate(d.getUTCDate() + 1)) {
    const key = d.toISOString().slice(0, 10);
    const n = dayCounts[key] || 0;
    days[key] = n;
    total += n;
  }
  return { days, total };
}

function selectRecentRepos(repos, now = new Date(), withinDays = RECENT_DAYS) {
  const cutoff = now.getTime() - withinDays * 24 * 60 * 60 * 1000;
  return (repos || []).filter((repo) => repo && repo.full_name && repo.pushed_at && Date.parse(repo.pushed_at) >= cutoff);
}

function headline(text) {
  return String(text || '').split('\n')[0].trim();
}

function isPublicGithubUrl(url, repo) {
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.hostname !== 'github.com') return false;
    if (!repo) return false;
    return parsed.pathname === `/${repo}` || parsed.pathname.startsWith(`/${repo}/`);
  } catch {
    return false;
  }
}

function toPublicItem(raw, privateRepos) {
  const repo = String(raw.repo || '');
  const isPrivate = raw.private === true || (privateRepos && privateRepos.has(repo));
  const type = raw.type === 'pr' ? 'pr' : 'commit';
  const item = {
    type,
    repo,
    private: isPrivate,
    date: raw.date || null,
    url: null,
  };
  if (type === 'pr') item.title = headline(raw.title || raw.message);
  else item.message = headline(raw.message || raw.title);
  if (!isPrivate) {
    const url = typeof raw.url === 'string' ? raw.url : '';
    if (url && isPublicGithubUrl(url, repo)) item.url = url;
    if (raw.sha) item.sha = String(raw.sha).slice(0, 7);
  }
  return item;
}

function capActivity(items, maxPerRepo = MAX_PER_REPO, limit = FEED_LIMIT) {
  const sorted = [...items].sort((a, b) => new Date(b.date) - new Date(a.date));
  const seen = new Set();
  const counts = new Map();
  const kept = [];
  for (const item of sorted) {
    const key = item.sha
      ? `sha:${item.sha}`
      : `${item.type}|${item.repo}|${item.date}|${item.message || item.title || ''}`;
    if (seen.has(key)) continue;
    seen.add(key);
    const repo = item.repo || '';
    const n = counts.get(repo) || 0;
    if (n >= maxPerRepo) continue;
    counts.set(repo, n + 1);
    kept.push(item);
    if (kept.length >= limit) break;
  }
  return kept.map((item) => {
    if (!item.private) return item;
    const copy = { ...item, url: null };
    delete copy.sha;
    return copy;
  });
}

function assertNoPrivateUrls(value, privateRepos) {
  const text = typeof value === 'string' ? value : JSON.stringify(value);
  for (const name of privateRepos) {
    if (name && text.includes(`github.com/${name}`)) {
      throw new Error(`refusing to publish a private repo URL (${name})`);
    }
  }
}

/* ─── Commit stats ─── */

async function generateCommitStats(repoList, now = new Date()) {
  const start = utcMidnight(now);
  start.setUTCDate(start.getUTCDate() - (HEATMAP_DAYS - 1));
  const dayCounts = {};

  for (const fullName of repoList) {
    try {
      const commits = await apiPaginate(
        `/repos/${fullName}/commits?since=${encodeURIComponent(start.toISOString())}&author=adagora`
      );
      for (const commit of commits) {
        const date = commit.commit?.author?.date;
        if (!date) continue;
        const key = date.slice(0, 10);
        dayCounts[key] = (dayCounts[key] || 0) + 1;
      }
    } catch (err) { console.warn(`  ${fullName}: ${err.message}`); }
  }

  return fillDayRange(dayCounts, now);
}

/* ─── Recent activity ─── */

async function generateShipstream(repos, privateRepos, now = new Date()) {
  const items = [];
  let events = [];
  try {
    // Page 4 of the Events API is a 422 once 300 events are exhausted. That ends the list.
    events = await apiPaginate('/users/adagora/events', { stopStatuses: [422] });
  } catch (err) {
    console.warn(`events: ${err.message}`);
  }

  const repoNames = new Set();
  for (const event of events) {
    if (event.type === 'PushEvent' && event.repo?.name) {
      repoNames.add(event.repo.name);
    } else if (
      event.type === 'PullRequestEvent' &&
      event.payload?.action === 'closed' &&
      event.payload?.pull_request?.merged
    ) {
      const pr = event.payload.pull_request;
      const repo = event.repo?.name || '';
      items.push(toPublicItem({
        type: 'pr',
        repo,
        title: pr.title,
        url: pr.html_url,
        date: pr.merged_at || pr.updated_at || event.created_at,
        private: privateRepos.has(repo),
      }, privateRepos));
    }
  }

  const recent = selectRecentRepos(repos, now, RECENT_DAYS);
  const recentNames = new Set(recent.map((repo) => repo.full_name));
  for (const name of recentNames) repoNames.add(name);
  console.log(`Shipstream repos: ${repoNames.size} (${recentNames.size} pushed in ${RECENT_DAYS} days)`);

  const since = new Date(now.getTime() - RECENT_DAYS * 24 * 60 * 60 * 1000).toISOString();
  for (const fullName of repoNames) {
    const sinceQuery = recentNames.has(fullName) ? `&since=${encodeURIComponent(since)}` : '';
    try {
      const commits = await apiGet(`/repos/${fullName}/commits?author=adagora${sinceQuery}&per_page=10`);
      if (!Array.isArray(commits)) continue;
      for (const commit of commits) {
        if (!commit.commit?.author?.date) continue;
        items.push(toPublicItem({
          type: 'commit',
          repo: fullName,
          message: commit.commit.message,
          url: commit.html_url,
          date: commit.commit.author.date,
          sha: commit.sha,
          private: privateRepos.has(fullName),
        }, privateRepos));
      }
    } catch (err) { console.warn(`  ${fullName}: ${err.message}`); }
  }

  return capActivity(items);
}

/* ─── Main ─── */

async function main() {
  const token = process.env.GITHUB_TOKEN || process.env.GH_PAT;
  if (!token) { console.error('FATAL: GITHUB_TOKEN or GH_PAT required'); process.exit(1); }

  const repos = await apiPaginate('/user/repos?type=all&sort=pushed');
  const ownerRepoSet = new Set();
  const privateRepos = new Set(repos.filter((repo) => repo.private).map((repo) => repo.full_name));

  for (const repo of repos) {
    if (repo.owner && repo.owner.type === 'Organization') {
      if (repo.permissions && repo.permissions.push) ownerRepoSet.add(repo.full_name);
    } else {
      ownerRepoSet.add(repo.full_name);
    }
  }

  const repoList = [...ownerRepoSet].sort();
  console.log(`Found ${repoList.length} repos`);

  const now = new Date();
  const { days, total } = await generateCommitStats(repoList, now);
  const stats = {
    generated: now.toISOString(),
    total,
    days,
    repoCount: repoList.length,
  };
  assertNoPrivateUrls(stats, privateRepos);
  fs.writeFileSync('data/commit-stats.json', JSON.stringify(stats, null, 2));
  console.log(`${total} commits → data/commit-stats.json`);

  const feed = {
    generated: new Date().toISOString(),
    items: await generateShipstream(repos, privateRepos, now),
  };
  assertNoPrivateUrls(feed, privateRepos);
  for (const item of feed.items) {
    if (item.private && item.url) throw new Error(`private item has url: ${item.repo}`);
  }
  const perRepo = new Map();
  for (const item of feed.items) perRepo.set(item.repo, (perRepo.get(item.repo) || 0) + 1);
  for (const [repo, count] of perRepo) {
    if (count > MAX_PER_REPO) throw new Error(`${repo} has ${count} feed items`);
  }
  fs.writeFileSync('data/recent-activity.json', JSON.stringify(feed, null, 2));
  console.log(`${feed.items.length} activity items → data/recent-activity.json`);
}

function selfTest() {
  const failures = [];
  const assert = (cond, msg) => { if (!cond) failures.push(msg); };

  assert(classifyStatus(422, [422]) === 'stop', '422 is the end of the Events API, not an error');
  assert(classifyStatus(500, [422]) === 'error', '500 is still an error');
  assert(classifyStatus(200, [422]) === 'ok', '200 is ok');
  assert(classifyStatus(409, []) === 'error', '409 without a stop list is an error');

  return apiPaginate('/users/adagora/events', {
    stopStatuses: [422],
    get: async (p) => {
      const page = Number(new URL(p, API_ROOT).searchParams.get('page'));
      if (page >= 4) return [];
      return Array.from({ length: 100 }, (_, i) => ({ id: `${page}-${i}` }));
    },
  }).then((events) => {
    assert(events.length === 300, `expected 300 events, got ${events.length}`);

    const now = new Date('2026-11-24T15:00:00Z');
    const filled = fillDayRange({ '2026-11-24': 4, '2026-11-10': 2 }, now);
    const keys = Object.keys(filled.days);
    assert(keys.length === 365, `expected 365 days, got ${keys.length}`);
    assert(keys[keys.length - 1] === '2026-11-24', `heatmap must include today, last key ${keys[keys.length - 1]}`);
    assert(filled.days['2026-11-24'] === 4, 'today count kept');
    assert(filled.days['2026-11-23'] === 0, 'missing day is zero');
    const start = utcMidnight(now);
    start.setUTCDate(start.getUTCDate() - 364);
    assert(keys[0] === start.toISOString().slice(0, 10), `window should start ${start.toISOString().slice(0, 10)}, got ${keys[0]}`);

    const repos = [
      { full_name: 'adagora/chatbot', private: true, pushed_at: '2026-11-20T00:00:00Z' },
      { full_name: 'adagora/old-private', private: true, pushed_at: '2026-10-01T00:00:00Z' },
      { full_name: 'adagora/IntentGauge', private: false, pushed_at: '2026-11-22T00:00:00Z' },
    ];
    const recent = selectRecentRepos(repos, now, 14);
    assert(recent.map((r) => r.full_name).sort().join() === 'adagora/IntentGauge,adagora/chatbot', `recent repos ${recent.map((r) => r.full_name)}`);

    const privateItem = toPublicItem({
      type: 'commit',
      repo: 'adagora/chatbot',
      message: 'fix the parser\n\ndiff --git a/secret.ts\n+token',
      url: 'https://github.com/adagora/chatbot/commit/abc123456789',
      date: '2026-11-24T00:00:00Z',
      sha: 'abc123456789',
      files: [{ filename: 'secret.ts' }],
    }, new Set(['adagora/chatbot']));
    assert(privateItem.url === null, 'private url stripped');
    assert(privateItem.message === 'fix the parser', `headline only, got ${privateItem.message}`);
    assert(!privateItem.files, 'file list dropped');
    assert(!JSON.stringify(privateItem).includes('secret.ts'), 'path from the body dropped');
    assert(!JSON.stringify(privateItem).includes('github.com/adagora/chatbot'), 'private url string dropped');

    const publicItem = toPublicItem({
      type: 'commit',
      repo: 'adagora/IntentGauge',
      message: 'Add a case',
      url: 'https://github.com/adagora/IntentGauge/commit/abcdef1',
      date: '2026-11-24T00:00:00Z',
      sha: 'abcdef123456',
    }, new Set(['adagora/chatbot']));
    assert(publicItem.url === 'https://github.com/adagora/IntentGauge/commit/abcdef1', 'public commit stays linked');
    assert(publicItem.sha === 'abcdef1', 'public sha kept short');

    const burst = [];
    for (let i = 0; i < 5; i++) burst.push({ repo: 'adagora/chatbot', private: true, date: new Date(Date.UTC(2026, 10, 24, 10, i)).toISOString(), sha: `a${i}`, message: `m${i}`, type: 'commit' });
    for (let i = 0; i < 3; i++) burst.push({ repo: 'adagora/IntentGauge', private: false, date: new Date(Date.UTC(2026, 10, 24, 9, i)).toISOString(), sha: `b${i}`, message: `p${i}`, type: 'commit', url: 'https://github.com/adagora/IntentGauge' });
    const capped = capActivity(burst, 2, 25);
    assert(capped.filter((item) => item.repo === 'adagora/chatbot').length === 2, 'private repo capped at 2');
    assert(capped.filter((item) => item.repo === 'adagora/IntentGauge').length === 2, 'public repo capped at 2');
    assert(capped.every((item) => item.repo !== 'adagora/chatbot' || item.url == null), 'capped private items stay unlinked');
    assert(capped.filter((item) => item.private).every((item) => !item.sha), 'private sha removed');

    assertNoPrivateUrls({ items: [{ repo: 'adagora/chatbot', message: 'fix parser', url: null }] }, new Set(['adagora/chatbot']));
    let threw = false;
    try { assertNoPrivateUrls('see https://github.com/adagora/chatbot/commit/abc', new Set(['adagora/chatbot'])); }
    catch { threw = true; }
    assert(threw, 'private URL in the payload must abort the write');

    if (failures.length) {
      console.error(failures.map((msg) => `FAIL ${msg}`).join('\n'));
      process.exit(1);
    }
    console.log('self-test ok');
  });
}

module.exports = {
  apiPaginate,
  classifyStatus,
  fillDayRange,
  selectRecentRepos,
  toPublicItem,
  capActivity,
  assertNoPrivateUrls,
};

if (require.main === module) {
  const run = process.argv.includes('--self-test') ? selfTest() : main();
  Promise.resolve(run).catch((err) => { console.error('FATAL:', err); process.exit(1); });
}
