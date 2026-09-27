/**
 * Generates data/commit-stats.json and data/recent-activity.json from GitHub API.
 * Run: GITHUB_TOKEN=ghp_xxx node scripts/generate-commit-stats.js
 * Token must have `repo` scope to include private repos.
 */
const fs = require('fs');
const https = require('https');

const TOKEN = process.env.GITHUB_TOKEN || process.env.GH_PAT;
if (!TOKEN) { console.error('FATAL: GITHUB_TOKEN or GH_PAT required'); process.exit(1); }

const HEADERS = {
  Authorization: `Bearer ${TOKEN}`,
  'User-Agent': 'shipstream-generator/1.0',
};
const API_ROOT = 'https://api.github.com';

function apiGet(path, accept) {
  return new Promise((resolve, reject) => {
    const h = { ...HEADERS, Accept: accept || 'application/vnd.github.v3+json' };
    https.get(new URL(path, API_ROOT), { headers: h }, (res) => {
      let d = '';
      res.on('data', (c) => (d += c));
      res.on('end', () => {
        if (res.statusCode >= 400) return reject(new Error(`${path} → ${res.statusCode}`));
        try { resolve(JSON.parse(d)); } catch { reject(new Error(`JSON parse error for ${path}`)); }
      });
    }).on('error', reject);
  });
}

async function apiPaginate(path) {
  const results = [];
  const sep = path.includes('?') ? '&' : '?';
  for (let page = 1; ; page++) {
    const batch = await apiGet(`${path}${sep}per_page=100&page=${page}`);
    if (!batch || batch.length === 0) break;
    results.push(...batch);
  }
  return results;
}

/* ─── Commit stats (existing) ─── */

async function generateCommitStats(repoList) {
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const dayCounts = {};

  for (const fullName of repoList) {
    try {
      const commits = await apiPaginate(
        `/repos/${fullName}/commits?since=${oneYearAgo.toISOString()}&author=adagora`
      );
      for (const c of commits) {
        if (c.commit && c.commit.author && c.commit.author.date) {
          const key = c.commit.author.date.slice(0, 10);
          dayCounts[key] = (dayCounts[key] || 0) + 1;
        }
      }
    } catch (err) { console.warn(`  ${fullName}: ${err.message}`); }
  }

  const days = {};
  let total = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date(oneYearAgo);
    d.setDate(d.getDate() + i);
    const key = d.toISOString().slice(0, 10);
    days[key] = dayCounts[key] || 0;
    total += days[key];
  }

  return { days, total };
}

/* ─── Shipstream: recent activity feed ─── */

async function generateShipstream(privateRepos) {
  const items = [];

  // Events API for discovery, then repo API for commit details (PushEvents strip commits).
  const events = await apiPaginate('/users/adagora/events');

  const pushRepos = new Map();
  for (const event of events) {
    if (event.type === 'PushEvent' && event.repo?.name) {
      if (!pushRepos.has(event.repo.name)) {
        pushRepos.set(event.repo.name, event.created_at);
      }
    } else if (
      event.type === 'PullRequestEvent' &&
      event.payload?.action === 'closed' &&
      event.payload?.pull_request?.merged
    ) {
      const pr = event.payload.pull_request;
      items.push({
        type: 'pr',
        repo: event.repo?.name || '',
        title: pr.title,
        url: privateRepos.has(event.repo?.name) ? null : pr.html_url,
        private: privateRepos.has(event.repo?.name),
        date: pr.updated_at || event.created_at,
        state: 'closed',
        merged: true,
      });
    }
  }

  const commitPromises = [...pushRepos.entries()].map(async ([fullName]) => {
    try {
      const commits = await apiGet(`/repos/${fullName}/commits?author=adagora&per_page=5`);
      if (!Array.isArray(commits)) return;
      for (const c of commits) {
        if (c.commit?.author?.date) {
          items.push({
            type: 'commit',
            repo: fullName,
            message: c.commit.message ? c.commit.message.split('\n')[0] : '',
            // Private commit pages 404 for visitors, so they get no link.
            url: privateRepos.has(fullName) ? null : c.html_url || `https://github.com/${fullName}/commit/${c.sha}`,
            private: privateRepos.has(fullName),
            date: c.commit.author.date,
            sha: c.sha ? c.sha.slice(0, 7) : '',
          });
        }
      }
    } catch (_) {}
  });
  await Promise.allSettled(commitPromises);

  const seen = new Set();
  const unique = [];
  for (const item of items) {
    // Mirrored repos push the same commit twice; the sha identifies it once.
    const key = item.sha ? `sha:${item.sha}` : item.url || `${item.repo}@${item.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    unique.push(item);
  }
  unique.sort((a, b) => new Date(b.date) - new Date(a.date));

  return unique.slice(0, 25);
}

/* ─── Main ─── */

async function main() {
  const repos = await apiPaginate('/user/repos?type=all&sort=pushed');
  const ownerRepoSet = new Set();
  const privateRepos = new Set(repos.filter((r) => r.private).map((r) => r.full_name));

  for (const r of repos) {
    if (r.owner && r.owner.type === 'Organization') {
      if (r.permissions && r.permissions.push) ownerRepoSet.add(r.full_name);
    } else {
      ownerRepoSet.add(r.full_name);
    }
  }

  const repoList = [...ownerRepoSet].sort();
  console.log(`Found ${repoList.length} repos`);

  // Commit stats
  const { days, total } = await generateCommitStats(repoList);
  fs.writeFileSync('data/commit-stats.json', JSON.stringify({
    // Only the count is published: private repo names stay private.
    generated: new Date().toISOString(), total, days, repoCount: repoList.length,
  }, null, 2));
  console.log(`${total} commits → data/commit-stats.json`);

  // Shipstream activity feed — uses Events API, no per-repo iteration needed
  const feed = await generateShipstream(privateRepos);
  fs.writeFileSync('data/recent-activity.json', JSON.stringify({
    generated: new Date().toISOString(), items: feed,
  }, null, 2));
  console.log(`${feed.length} activity items → data/recent-activity.json`);
}

main().catch((err) => { console.error('FATAL:', err); process.exit(1); });
