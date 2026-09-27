#!/usr/bin/env node
/**
 * Generates every derived file from data/profile.json.
 *
 *   node scripts/build.js             write all outputs
 *   node scripts/build.js --check     exit 1 when an output is stale or the data is invalid
 *   node scripts/build.js --links     request every external URL in the data (network)
 *   node scripts/build.js --variant <dir>/variant.json
 *                                     tailored CV (html + md) written next to variant.json
 *
 * index.html is both template and output: only the regions between
 * <!-- build:NAME --> and <!-- /build:NAME --> are rewritten.
 */
'use strict';

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const abs = (p) => path.join(ROOT, p);
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const arg = (f) => { const i = argv.indexOf(f); return i >= 0 ? argv[i + 1] : undefined; };

const FILES = {
  pdfEn: 'cv/Adrian-Gora-CV-EN.pdf',
  pdfPl: 'cv/Adrian-Gora-CV-PL.pdf',
  htmlEn: 'cv/index.html',
  htmlPl: 'cv/pl.html',
  mdEn: 'cv.md',
  mdPl: 'cv.pl.md',
};

/* ─── Helpers ─── */

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const t = (v, lang = 'en') => (v == null ? '' : typeof v === 'string' ? v : v[lang] ?? v.en ?? '');
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function fmtDate(d, lang, labels) {
  if (!d) return labels.present;
  const [y, m] = d.split('-');
  if (!m) return y;
  return lang === 'pl' ? `${m}.${y}` : `${MONTHS[Number(m) - 1]} ${y}`;
}
const range = (a, b, lang, labels) => `${fmtDate(a, lang, labels)} – ${fmtDate(b, lang, labels)}`;
const withLang = (p, lang) => ({ ...p, work: p.work.map((w) => ({ ...w, position: t(w.position, lang) })) });
const abs_url = (p, base) => (/^https?:/.test(p) ? p : base + p.replace(/^\//, ''));

function deepMerge(base, over) {
  if (Array.isArray(over) || typeof over !== 'object' || over === null) return over;
  const out = { ...base };
  for (const [k, v] of Object.entries(over)) {
    out[k] = typeof v === 'object' && v !== null && !Array.isArray(v) && typeof base?.[k] === 'object'
      ? deepMerge(base[k], v)
      : v;
  }
  return out;
}

const chips = (list, cls = 'chips') => (list?.length ? `<ul class="${cls}">${list.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>` : '');
const external = (url, label, cls = 'link-arrow') => `<a class="${cls}" href="${esc(url)}" target="_blank" rel="noopener">${esc(label)} <span aria-hidden="true">↗</span></a>`;

function sectionHead(num, kicker, title, lede) {
  return `<header class="section-head">
        <p class="kicker"><span class="sheet">${num}</span>${esc(kicker)}</p>
        <h2>${esc(title)}</h2>${lede ? `\n        <p class="lede">${lede}</p>` : ''}
      </header>`;
}

/* ─── Validation ─── */

function validate(p) {
  const errors = [];
  const ids = new Set();
  for (const item of [...p.work, ...p.projects]) {
    if (!item.id) errors.push(`missing id: ${t(item.name) || item.company}`);
    else if (ids.has(item.id)) errors.push(`duplicate id: ${item.id}`);
    ids.add(item.id);
  }
  for (const pr of p.projects) {
    if (!['public', 'private'].includes(pr.visibility)) errors.push(`${pr.id}: visibility must be public or private`);
    if (!['featured', 'private', 'earlier'].includes(pr.tier)) errors.push(`${pr.id}: tier must be featured, private or earlier`);
    if (pr.visibility === 'public' && !pr.links?.[0]?.url) errors.push(`${pr.id}: public project needs links[0].url`);
    if (pr.visibility === 'private' && pr.links?.some((l) => l.url.includes('github.com/adagora'))) {
      errors.push(`${pr.id}: private project links to its repo; visitors would get a 404`);
    }
  }
  const anchors = new Set(['#delivery', '#activity', '#projects', ...p.projects.map((x) => `#project-${x.id}`)]);
  for (const pr of p.proof) if (!anchors.has(pr.href)) errors.push(`proof ${pr.id}: href ${pr.href} matches no section`);
  for (const url of collectUrls(p)) if (!/^https:\/\//.test(url)) errors.push(`not https: ${url}`);
  return errors;
}

function collectUrls(p) {
  const urls = new Set([p.basics.url, ...p.basics.profiles.map((x) => x.url)]);
  for (const pr of p.projects) for (const l of pr.links || []) urls.add(l.url);
  return [...urls];
}

/* ─── Site regions (index.html) ─── */

function siteRegions(p) {
  const b = p.basics;
  const L = p.labels.en;
  const base = p.meta.canonical;
  const featured = p.projects.filter((x) => x.tier === 'featured');
  const priv = p.projects.filter((x) => x.tier === 'private');
  const earlier = p.projects.filter((x) => x.tier === 'earlier');
  const current = p.work[0];
  const mail = `mailto:${b.email}`;
  const byNet = Object.fromEntries(b.profiles.map((x) => [x.network, x.url]));
  const title = `${b.name} · AI Engineer (LLM, RAG, agents) · Poland`;
  const description = `${t(b.headline)}. ${t(b.availability.text)}.`;

  const person = {
    '@type': 'Person',
    '@id': `${base}#person`,
    name: b.name,
    alternateName: b.asciiName,
    jobTitle: b.label,
    description: t(b.summary),
    url: base,
    email: mail,
    image: abs_url(b.image, base),
    sameAs: b.profiles.map((x) => x.url),
    address: { '@type': 'PostalAddress', addressCountry: b.location.countryCode },
    worksFor: { '@type': 'Organization', name: current.company },
    hasOccupation: { '@type': 'Occupation', name: b.label, skills: p.skills.slice(0, 4).flatMap((s) => s.keywords).join(', ') },
    knowsAbout: p.skills.flatMap((s) => s.keywords),
    knowsLanguage: p.languages.map((l) => ({ '@type': 'Language', name: t(l.language) })),
    alumniOf: p.education.map((e) => ({ '@type': 'CollegeOrUniversity', name: t(e.institution) })),
    award: p.awards.map((a) => t(a.title)),
  };
  const jsonld = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'ProfilePage', '@id': `${base}#page`, url: base, name: title, inLanguage: 'en', dateModified: p.meta.updated, mainEntity: { '@id': `${base}#person` } },
      person,
      {
        '@type': 'ItemList',
        '@id': `${base}#projects`,
        name: 'Selected projects',
        itemListElement: featured.map((pr, i) => ({
          '@type': 'ListItem',
          position: i + 1,
          item: { '@type': 'SoftwareSourceCode', name: t(pr.name), description: t(pr.summary), codeRepository: pr.links[0].url, programmingLanguage: pr.stack[0], author: { '@id': `${base}#person` } },
        })),
      },
    ],
  };

  const head = `
  <title>${esc(title)}</title>
  <meta name="description" content="${esc(description)}" />
  <meta name="author" content="${esc(b.name)}" />
  <link rel="canonical" href="${base}" />
  <link rel="alternate" type="text/markdown" href="${FILES.mdEn}" title="CV (Markdown)" />
  <link rel="alternate" type="application/json" href="resume.json" title="JSON Resume" />
  <link rel="alternate" type="text/plain" href="llms.txt" title="llms.txt" />
  <meta property="og:type" content="profile" />
  <meta property="og:title" content="${esc(title)}" />
  <meta property="og:description" content="${esc(description)}" />
  <meta property="og:url" content="${base}" />
  <meta property="og:image" content="${abs_url(b.image, base)}" />
  <meta property="profile:first_name" content="Adrian" />
  <meta property="profile:last_name" content="Góra" />
  <meta name="twitter:card" content="summary" />
  <script type="application/ld+json">${JSON.stringify(jsonld).replace(/</g, '\\u003c')}</script>
  `;

  const hero = `
    <section id="top" class="hero">
      <div class="hero-grid">
        <div class="hero-copy">
          <p class="status"><span class="pulse" aria-hidden="true"></span>${esc(t(b.availability.short))} · ${esc(t(b.location.region))} · remote or hybrid</p>
          <h1 class="hero-name">${esc(b.name)}</h1>
          <p class="hero-role">AI Engineer <span>for manufacturing and engineering data</span></p>
          <p class="hero-tagline">${esc(t(b.tagline))}</p>
          <div class="dimline" role="img" aria-label="Career: three and a half years of automotive CAD engineering, then six years of software and AI">
            <div class="dim-seg" style="--w:3.5">2017–2020 · automotive CAD</div>
            <div class="dim-seg dim-seg--accent" style="--w:6">2020–now · software → AI</div>
          </div>
          <div class="hero-cta">
            <a class="btn btn-primary" href="${FILES.pdfEn}" download>Download CV <span class="btn-note">PDF</span></a>
            <a class="btn" href="${mail}">Email me</a>
            ${external(byNet.LinkedIn, 'LinkedIn', 'btn btn-ghost')}
            ${external(byNet.GitHub, 'GitHub', 'btn btn-ghost')}
          </div>
          <p class="hero-alt">CV po polsku: <a href="${FILES.pdfPl}" download>PDF</a> · <a href="${FILES.htmlPl}">wersja web</a></p>
        </div>
        <aside class="titleblock" aria-label="Profile at a glance">
          <div class="tb-photo"><img src="${esc(b.image)}" alt="Portrait of ${esc(b.name)}" width="600" height="800" /></div>
          <dl class="tb">
            ${b.titleBlock.map((r) => `<div><dt>${esc(r.label)}</dt><dd>${esc(r.value)}</dd></div>`).join('\n            ')}
          </dl>
          <div class="tb-foot"><span>ADAGORA.GITHUB.IO</span><span>REV ${esc(p.meta.updated)}</span><span>SHEET 1/1</span></div>
        </aside>
      </div>
    </section>`;

  const proof = `
    <section class="proof" aria-label="Results in numbers">
      ${p.proof.map((x) => `<a class="proof-item" href="${x.href}"><span class="proof-value"${x.live ? ` data-live="${x.live}"` : ''}>${esc(x.value)}</span><span class="proof-label">${esc(x.label)}</span></a>`).join('\n      ')}
    </section>`;

  const delivery = `
    <section id="delivery" class="section">
      ${sectionHead('01', 'Current role', `Shipped at ${current.company}`,
        `${esc(current.position)} (${L.officialTitle.toLowerCase()}: ${esc(current.officialTitle)}), ${esc(range(current.startDate, current.endDate, 'en', L))}. ${esc(t(current.summary))} The code is private; I can walk through any of it in an interview.`)}
      <ol class="callouts">
        ${current.highlights.map((h, i) => `<li class="callout">
          <span class="balloon" aria-hidden="true">${i + 1}</span>
          <h3>${esc(t(h.title))}</h3>
          <p>${esc(t(h.text))}</p>
          ${chips(h.stack)}
        </li>`).join('\n        ')}
      </ol>
    </section>`;

  const projectCard = (pr, size) => `<article id="project-${pr.id}" class="project project--${size}">
          <div class="project-head">
            <span class="badge badge--${pr.visibility}">${pr.visibility === 'public' ? 'Public code' : 'Private repo'}</span>
            <h3>${esc(t(pr.name))}</h3>
          </div>
          <p class="project-summary">${esc(t(pr.summary))}</p>
          ${pr.metrics ? `<dl class="metrics">${pr.metrics.map((m) => `<div><dt>${esc(m.value)}</dt><dd>${esc(m.label)}</dd></div>`).join('')}</dl>` : ''}
          ${pr.bullets ? `<ul class="bullets">${pr.bullets.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
          ${pr.credit ? `<p class="credit">${esc(pr.credit).replace(/`([^`]+)`/g, '<code>$1</code>')}</p>` : ''}
          <div class="project-foot">
            ${chips(pr.stack)}
            ${(pr.links || []).map((l) => external(l.url, l.label)).join('')}
          </div>
        </article>`;

  const projects = `
    <section id="projects" class="section">
      ${sectionHead('02', 'Selected projects', 'Projects with code you can read',
        'Public repositories first, each with a link to the code. The private ones below them I can show on a call.')}
      <div class="projects-featured">
        ${featured.map((pr, i) => projectCard(pr, i < 2 ? 'xl' : 'md')).join('\n        ')}
      </div>
      <h3 class="subhead">Private repositories</h3>
      <div class="projects-private">
        ${priv.map((pr) => projectCard(pr, 'sm')).join('\n        ')}
      </div>
      <h3 class="subhead">Earlier experiments</h3>
      <ul class="earlier">
        ${earlier.map((pr) => `<li><a href="${esc(pr.links[0].url)}" target="_blank" rel="noopener">${esc(t(pr.name))}</a><span class="earlier-sum">${esc(t(pr.summary))}${pr.links.slice(1).map((l) => ` ${external(l.url, l.label, '')}`).join('')}</span><span class="earlier-stack">${esc(pr.stack.join(' · '))}</span></li>`).join('\n        ')}
      </ul>
    </section>`;

  const principles = `
    <section id="principles" class="section">
      ${sectionHead('03', 'How I work', 'Engineering principles')}
      <div class="principles">
        ${p.principles.map((x, i) => `<div class="principle"><span class="pnum">P${i + 1}</span><h3>${esc(x.title)}</h3><p>${esc(x.text)}</p></div>`).join('\n        ')}
      </div>
    </section>`;

  const others = p.work.slice(1).filter((w) => w.group !== 'cad');
  const cad = p.work.filter((w) => w.group === 'cad');
  const experience = `
    <section id="experience" class="section">
      ${sectionHead('04', 'Career', 'Experience')}
      <ol class="timeline">
        <li class="tl-item tl-item--now">
          <div class="tl-when">${esc(range(current.startDate, current.endDate, 'en', L))}</div>
          <div class="tl-body">
            <h3>${esc(current.position)} <span class="at">${esc(current.company)}</span></h3>
            <p class="tl-note">${L.officialTitle}: ${esc(current.officialTitle)}. ${esc(t(current.summary))} Five internal AI tools, described in <a href="#delivery">Shipped at ${esc(current.company)}</a>.</p>
          </div>
        </li>
        ${others.map((w) => `<li class="tl-item">
          <div class="tl-when">${esc(range(w.startDate, w.endDate, 'en', L))}</div>
          <div class="tl-body">
            <h3>${esc(w.position)} <span class="at">${esc(w.company)}</span></h3>
            <ul>${w.highlights.map((h) => `<li>${esc(t(h.text))}</li>`).join('')}</ul>
          </div>
        </li>`).join('\n        ')}
        <li class="tl-item tl-item--cad">
          <div class="tl-when">${esc(range(cad[cad.length - 1].startDate, cad[0].endDate, 'en', L))}</div>
          <div class="tl-body">
            <h3>Product and CAD engineering <span class="at">${esc(cad.map((w) => w.company).join(' · '))}</span></h3>
            <p class="tl-note">Three and a half years in the automotive supply chain: CATIA V5, NX, GD&amp;T, BOM and D-FMEA.</p>
            <ul>${cad.map((w) => `<li><strong>${esc(w.position)}, ${esc(w.company)}${w.location ? ` (${esc(w.location)})` : ''}, ${esc(range(w.startDate, w.endDate, 'en', L))}.</strong> ${esc(t(w.highlights[0].text))}</li>`).join('')}</ul>
          </div>
        </li>
      </ol>
    </section>`;

  const skills = `
    <section id="skills" class="section">
      ${sectionHead('05', 'Toolbox', 'Skills')}
      <div class="skill-groups">
        ${p.skills.map((s) => `<div class="skill-group"><h3>${esc(t(s.name))}</h3>${chips(s.keywords)}</div>`).join('\n        ')}
      </div>
    </section>`;

  const background = `
    <section id="background" class="section">
      ${sectionHead('07', 'Background', 'Education, languages, certificates')}
      <div class="bg-grid">
        <div><h3>${L.education}</h3><ul class="plain">${p.education.map((e) => `<li><strong>${esc(t(e.institution))}</strong><span>${esc(t(e.studyType))}, ${esc(t(e.area))} · ${esc(e.startDate === e.endDate ? e.startDate : `${e.startDate}–${e.endDate}`)}</span></li>`).join('')}</ul></div>
        <div><h3>${L.languages}</h3><ul class="plain">${p.languages.map((l) => `<li><strong>${esc(t(l.language))}</strong><span>${esc(t(l.fluency))}</span></li>`).join('')}</ul></div>
        <div><h3>${L.certificates}</h3><ul class="plain">${p.certificates.map((c) => `<li><strong>${esc(c.name)}</strong>${c.issuer ? `<span>${esc(c.issuer)}${c.date ? `, ${esc(c.date)}` : ''}</span>` : ''}</li>`).join('')}</ul></div>
        <div><h3>${L.awards}</h3><ul class="plain">${p.awards.map((a) => `<li><strong>${esc(t(a.title))}</strong><span>${esc(a.date)}</span></li>`).join('')}${p.publications.map((x) => `<li><strong>${esc(x.name)}</strong><span>${esc(t(x.role))}</span></li>`).join('')}</ul></div>
      </div>
    </section>`;

  const recruiters = `
    <section id="recruiters" class="section">
      ${sectionHead('08', 'For recruiters', 'Quick facts', 'Everything a screening call usually asks, in one place.')}
      <div class="recruit-grid">
        <dl class="facts">
          <div><dt>Target roles</dt><dd>${esc(b.targetRoles.join(' · '))}</dd></div>
          <div><dt>${L.availability}</dt><dd>${esc(t(b.availability.text))}</dd></div>
          <div><dt>Location and mode</dt><dd>${esc(t(b.location.region))} · ${esc(t(b.workMode))}</dd></div>
          <div><dt>Contract</dt><dd>${esc(t(b.contract))}</dd></div>
          <div><dt>Languages</dt><dd>${esc(p.languages.map((l) => `${t(l.language)} ${t(l.fluency).replace(/^.*?\((.*)\)$/, '$1')}`).join(' · '))}</dd></div>
          <div><dt>Contact</dt><dd><a href="${mail}">${esc(b.email)}</a> · <a href="${esc(byNet.LinkedIn)}" target="_blank" rel="noopener">LinkedIn</a></dd></div>
        </dl>
        <div class="machine">
          <h3>Machine-readable versions</h3>
          <p>The same profile as files, for applicant tracking systems and AI assistants.</p>
          <ul class="files">
            <li><a href="${FILES.mdEn}"><code>/cv.md</code></a><span>Full CV in Markdown</span></li>
            <li><a href="${FILES.mdPl}"><code>/cv.pl.md</code></a><span>CV po polsku, Markdown</span></li>
            <li><a href="resume.json"><code>/resume.json</code></a><span>JSON Resume 1.0 schema</span></li>
            <li><a href="llms.txt"><code>/llms.txt</code></a><span>Summary for language models</span></li>
            <li><a href="${FILES.pdfEn}" download><code>CV-EN.pdf</code></a><span>Print CV, English</span></li>
            <li><a href="${FILES.pdfPl}" download><code>CV-PL.pdf</code></a><span>Print CV, Polish</span></li>
          </ul>
        </div>
      </div>
      <div class="cta-band">
        <p>If you are hiring for an AI engineering role, write to me and I will send a short walkthrough of the work that fits it.</p>
        <a class="btn btn-primary" href="${mail}">Email me</a>
      </div>
    </section>`;

  const footer = `
  <footer class="footer">
    <span>© ${p.meta.updated.slice(0, 4)} ${esc(b.name)} · generated from <a href="https://github.com/adagora/adagora.github.io/blob/master/data/profile.json" target="_blank" rel="noopener">data/profile.json</a> · updated ${esc(p.meta.updated)}</span>
    <span class="footer-links"><a href="${mail}">Email</a>${b.profiles.map((x) => external(x.url, x.network, '')).join('')}</span>
  </footer>`;

  return { head, hero, proof, delivery, projects, principles, experience, skills, background, recruiters, footer };
}

function fillRegions(html, regions) {
  for (const [name, content] of Object.entries(regions)) {
    const re = new RegExp(`(<!-- build:${name} -->)[\\s\\S]*?\\n([ \\t]*)<!-- /build:${name} -->`);
    if (!re.test(html)) throw new Error(`index.html has no <!-- build:${name} --> region`);
    html = html.replace(re, (_, open, indent) => `${open}${content.trimEnd()}\n${indent}<!-- /build:${name} -->`);
  }
  return html;
}

/* ─── CV (print HTML) ─── */

function cvProjects(p, variant) {
  const ids = variant?.projects;
  const list = ids ? ids.map((id) => p.projects.find((x) => x.id === id)).filter(Boolean) : p.projects.filter((x) => x.cv);
  return list;
}

function sortByFocus(items, focus) {
  if (!focus?.length) return items;
  const score = (x) => (x.tags || []).filter((tag) => focus.includes(tag)).length;
  return items.map((x, i) => [x, i]).sort((a, b) => score(b[0]) - score(a[0]) || a[1] - b[1]).map(([x]) => x);
}

function cvHtml(p, lang, variant) {
  const b = p.basics;
  const L = p.labels[lang];
  const css = fs.readFileSync(abs('css/cv.css'), 'utf8');
  const img = abs(b.image);
  const photo = fs.existsSync(img) ? `data:image/jpeg;base64,${fs.readFileSync(img).toString('base64')}` : '';
  const byNet = Object.fromEntries(b.profiles.map((x) => [x.network, x.url]));
  const strip = (u) => u.replace(/^https:\/\/(www\.)?/, '').replace(/\/$/, '');
  const focus = variant?.focusTags;
  const current = p.work[0];
  const rest = p.work.slice(1).filter((w) => w.group !== 'cad');
  const cad = p.work.filter((w) => w.group === 'cad');
  const projects = sortByFocus(cvProjects(p, variant), focus);
  // github.com/o/repo/tree/<branch>/a/b → "github.com/o/repo (a/b)"
  const linkText = (u) => {
    const m = strip(u).match(/^(github\.com\/[^/]+\/[^/]+)\/tree\/.*\/([^/]+\/[^/]+)$/);
    return m ? `${m[1]} (${m[2]})` : strip(u);
  };

  const job = (w, bullets) => `<div class="job">
      <div class="job-head"><h3>${esc(w.position)} <span>· ${esc(w.company)}</span></h3><span class="when">${esc(range(w.startDate, w.endDate, lang, L))}</span></div>
      ${bullets.length ? `<ul>${bullets.map((h) => `<li>${esc(t(h.text, lang))}</li>`).join('')}</ul>` : ''}
    </div>`;

  return `<!DOCTYPE html>
<html lang="${lang}">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${esc(b.name)} · CV${lang === 'pl' ? ' (PL)' : ''}</title>
<meta name="description" content="${esc(t(b.headline, lang))}" />
<link rel="canonical" href="${p.meta.canonical}${lang === 'pl' ? FILES.htmlPl : 'cv/'}" />
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500&display=swap" rel="stylesheet" />
<style>
${css}</style>
</head>
<body>
<main class="sheet">
  <header class="cv-head">
    <div>
      <h1>${esc(b.name)}</h1>
      <p class="headline">${esc(t(b.headline, lang))}</p>
      <p class="contact">
        <a href="mailto:${esc(b.email)}">${esc(b.email)}</a>${b.phone ? ` | ${esc(b.phone)}` : ''} |
        <a href="${esc(b.url)}">${esc(strip(b.url))}</a> |
        <a href="${esc(byNet.LinkedIn)}">${esc(strip(byNet.LinkedIn))}</a> |
        <a href="${esc(byNet.GitHub)}">${esc(strip(byNet.GitHub))}</a>
      </p>
      <p class="avail">${esc(t(b.availability.text, lang))} | ${esc(t(b.location.region, lang))}, ${esc(t(b.workMode, lang)).replace(/^./, (c) => c.toLowerCase())} | ${esc(t(b.contract, lang))}</p>
    </div>
    ${photo ? `<img class="photo" src="${photo}" alt="${esc(b.name)}" />` : ''}
  </header>

  <section>
    <h2>${L.profile}</h2>
    <p class="summary">${esc(t(variant?.summary ?? b.summary, lang))}</p>
  </section>

  <section>
    <h2>${L.experience}</h2>
    <div class="job">
      <div class="job-head"><h3>${esc(current.position)} <span>· ${esc(current.company)}</span></h3><span class="when">${esc(range(current.startDate, current.endDate, lang, L))}</span></div>
      <p class="job-sum">${esc(t(current.summary, lang))} ${L.officialTitle}: ${esc(current.officialTitle)}.</p>
      <ul>${sortByFocus(current.highlights, focus).map((h) => `<li><strong>${esc(t(h.title, lang))}:</strong> ${esc(t(h.text, lang))}</li>`).join('')}</ul>
    </div>
  </section>

  <section>
    <h2>${L.projects}</h2>
    ${projects.map((pr) => `<div class="proj">
      <h3>${esc(t(pr.name, lang))}${pr.links?.[0] ? ` <a href="${esc(pr.links[0].url)}">${esc(linkText(pr.links[0].url))}</a>` : ''}</h3>
      <p>${pr.cvSummary ? esc(t(pr.cvSummary, lang)) : `${esc(t(pr.summary, lang))}${pr.metrics ? ` <span class="metric">${esc(pr.metrics.map((m) => `${m.value}: ${m.label}`).join('; '))}.</span>` : ''}`}</p>
    </div>`).join('\n    ')}
    <p class="more">${L.allProjects}: <a href="${esc(b.url)}#projects">${esc(strip(b.url))}/#projects</a></p>
  </section>

  <section>
    <h2>${L.earlierExperience}</h2>
    ${rest.map((w) => job(w, w.highlights)).join('\n    ')}
    <div class="job">
      <div class="job-head"><h3>${L.earlierCad} <span>· ${esc(cad.map((w) => w.company).join(', '))}</span></h3><span class="when">${esc(range(cad[cad.length - 1].startDate, cad[0].endDate, lang, L))}</span></div>
      <ul>${cad.map((w) => `<li><strong>${esc(w.position)}, ${esc(w.company)}.</strong> ${esc(t(w.highlights[0].text, lang))}</li>`).join('')}</ul>
    </div>
  </section>

  <section class="avoid-break">
    <h2>${L.skills}</h2>
    <dl class="skills">
      ${p.skills.filter((s) => s.cv !== false).map((s) => `<div><dt>${esc(t(s.name, lang))}</dt><dd>${esc(s.keywords.join(', '))}</dd></div>`).join('\n      ')}
    </dl>
  </section>

  <section class="cols avoid-break">
    <div>
      <h2>${L.education}</h2>
      <ul class="plain">${p.education.map((e) => `<li><strong>${esc(t(e.studyType, lang))}, ${esc(t(e.area, lang))}</strong><br />${esc(t(e.institution, lang))}, ${esc(e.startDate === e.endDate ? e.startDate : `${e.startDate}–${e.endDate}`)}</li>`).join('')}</ul>
      <h2>${L.languages}</h2>
      <p>${p.languages.map((l) => `<strong>${esc(t(l.language, lang))}</strong> ${esc(t(l.fluency, lang))}`).join(' · ')}</p>
    </div>
    <div>
      <h2>${L.certificates}</h2>
      <ul class="plain">${p.certificates.filter((c) => c.cv !== false).map((c) => `<li>${esc(c.name)}${c.issuer ? `, ${esc(c.issuer)}` : ''}${c.date ? ` (${esc(c.date)})` : ''}</li>`).join('')}</ul>
      <h2>${L.awards}</h2>
      <ul class="plain">${p.awards.map((a) => `<li>${esc(t(a.title, lang))} (${esc(a.date)})</li>`).join('')}${p.publications.map((x) => `<li>${esc(t(x.role, lang))}: <em>${esc(x.name)}</em></li>`).join('')}</ul>
    </div>
  </section>

  <p class="consent">${esc(L.consent)}</p>
</main>
</body>
</html>
`;
}

/* ─── Markdown CV ─── */

function cvMarkdown(p, lang, variant) {
  const b = p.basics;
  const L = p.labels[lang];
  const focus = variant?.focusTags;
  const current = p.work[0];
  const out = [];
  const push = (...lines) => out.push(...lines);

  push(`# ${b.name}`, '', t(b.headline, lang), '');
  push(`- Email: ${b.email}${b.phone ? ` · Phone: ${b.phone}` : ''}`);
  push(`- ${L.portfolio}: ${b.url}`);
  for (const x of b.profiles) push(`- ${x.network}: ${x.url}`);
  push(`- ${lang === 'pl' ? 'Lokalizacja' : 'Location'}: ${t(b.location.region, lang)} · ${t(b.workMode, lang)}`);
  push(`- ${L.availability}: ${t(b.availability.text, lang)}`);
  push(`- ${lang === 'pl' ? 'Forma współpracy' : 'Contract'}: ${t(b.contract, lang)}`);
  push(`- ${lang === 'pl' ? 'Szukane role' : 'Target roles'}: ${b.targetRoles.join(', ')}`, '');

  push(`## ${L.profile}`, '', t(variant?.summary ?? b.summary, lang), '');

  const jobMd = (w) => {
    push(`### ${w.position} · ${w.company}${w.location ? `, ${w.location}` : ''} (${range(w.startDate, w.endDate, lang, L)})`, '');
    if (w.officialTitle) push(`${L.officialTitle}: ${w.officialTitle}. ${t(w.summary, lang)}`, '');
    const hl = w === current ? sortByFocus(w.highlights, focus) : w.highlights;
    for (const h of hl) push(h.title ? `- **${t(h.title, lang)}:** ${t(h.text, lang)}` : `- ${t(h.text, lang)}`);
    push('');
  };

  push(`## ${L.experience}`, '');
  jobMd(current);

  push(`## ${L.projects}`, '');
  const featured = variant?.projects ? cvProjects(p, variant) : p.projects.filter((x) => x.tier === 'featured');
  for (const pr of sortByFocus(featured, focus)) {
    push(`### ${t(pr.name, lang)}`, '');
    push(t(pr.summary, lang), '');
    if (pr.metrics) push(`Results: ${pr.metrics.map((m) => `${m.value} (${m.label})`).join('; ')}.`, '');
    if (pr.bullets && lang === 'en') { for (const x of pr.bullets) push(`- ${x}`); push(''); }
    if (pr.credit && lang === 'en') push(`Credit: ${pr.credit.replace(/`/g, '')}`, '');
    push(`Stack: ${pr.stack.join(', ')}`);
    if (pr.links) push(`Code: ${pr.links[0].url}`);
    push('');
  }
  push(`### ${lang === 'pl' ? 'Prywatne repozytoria (kod do pokazania na rozmowie)' : 'Private repositories (code shown on request)'}`, '');
  for (const pr of p.projects.filter((x) => x.tier === 'private')) push(`- ${t(pr.name, lang)}: ${t(pr.summary, lang)} (${pr.stack.join(', ')})`);
  push('', `### ${lang === 'pl' ? 'Wcześniejsze eksperymenty' : 'Earlier experiments'}`, '');
  for (const pr of p.projects.filter((x) => x.tier === 'earlier')) push(`- [${t(pr.name)}](${pr.links[0].url}): ${t(pr.summary)} (${pr.stack.join(', ')})${pr.links.slice(1).map((l) => ` ${l.label}: ${l.url}`).join('')}`);
  push('');

  push(`## ${L.earlierExperience}`, '');
  for (const w of p.work.slice(1)) jobMd(w);

  push(`## ${L.skills}`, '');
  for (const s of p.skills.filter((x) => x.cv !== false)) push(`- ${t(s.name, lang)}: ${s.keywords.join(', ')}`);
  push('', `## ${L.education}`, '');
  for (const e of p.education) push(`- ${t(e.studyType, lang)}, ${t(e.area, lang)}, ${t(e.institution, lang)} (${e.startDate === e.endDate ? e.startDate : `${e.startDate}–${e.endDate}`})`);
  push('', `## ${L.languages}`, '');
  for (const l of p.languages) push(`- ${t(l.language, lang)}: ${t(l.fluency, lang)}`);
  push('', `## ${L.certificates}`, '');
  for (const c of p.certificates.filter((x) => x.cv !== false)) push(`- ${c.name}${c.issuer ? `, ${c.issuer}` : ''}${c.date ? ` (${c.date})` : ''}`);
  push('', `## ${L.awards}`, '');
  for (const a of p.awards) push(`- ${t(a.title, lang)} (${a.date})`);
  for (const x of p.publications) push(`- ${t(x.role, lang)}: ${x.name}`);
  push('', '---', '', L.consent, '');
  return out.join('\n');
}

/* ─── JSON Resume, llms.txt, sitemap, robots ─── */

function resumeJson(p) {
  const b = p.basics;
  const base = p.meta.canonical;
  const out = {
    $schema: 'https://raw.githubusercontent.com/jsonresume/resume-schema/v1.0.0/schema.json',
    basics: {
      name: b.name,
      label: t(b.headline),
      image: abs_url(b.image, base),
      email: b.email,
      url: b.url,
      summary: t(b.summary),
      location: { countryCode: b.location.countryCode, region: t(b.location.region) },
      profiles: b.profiles,
    },
    work: p.work.map((w) => ({
      name: w.company,
      position: w.officialTitle ? `${w.position} (${w.officialTitle})` : w.position,
      ...(w.location && { location: w.location }),
      startDate: w.startDate,
      ...(w.endDate && { endDate: w.endDate }),
      ...(w.summary && { summary: t(w.summary) }),
      highlights: w.highlights.map((h) => t(h.text)),
    })),
    education: p.education.map((e) => ({ institution: t(e.institution), area: t(e.area), studyType: t(e.studyType), startDate: e.startDate, endDate: e.endDate })),
    awards: p.awards.map((a) => ({ title: t(a.title), date: a.date })),
    certificates: p.certificates.map((c) => ({ name: c.name, ...(c.issuer && { issuer: c.issuer }), ...(c.date && { date: c.date }) })),
    publications: p.publications.map((x) => ({ name: x.name })),
    skills: p.skills.map((s) => ({ name: t(s.name), keywords: s.keywords })),
    languages: p.languages.map((l) => ({ language: t(l.language), fluency: t(l.fluency) })),
    projects: p.projects.filter((x) => x.tier !== 'earlier').map((x) => ({
      name: t(x.name),
      description: t(x.summary),
      ...(x.bullets && { highlights: x.bullets }),
      keywords: x.stack,
      ...(x.links && { url: x.links[0].url }),
      type: x.visibility === 'public' ? 'public repository' : 'private repository',
    })),
    meta: {
      canonical: `${base}resume.json`,
      version: 'v1.0.0',
      lastModified: p.meta.updated,
      availability: t(b.availability.text),
      workMode: t(b.workMode),
      contract: t(b.contract),
      targetRoles: b.targetRoles,
    },
  };
  return `${JSON.stringify(out, null, 2)}\n`;
}

function llmsTxt(p) {
  const b = p.basics;
  const base = p.meta.canonical;
  const current = p.work[0];
  const pub = p.projects.filter((x) => x.tier === 'featured');
  const lines = [
    `# ${b.name}`,
    '',
    `> ${b.label} in ${t(b.location.region)} building LLM applications, RAG and agents for manufacturing and engineering data. TypeScript, Python, Go. ${t(b.availability.text)}. ${t(b.workMode)}. ${t(b.contract)}.`,
    '',
    'Key facts:',
    '',
    `- Current role: ${current.position} (official title: ${current.officialTitle}) at ${current.company} since ${range(current.startDate, null, 'en', p.labels.en).split(' – ')[0]}. ${t(current.summary)}`,
    `- Built there: ${current.highlights.map((h) => t(h.title)).join('; ')}.`,
    '- Earlier: four years of TypeScript and React (fintech, web3, React Native), three and a half years of automotive CAD engineering (CATIA V5, NX, GD&T, D-FMEA).',
    `- Measured results: ${p.proof.filter((x) => !x.live).map((x) => `${x.value} (${x.label})`).join('; ')}.`,
    `- Languages: ${p.languages.map((l) => `${t(l.language)}: ${t(l.fluency)}`).join('; ')}.`,
    `- Target roles: ${b.targetRoles.join(', ')}.`,
    `- Contact: ${b.email} · ${b.profiles.map((x) => x.url).join(' · ')}`,
    '',
    '## CV',
    '',
    `- [CV in Markdown, English](${base}${FILES.mdEn}): full experience, projects, skills, education`,
    `- [CV in Markdown, Polish](${base}${FILES.mdPl}): the same CV in Polish`,
    `- [JSON Resume](${base}resume.json): structured data, JSON Resume 1.0 schema`,
    `- [CV PDF, English](${base}${FILES.pdfEn})`,
    `- [CV PDF, Polish](${base}${FILES.pdfPl})`,
    '',
    '## Public projects',
    '',
    ...pub.map((x) => `- [${t(x.name)}](${x.links[0].url}): ${t(x.summary)}${x.metrics ? ` Results: ${x.metrics.map((m) => `${m.value} (${m.label})`).join('; ')}.` : ''}`),
    '',
    '## Optional',
    '',
    `- [Portfolio page](${base}): the same content as a web page, with a live commit graph`,
    ...b.profiles.map((x) => `- [${x.network}](${x.url})`),
    '',
  ];
  return lines.join('\n');
}

function sitemap(p) {
  const base = p.meta.canonical;
  const pages = ['', FILES.htmlEn.replace('index.html', ''), FILES.htmlPl, FILES.mdEn, FILES.mdPl, 'resume.json', 'llms.txt'];
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${pages.map((x) => `  <url><loc>${base}${x}</loc><lastmod>${p.meta.updated}</lastmod></url>`).join('\n')}
</urlset>
`;
}

const robots = (p) => `User-agent: *\nAllow: /\n\nSitemap: ${p.meta.canonical}sitemap.xml\n`;

/* ─── Link check (network) ─── */

async function checkLinks(p) {
  let bad = 0;
  for (const url of collectUrls(p)) {
    let status;
    try {
      const ctl = AbortSignal.timeout(15000);
      let res = await fetch(url, { method: 'HEAD', redirect: 'follow', signal: ctl });
      if (res.status >= 400) res = await fetch(url, { method: 'GET', redirect: 'follow', signal: AbortSignal.timeout(15000) });
      status = res.status;
    } catch (e) { status = e.name; }
    const ok = status === 200 || status === 999; // LinkedIn answers bots with 999
    if (!ok) bad++;
    console.log(`${ok ? 'ok ' : 'BAD'} ${status} ${url}`);
  }
  return bad;
}

/* ─── Main ─── */

function outputs(profile) {
  const p = withLang(profile, 'en');
  const pl = withLang(profile, 'pl');
  const index = fillRegions(fs.readFileSync(abs('index.html'), 'utf8'), siteRegions(p));
  return {
    'index.html': index,
    [FILES.htmlEn]: cvHtml(p, 'en'),
    [FILES.htmlPl]: cvHtml(pl, 'pl'),
    [FILES.mdEn]: cvMarkdown(p, 'en'),
    [FILES.mdPl]: cvMarkdown(pl, 'pl'),
    'resume.json': resumeJson(p),
    'llms.txt': llmsTxt(p),
    'sitemap.xml': sitemap(p),
    'robots.txt': robots(p),
  };
}

async function main() {
  const profile = JSON.parse(fs.readFileSync(abs('data/profile.json'), 'utf8'));
  const errors = validate(profile);
  if (errors.length) {
    console.error(`data/profile.json is invalid:\n  ${errors.join('\n  ')}`);
    process.exit(1);
  }

  const variantPath = arg('--variant');
  if (variantPath) {
    const vp = path.resolve(variantPath);
    const v = JSON.parse(fs.readFileSync(vp, 'utf8'));
    const lang = v.lang || 'en';
    const merged = withLang(deepMerge(profile, v.overrides || {}), lang);
    const name = v.outName || `Adrian-Gora-CV-${lang.toUpperCase()}`;
    const dir = path.dirname(vp);
    fs.writeFileSync(path.join(dir, `${name}.html`), cvHtml(merged, lang, v));
    fs.writeFileSync(path.join(dir, `${name}.md`), cvMarkdown(merged, lang, v));
    console.log(`wrote ${path.relative(ROOT, path.join(dir, name))}.{html,md}; print with: node scripts/cv-pdf.js ${path.relative(ROOT, path.join(dir, `${name}.html`))}`);
    return;
  }

  const files = outputs(profile);
  if (has('--check')) {
    const stale = Object.entries(files).filter(([f, c]) => !fs.existsSync(abs(f)) || fs.readFileSync(abs(f), 'utf8') !== c).map(([f]) => f);
    if (!process.env.CI) {
      for (const [html, pdf] of [[FILES.htmlEn, FILES.pdfEn], [FILES.htmlPl, FILES.pdfPl]]) {
        if (!fs.existsSync(abs(pdf)) || fs.statSync(abs(pdf)).mtimeMs < fs.statSync(abs(html)).mtimeMs) console.warn(`warn: ${pdf} is older than ${html}; run npm run cv:pdf`);
      }
    }
    if (stale.length) {
      console.error(`stale outputs (run npm run build):\n  ${stale.join('\n  ')}`);
      process.exit(1);
    }
    console.log('all outputs match data/profile.json');
  } else {
    const changed = Object.entries(files).filter(([f, c]) => !fs.existsSync(abs(f)) || fs.readFileSync(abs(f), 'utf8') !== c);
    for (const [f, c] of changed) {
      fs.mkdirSync(path.dirname(abs(f)), { recursive: true });
      fs.writeFileSync(abs(f), c);
    }
    console.log(changed.length ? `wrote ${changed.map(([f]) => f).join(', ')}` : 'no changes');
    if (changed.some(([f]) => f.startsWith('cv/'))) console.log('CV changed: run npm run cv:pdf');
  }

  if (has('--links')) {
    const bad = await checkLinks(profile);
    if (bad) { console.error(`${bad} link(s) failed`); process.exit(1); }
  }
}

main().catch((e) => { console.error(e.message); process.exit(1); });
