# AGENTS.md

Portfolio and CV of Adrian Góra, served by GitHub Pages from `master` at https://adagora.github.io/. Static files, no framework, no dependencies; Node ≥ 20.

## Source of truth

`data/profile.json` holds every fact about Adrian. `scripts/build.js` renders it into:

| Output | Reader |
|---|---|
| `index.html`, regions between `<!-- build:NAME -->` markers | people and crawlers (static HTML + JSON-LD) |
| `cv/index.html`, `cv/pl.html`, printed to `cv/*.pdf` | recruiters (print CV, EN and PL) |
| `cv.md`, `cv.pl.md`, `resume.json`, `llms.txt` | applicant tracking systems and AI assistants |
| `sitemap.xml`, `robots.txt` | crawlers |

Generated files are outputs: change the data or the renderer, then rebuild; a hand edit to an output is overwritten. Outside the build regions `index.html` is an ordinary template holding the layout, nav and the activity section.

A text field is a string or `{ "en": …, "pl": … }`; Polish output falls back to English when `pl` is missing. A highlight's `text` continues its bold `title`, so it never repeats it. `"cv": false` on a skill group or certificate keeps it on the site and out of the CVs.

The CVs Adrian sends carry his phone number and live in `private/cv-send/`; rebuild them with `--variant private/cv-send/en.json` (and `pl.json`) after every CV change.

## Change loop

1. Edit `data/profile.json` for content, `scripts/build.js` or `css/*.css` for presentation.
2. `npm run build`; when CV content changed, also `npm run cv:pdf` (needs local Chrome).
3. `npm run check` is green. CI runs the same check on every push.
4. Look at the result: `npm run serve` for the site; `pdftoppm -png -r 70 cv/<file>.pdf` for the CVs.

Done means: check green, both PDFs regenerated and exactly 2 A4 pages (`pdfinfo cv/*.pdf`), and the page renders cleanly at 390 px and 1440 px wide.

## Rules the data encodes

- A public project links to its code; a private project carries no repo link, since visitors would hit a 404. Validation enforces this.
- Every number shown has a source a recruiter can follow (a README, a benchmark). A new number arrives together with its source.
- Wiśniowski work is described in words; its code stays private until Adrian confirms the employer agreed to more.
- Public files carry email, LinkedIn and GitHub as contact data. A phone number goes only into private variants.
- Salary expectations live only in `private/`.

## Tailoring a CV for one job offer

Each application gets a folder `private/applications/<yyyy-mm-dd>-<company>/` (gitignored).

1. Save the offer text as `offer.md` there.
2. Write `variant.json`:
   ```json
   {
     "lang": "en",
     "outName": "Adrian-Gora-CV-Company",
     "focusTags": ["rag", "evals"],
     "projects": ["visual-rag", "cad-quote", "translate-audit"],
     "summary": { "en": "Profile paragraph aimed at this offer" },
     "overrides": { "basics": { "phone": "+48 …" } }
   }
   ```
   `focusTags` reorder current-role highlights and projects by tag overlap (tags live on each highlight and project). `projects` picks CV projects by id. `overrides` deep-merges into the profile; arrays replace.
3. `node scripts/build.js --variant private/applications/<dir>/variant.json`, then `node scripts/cv-pdf.js private/applications/<dir>/<outName>.html`; the PDF stays at 2 pages.
4. Append a row to `private/applications/log.csv`: `date,company,role,channel,cv_file,status,next_step`.

The tailored summary uses only facts already in `data/profile.json` and borrows the offer's wording wherever a fact matches it.

## Writing style for published text

Plain and checkable: a concrete number or named tool beats an adjective. Prose uses commas, colons and semicolons; en dashes appear only in ranges.

## Other moving parts

- `.github/workflows/commit-stats.yml` runs `scripts/generate-commit-stats.js` daily and commits `data/commit-stats.json` and `data/recent-activity.json`. It publishes only the repo count and strips links from private-repo commits. Pull before editing; the bot commits every morning.
- `.nojekyll` makes Pages serve `.md` and `.txt` files as plain files.
