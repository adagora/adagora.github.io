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
      const stats = await apiGet(`/repos/${fullName}/stats/participation`);
      if (stats && Array.isArray(stats.all) && stats.all.length > 0) {
        for (let w = 0; w < stats.all.length; w++) {
          if (stats.all[w] === 0) continue;
          const perDay = Math.round(stats.all[w] / 7);
          const base = new Date(oneYearAgo);
          for (let d = 0; d < 7; d++) {
            const day = new Date(base);
            day.setDate(base.getDate() + (w + 1) * 7 - d);
            dayCounts[day.toISOString().slice(0, 10)] = (dayCounts[day.toISOString().slice(0, 10)] || 0) + perDay;
          }
        }
      } else {
        const commits = await apiPaginate(
          `/repos/${fullName}/commits?since=${oneYearAgo.toISOString()}&author=adagora`
        );
        for (const c of commits) {
          if (c.commit && c.commit.author && c.commit.author.date) {
            const key = c.commit.author.date.slice(0, 10);
            dayCounts[key] = (dayCounts[key] || 0) + 1;
          }
        }
      }
    } catch (err) { console.warn(`  stats ${fullName}: ${err.message}`); }
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

async function generateShipstream() {
  const items = [];

  // Fetch merged PRs from the last 90 days
  try {
    const prs = await apiGet(
      '/search/issues?q=author:adagora+type:pr+is:merged&sort=updated&order=desc&per_page=20'
    );
    if (prs && prs.items) {
      for (const pr of prs.items) {
        items.push({
          type: 'pr',
          repo: pr.repository_url ? pr.repository_url.replace('https://api.github.com/repos/', '') : '',
          title: pr.title,
          url: pr.html_url,
          date: pr.updated_at || pr.created_at,
          state: pr.state,
          merged: true,
        });
      }
    }
  } catch (err) { console.warn(`  shipstream PRs: ${err.message}`); }

  // Fetch recent commits via search API (requires special accept header for commit search)
  try {
    const commits = await apiGet(
      '/search/commits?q=author:adagora&sort=author-date&order=desc&per_page=20',
      'application/vnd.github.v3+json'
    );
    if (commits && commits.items) {
      for (const c of commits.items) {
        const repo = c.repository ? c.repository.full_name : '';
        const sha = c.sha ? c.sha.slice(0, 7) : '';
        items.push({
          type: 'commit',
          repo,
          message: c.commit ? (c.commit.message || '').split('\n')[0] : '',
          url: c.html_url,
          date: c.commit && c.commit.author ? c.commit.author.date : (c.commit && c.commit.committer ? c.commit.committer.date : ''),
          sha,
        });
      }
    }
  } catch (err) { console.warn(`  shipstream commits: ${err.message}`); }

  // Deduplicate by url and sort descending by date
  const seen = new Set();
  const unique = [];
  for (const item of items) {
    if (seen.has(item.url)) continue;
    seen.add(item.url);
    unique.push(item);
  }
  unique.sort((a, b) => new Date(b.date) - new Date(a.date));

  return unique.slice(0, 25);
}

/* ─── Main ─── */

async function main() {
  const repos = await apiPaginate('/user/repos?type=all&sort=pushed');
  const ownerRepoSet = new Set();

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
    generated: new Date().toISOString(), total, days, repos: repoList,
  }, null, 2));
  console.log(`${total} commits → data/commit-stats.json`);

  // Shipstream activity feed
  const feed = await generateShipstream();
  fs.writeFileSync('data/recent-activity.json', JSON.stringify({
    generated: new Date().toISOString(), items: feed,
  }, null, 2));
  console.log(`${feed.length} activity items → data/recent-activity.json`);
}

main().catch((err) => { console.error('FATAL:', err); process.exit(1); });
