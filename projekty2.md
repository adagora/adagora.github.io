1. wiki-llm-with-markdown-editor
# pdf-wiki

A local-first, file-based knowledge base built from PDFs. Drop a PDF into `raw/`, run `/ingest`, get a cross-linked markdown wiki you can search semantically with [qmd](https://github.com/tobi/qmd).

## Pipeline (two paths, same output)

```
                                          ┌─────── API key path ─────────┐
raw/<file>.pdf ──┬─ npm run extract ──── extracted/<slug>.md ── /ingest <slug>
                 │                                                       │
                 │  ┌──── subscription-only path ────┐                    │
                 └──┴─ /ingest-pdf <slug> ───────────┴────────────────────┤
                                                                          │
              (optional, both paths)                                      ▼
              npm run extract-images ──► wiki/assets/<slug>/*.png + manifest.json
                                                                          │
                                                              wiki/pages/*.md
                                                                          │
                                                       npm run linkify  ──┤
                                                       npm run reindex  ──┤  (regen wiki/index.md)
                                                       npm run embed    ──┘  (refresh qmd vectors)
```

- **API key path**: faster for big PDFs, no page limit, scriptable. Needs `ANTHROPIC_API_KEY`.
- **Subscription path**: no API key, uses Claude Code's `Read` tool natively. Best for PDFs ≤60 pages.
- **Figures**: Claude Sonnet 4.6's vision describes every figure inline as a `> [!figure]` block. Optionally extract image PNGs via Poppler's `pdfimages` for high-fidelity references.

## Setup

```sh
# 1. Install Node deps
npm install

# 2. (API-key path only) Set the Claude API key.
#    Skip this step if you'll only use /ingest-pdf — the subscription path
#    doesn't need an API key.
export ANTHROPIC_API_KEY=sk-ant-...        # or set via your secret manager

# 3. Install qmd globally (optional, for semantic search)
npm install -g @tobilu/qmd
npm run embed                              # initial vector index, may take a few minutes

# 4. Verify the qmd MCP server is registered with Claude Code
#    (already wired via .mcp.json in this repo)
claude mcp list
```

## Daily flow

```sh
# Drop a PDF in raw/
cp ~/Downloads/some-report.pdf raw/

# === API key path ===
npm run extract         -- raw/some-report.pdf
npm run extract-images  -- raw/some-report.pdf   # optional, needs Poppler
npm run parameter-index -- some-report           # optional: drafts/<slug>-parameter-index.md from tables
# in a Claude Code session at the repo root:
/ingest some-report

# === or subscription-only path ===
# in a Claude Code session at the repo root:
/ingest-pdf some-report

# === both paths converge here ===
npm run linkify       # auto-insert [[slug]] cross-refs into page bodies
npm run reindex       # regenerate wiki/index.md from frontmatter
npm run embed         # refresh the qmd vector index
npm run lint          # health check (mechanical pass)

# Before committing or continuing after LLM-authored edits:
npm run review-changes                   # terminal review of pending changes
npm run review-changes -- --html --open   # self-contained visual diff review
npm run review-changes -- --slides --open # presentation-style review deck
```

Inside a Claude Code session you can also run `/query <question>` for cited semantic search, `/lint` for the agentic version of the health check, `/overview` to refresh `wiki/overview.md` (it auto-runs after every `/ingest`; use `--rebuild` for a full re-derive), `/decide [<title>]` to author an Architecture Decision Record (`type: decision`, auto-incremented `DEC-NNN`), and `/wrap` at session-end to file back any insight that emerged from the conversation (cross-source synthesis, contradictions, missing concept pages).

For **large product manuals** with lots of tables (parameters, limits, pricing, part numbers), the ingest agent is expected to create a dedicated `type: analysis` **parameter/spec index page** (e.g. `analysis-<product>-parameters`) that rolls up the table rows with **source PDF page citations**. This makes recall-heavy questions like "list every parameter" deterministic instead of relying on retrieval alone. Before accepting user or LLM edits, run `npm run review-changes` for a terminal checkpoint, `npm run review-changes -- --html --open` for a visual diff-review page, or `npm run review-changes -- --slides --open` for a presentation-style review deck. For unattended maintenance, `npm run audit` produces a date-stamped report at `wiki/audits/YYYY-MM-DD.md` (mechanical mode out of the box; LLM-synthesised "patterns" section when `ANTHROPIC_API_KEY` is set).

### Extracting figure PNGs (optional)

`npm run extract-images` shells out to Poppler's `pdfimages`. Install once:

```sh
# Windows
scoop install poppler          # or: choco install poppler

# macOS
brew install poppler

# Linux
sudo apt install poppler-utils
```

PNGs land in `wiki/assets/<slug>/` with a `manifest.json` mapping each file to its source page and per-page index. Filenames are `fig-<page>-<num>.png` with no zero-padding (e.g. `fig-1-1.png`, `fig-12-15.png`). The `pdf-author` subagent copies exact filenames from the manifest into `![alt](../assets/<slug>/<file>)` references on figure-heavy pages.

> Re-running `npm run extract-images` wipes and rebuilds `wiki/assets/<slug>/`. Don't hand-edit that directory — copy images out first if you need to reference them elsewhere.

### Extracting from image folders (engineering diagrams, slide decks, scanned forms)

For sources that arrive as a folder of images rather than a PDF, use:

```sh
cp -r ~/Downloads/q4-architecture-diagrams raw/q4-arch
npm run extract-from-images -- raw/q4-arch/
/ingest q4-arch
```

This produces `extracted/q4-arch.md` with a `> [!figure]` block per image — the same shape `npm run extract` produces from PDFs, so the existing `/ingest <slug>` flow works unchanged. Each image is resized to 800px max dimension and processed in batches of 4 through Claude Sonnet 4.6 (the cost/quality sweet spot. Use `--dry-run` to verify the prep pipeline without burning API credits.

Prerequisites:

```sh
# macOS — sips is built in, nothing to install
# Linux
sudo apt install imagemagick

# Windows
scoop install imagemagick
```

Supported formats: `.png`, `.jpg`/`.jpeg`, `.webp`, `.gif`, `.heic`/`.heif`/`.hif` (auto-converted to JPEG).

## Layout

| Path | Purpose | Edit by |
|---|---|---|
| `raw/` | Immutable PDF and image source inputs | Human, drop only |
| `drafts/` | Collaborative markdown drafts before wiki promotion | jot + human/agent review |
| `extracted/` | PDF → markdown, regenerable | `npm run extract` |
| `wiki/pages/` | Curated concept/entity/source pages | Claude Code subagent + human |
| `wiki/assets/<slug>/` | Figure PNGs + `manifest.json` | `npm run extract-images` |
| `wiki/index.md` | Category index | Subagent on every ingest |
| `wiki/log.md` | Append-only operations log | Subagent on every ingest |
| `wiki/overview.md` | Cross-source synthesis | Human, occasionally |
| `wiki/reviews/` | Generated local HTML diff-review artifacts | `npm run review-changes -- --html` |
| `scripts/` | Extraction + images + linkify + lint + review tools | TypeScript, edit freely |
| `.claude/` | Slash commands + subagents | Edit freely |
| `CLAUDE.md` | Auto-loaded project context | Edit when conventions change |
| `SCHEMA.md` | Page frontmatter + slug rules | Edit when conventions change |
| `qmd.yml` | qmd collection config | Edit when adding collections |
| `.mcp.json` | Wires qmd MCP into Claude Code | Edit when adding MCP servers |

See [`SCHEMA.md`](./SCHEMA.md) for the page frontmatter and slug conventions.

## Collaborative drafts with jot

This repo vendors [`jot/`](./jot), a minimal collaborative markdown editor for draft documents. Use it to review, edit, and comment on markdown before durable knowledge is promoted into `wiki/pages/`.

Run it from the repo root:

```sh
npm run jot:dev    # development server, workspace in ./drafts
npm run jot:serve  # production-style server, workspace in ./drafts
```

Jot writes markdown drafts into `drafts/` and keeps auth/comment metadata in ignored `data/`. Keep `raw/` for immutable source inputs; keep `wiki/pages/` for curated knowledge.

## License

MIT (your choice — adjust if your enterprise prefers Apache-2.0).

2. cad-tools
---
name: wycena
description: Wycena, preflight i ocena technologiczna detalu obrabianego mechanicznie dla narzędziowni na podstawie modelu 3D STEP/STP i (opcjonalnie) rysunku 2D. Użyj, gdy użytkownik prosi o wycenę detalu, kosztorys obróbki, preflight/raport wykonalności, ocenę na parku maszynowym, dobór technologii/marszruty, analizę ryzyk, decyzję o kooperacji (też SendCutSend) albo gdy występują słowa: wycena, kosztorys, preflight, kierownik narzędziowni, technolog, ile kosztuje detal, czy wykonalne, STEP do wyceny. Deterministycznie weryfikuje geometrię i czas (objętość, masa, gabaryt, fizyczny limit czasu), odświeża źródła dowodowe (download_sources.py) i wydaje ustalenia ✅/❌/❓ z cytatem źródła + bramkowany werdykt — nigdy nie zgaduje liczb z CAD ani ceny.
---

# Wycena detali

## Zasada nadrzędna

Wycena jest **hybrydowa**:

- **Geometria liczy KOD**, nie model językowy. Objętość, masa, gabaryt **i cechy kosztotwórcze** pochodzą z bryły STEP (kernel OpenCASCADE — `geometry.py` używa zweryfikowanego skilla `cad`: `step`+`inspect`). To są liczby sprawdzalne i **nigdy nie zgadywane**.
- **Cenę liczy KOD ze stawek** — `quote.py` robi tylko arytmetykę `koszt = czas × stawka`, sumuje i dolicza rezerwę/marżę. Nigdy nie wpisuj gotowej kwoty PLN „z głowy".
- **Stawki proponuje model wg rynku PL** (i są edytowalne). `config/*.toml` jest wstępnie wypełniony **szacunkiem rynkowym PL** (koszt maszyny/h, robocizna, cena materiału PLN/kg, marża) — to punkt wyjścia, nie cennik huty. Klient/technolog poprawia je wprost w `config/*.toml` **albo na bieżąco w edytowalnym raporcie HTML** (pola input przeliczają cenę tą samą formułą co `quote.py`). Jeśli znasz realne stawki firmy — wpisz je; jeśli nie, zaproponowane wartości pozwalają wydać cenę **orientacyjną**.
- **Technologię i ryzyka ocenia model** jak kierownik narzędziowni: wykonalność, marszruta, dobór maszyn, czasy, zamocowania, ryzyka, usprawnienia.

**Nigdy nie podawaj objętości ani masy „z głowy".** Jeśli nie ma wyniku ze `geometry.py` — uruchom go. Zgadnięta objętość rozsypuje całą wycenę od pierwszej cyfry. **Ceny też nie wpisuj ręcznie** — wynika z `quote.py` (stawki × czasy). Stawki możesz zaproponować wg rynku PL, ale samą kwotę zawsze liczy kod.

**Czas obróbki też ma fizyczny limit.** Godziny skrawania to najsłabsze ogniwo (geometria jest dokładna, a cena jedzie na czasie). `time_model.py` liczy z geometrii fizyczny dolny limit i rozsądny zakres czasu skrawania (objętość usuwana ÷ MRR + pole ÷ tempo wykończenia). Użyj go, by zakotwiczyć i sprawdzić swoje czasy — nie schodź poniżej minimum bez wyraźnego uzasadnienia (np. detal z gotowego półfabrykatu).

**Dyscyplina dowodowa (jak w skillu `sendcutsend`).** Źródła to **dowody**, nie API. Każde ustalenie ma **restrykcyjną etykietę** — `✅ pass` / `❌ fail` / `❓ need_info` — i **cytuje źródło** (ścieżka pola JSON, kotwica sekcji normy albo `Direct file inspection`). Brakujących/sprzecznych danych NIE zamieniaj na pass/fail → `❓ need_info`. **Werdykt jest bramkowany:** dowolny `❌ fail` lub `❓ need_info` w wymaganym wierszu ⇒ wycena NIE jest wiążąca. Skrypty liczą fakty; orzeczenie i cena wynikają z porównań, nie ze zgadywania.

## Interpreter

Cały flow działa na **jednym stosie** — silniku skilla `cad` (build123d/OCCT, **bez cadquery**): `geometry.py` woła `skills/cad/scripts/{step,inspect}`, `preview.py` rysuje SVG przez build123d, `dxf_inspect.py` mierzy przez `ezdxf`. Kanoniczny interpreter to **`./.venv/bin/python` w katalogu repo** (zgodnie z AGENTS.md):

```bash
PY=./.venv/bin/python        # repo venv ze stosem skilla cad
```

Jeśli `./.venv` nie istnieje, utwórz je i doinstaluj stos:
`python3.12 -m venv .venv && .venv/bin/pip install -e packages/cadpy trimesh ezdxf`.
Każdy inny interpreter importujący `OCP`/`build123d` też zadziała (np. starsze conda
`cadquery-env`); serwer `webapp/` wykrywa go automatycznie (priorytet:
`WYCENA_CAD_PYTHON` → bieżący → `./.venv` → środowiska conda). Sam `geometry.py` używa
**tylko biblioteki standardowej** i woła skill `cad` przez `sys.executable`; gdy skill
`cad` jest w innym interpreterze, wskaż go przez `--cad-python`.
`quote.py`/`time_model.py`/`checks.py`/`scs_check.py`/`download_sources.py`/`ledger.py`/`calibrate.py`
potrzebują tylko biblioteki standardowej (dowolny Python ≥ 3.11).

## Źródła dowodowe (odśwież przed przeglądem)

Mapa źródeł i precedencja: `references/official-sources.md`. Lokalny `config/*.toml` (park, stawki, materiały) jest **autorytatywnym katalogiem warsztatu**; źródła zewnętrzne uzupełniają go i pozwalają cytować.

```bash
$PY skills/wycena/scripts/download_sources.py            # cache 24 h
$PY skills/wycena/scripts/download_sources.py --skip-cache   # wymuś świeże
```

Pobiera do `references/generated/` + manifest (`fetched_at`/`sha256`/`cache_expires_at`/status):
- **SCS** (url) — `sendcutsend-{ordering-guide.md,catalog.json,specs.json}`: **tylko dla decyzji o kooperacji** cięcia/laser.
- **standards** (bundled) — `standards-pl.md`: ISO 2768, ISO 286 IT, Ra, gwinty M — do interpretacji rysunku.
- **material_properties** (bundled) — `material-properties.json`: gęstość + klasa/indeks skrawalności.
- **material_prices** (env_url) — ustaw `WYCENA_PRICES_URL`; bez tego cena = `config/materials.toml` (status `unconfigured`).

Cytuj po ścieżce pola / kotwicy, np. `material-properties.json grades[1.4301].machinability_pct`, `standards-pl.md#iso-286-it`. Źródło `stale`/`unconfigured` → powiedz to i nie wydawaj werdyktu wiążącego dla zależnego wiersza.

## Marszruta pracy

0. **Odśwież źródła dowodowe.** `download_sources.py` (patrz wyżej). Manifest zasili cytaty cen/świeżości w preflight i raporcie.

1. **Zweryfikuj geometrię (ZAWSZE pierwsze).**
   ```bash
   PY=./.venv/bin/python     # patrz sekcja „Interpreter"
   $PY skills/wycena/scripts/geometry.py ŚCIEŻKA/detal.stp            # czytelny raport
   $PY skills/wycena/scripts/geometry.py ŚCIEŻKA/detal.stp --json     # JSON do dalszych kroków
   ```
   - Jeśli rysunek/model **nie podaje materiału** — narzędzie przyjmuje `18G2A` i pisze to DRUKOWANYMI literami. Gdy materiał jest znany, dodaj `--material GATUNEK --material-given`.
   - Wynik daje: objętość, masę, pole powierzchni, gabaryt (bbox), **cechy kosztotwórcze** (proxy liczby zamocowań z orientacji płaszczyzn, liczba ścian/krawędzi, udział usuwanego materiału, smukłość) oraz **dopasowanie do każdej maszyny** parku (gdzie `!!` → możliwa kooperacja). Dodaj `--surface-mix`, by policzyć histogram typów powierzchni (frezowanie vs toczenie vs 5 osi).
   - Plik **złożenia** uruchom z `--assembly` — narzędzie rozbije go na bryły (`per_solid` z polem `occurrence`); **wyceniaj komponenty pojedynczo (§7)**, nie sumuj do jednej bryły.
   - **Pliki siatkowe (.stl/.3mf/.obj/.ply)** czyta `trimesh` (te same komendy `geometry.py`/`features.py`/`preview.py`, bez skilla `cad`). Siatka daje **objętość/masę/gabaryt/pole** (objętość niepewna, gdy siatka nie jest szczelna — narzędzie to zgłasza, obniż pewność §6 H), ale **NIE ma topologii BREP**: `features.py` zwraca pusty payload cech (otworów/kieszeni/ścianek/zamocowań NIE liczymy z trójkątów — nie zgadujemy), więc marszruta i wykonalność jadą na **wolumetrycznym `time_model`** (objętość+pole), a cechy obróbcze i tolerancje potwierdź z **rysunku 2D** (`detal.drawing.json`) albo poproś o model **STEP**. Cena z STL jest tym samym torem `routing.py → quote.py`, tylko grubsza — powiedz to wprost w raporcie. **Wolisz STEP/STP, gdy jest dostępny.**

1a. **Sprawdź precedens — czy robiliśmy już taki detal (analogia przed modelem).** (W5.3)
   ```bash
   $PY skills/wycena/scripts/ledger.py similar --geometry detal.geom.json   # najbliższe wcześniejsze wyceny
   ```
   Doświadczony technolog wycenia NAJPIERW przez analogię. Jeśli trafienie ma **wysokie podobieństwo i czas RZECZYWISTY** (status `made`/`invoiced`), **MASZ OBOWIĄZEK** porównać swoją marszrutę i czasy z tym precedensem i **uzasadnić każde odejście** („tamten szedł 5,5 h przy est 4 h — biorę 5 h, bo ten ma o jedną kieszeń mniej"). **Precedent bije tekstbookowe MRR** — systematyczną korektę robi kalibracja (pętla uczenia), precedens to dowód per-detal. W kroku 3 dołącz `--ledger`, a `routing.py` wstawi tę notę do bazy operacji; w raporcie pokaże się wiersz **Precedens** (wewnętrzny). Gdy rejestr pusty/brak bliźniaka — pomiń (na początku to normalne).

1b. **Policz cechy obróbcze (zasilają marszrutę i ryzyka).**
   ```bash
   $PY skills/wycena/scripts/features.py ŚCIEŻKA/detal.stp --json > detal.features.json
   ```
   Deterministycznie z BREP (ten sam silnik co `geometry.py`): **otwory** (Ø, głębokość,
   przelotowy/nieprzelotowy, oś — czopy i zaokrąglenia odfiltrowane), **kieszenie**
   (głębokość, dno, min promień naroża → max Ø freza; `0.0` = ostre naroża, sygnał
   EDM/przeprojektowania), **cienkie ścianki** (pary płaszczyzn z materiałem między,
   próg `--thin-wall-mm`), powierzchnie swobodne (5 osi) i **kierunki dostępu narzędzia**
   (uczciwszy szacunek zamocowań niż proxy orientacji płaszczyzn). Każda cecha cytuje
   selektor ściany (`#fN`) jako dowód. Czego heurystyka nie rozpozna, zostaje poza listą —
   wolumetryczny `time_model.py` i tak je kryje. **Dla siatki (.stl/.3mf) zwraca pusty payload**
   (brak BREP → brak cech; patrz nota w kroku 1) — uruchom i tak, by dać `routing.py` wejście.

2. **Przeczytaj rysunek 2D i ZAPISZ fakty jako `detal.drawing.json`** (PDF/obraz). Wyłap to, czego nie ma w modelu: materiał, tolerancje (IT), pasowania, chropowatość (Ra), gwinty, obróbkę cieplną, powłoki, wymagania kontrolne — to główne czynniki kosztotwórcze. **Nie zostawiaj ich w prozie**: schemat i przykład w `references/metoda-wyceny.md` §3c (`examples/crank.drawing.json`). Każdy fakt cytuje normę (`standards-pl.md#iso-286-it`, `#ra-finish`, `#iso-metric-threads`) albo pole rysunku. Gdy rysunku brak — nie twórz pliku; preflight uczciwie zgłosi `❓` przy założonym materiale.

2b. **Uruchom deterministyczny preflight (ustalenia z cytatem źródła).**
   ```bash
   $PY skills/wycena/scripts/checks.py --geometry detal.geom.json --estimate detal.estimate.json \
       --drawing detal.drawing.json --features detal.features.json \
       --manifest skills/wycena/references/generated/sources-manifest.json
   ```
   Zwraca wiersze `✅ pass / ❌ fail / ❓ need_info`, każdy z `rule_source`, oraz **werdykt bramkowany**: bryłowość modelu, mieszczenie w parku (`config/machines.toml`), materiał z rysunku (rozjazd gatunku rysunek↔geometria = `❌`), gęstość/cena materiału, kompletność stawek, czas ≥ fizyczne minimum (`time_model.py`), a z `--drawing`/`--features` dodatkowo **wykonalność zdolnościową**: wymagane IT/Ra vs najlepsza MIESZCZĄCA maszyna (`it_class_min`/`ra_min_um`), ostre naroża kieszeni (frez nie wykona ⇒ EDM/kooperacja), powierzchnie swobodne vs park 5-osiowy, **procesy zewnętrzne z rysunku skonfrontowane z cennikiem kooperacji** (`config/cooperation.toml`: w cenniku + linia w oszacowaniu ⇒ `✅`; w cenniku, ale brak linii ⇒ `❌`; brak w cenniku ⇒ `❓`), zgodność nazw maszyn oszacowania z parkiem. Cienkie ścianki to wiersz **informacyjny** (`required=false`) — nie blokuje werdyktu, zostaje dla technologa. (Estymatę z `--estimate` dołącz, gdy już ją zbudujesz w kroku 4 — preflight można uruchomić dwukrotnie.)

2c. **Przy każdym `❌ fail` wygeneruj DIAGRAM (proaktywnie, jak `sendcutsend`).**
   ```bash
   $PY skills/wycena/scripts/diagnose.py --geometry detal.geom.json --estimate detal.estimate.json \
       --drawing detal.drawing.json --features detal.features.json --json > detal.diagnose.json
   ```
   Tworzy samodzielny SVG dla każdej rysowalnej przyczyny `❌ fail` (dispatch po `code` z `checks.py`): **gabaryt poza parkiem**, **czas < fizyczne minimum**, **zdolność IT/Ra** (drabina maszyn vs wymóg rysunku — gorsze na czerwono, cytat `[machine].it_class_min/ra_min_um`; **dołącz `--drawing`**), **udźwig** (masa detalu vs `max_workpiece_kg` maszyn), **naroże kieszeni** (przekrój: głębokość vs promień → max frez Ø + wysięg L/D; ostre R0 → EDM; **dołącz `--features`**) i **krok kooperacji** (łańcuch zgrubna → PROCES ZEWN.(czerwony) → wykończenie). Nie czekaj, aż użytkownik poprosi — dołącz do raportu przez `report.py --diagnose detal.diagnose.json` (osadza SVG przy sekcji preflight). SVG wektorowy, samodzielny (jak `preview.py`).

3. **WYGENERUJ marszrutę (kod proponuje), potem ją ZRECENZUJ jak technolog.**
   ```bash
   $PY skills/wycena/scripts/routing.py --geometry detal.geom.json --features detal.features.json \
       --drawing detal.drawing.json --quantity N --ledger wycena/ledger/ledger.jsonl --json > detal.estimate.json
   ```
   `routing.py` składa marszrutę deterministycznie wg `references/routing-rules.md` (cytuje reguły
   po kotwicach): klasyfikuje kształt (płyta/wałek/pryzma/5-osi), dobiera wsad i przygotówkę,
   sekwencjonuje operacje (przygotówka → zgrubna → [hartowanie kooperacja] → wykończenie → [szlif po HT]
   → ślusarnia → kontrola), **dobiera maszynę ze zdolności parku** (typ/gabaryt/udźwig; IT/Ra przez
   szlif, nie przez frezarkę; CNC vs konwencjonalna wg serii/cech/IT), liczy czasy przez `time_model`
   v2 i dokleja linie kooperacji z rysunku. Wyjście to **gotowy `estimate.json`** dla `quote.py`.
   **Detale płaskie (blacha) — dołącz `--dxf detal.dxf`** (W4.6): zamiast szacunku przygotówki z
   bbox `routing.py` użyje DETERMINISTYCZNEGO modelu cięcia plazmą AJAN SHP 260: czas = długość
   ścieżki cięcia (z `dxf_inspect.py`, warstwy gięcia/konstrukcyjne pominięte) ÷ posuw(materiał,
   grubość) + przebicia × czas + obsługa (`config/machining.toml [plasma]`), nest-aware masa arkusza,
   oraz **bramkowane ustalenie zdolności grubości** (cytuje `machines.toml`/`machining.toml`) —
   grubość poza zdolnością → `❌ fail` + propozycja kooperacji. Standalone: `plasma.py detal.dxf
   --material S235JR --thickness 5 --json`. Wynik (`routing_meta.plasma`) wyceniany jest **istniejącą
   ścieżką `quote.py`** (czas × stawka) — bez równoległego modelu kosztu.
   **Twoja rola = RECENZJA:** możesz edytować godziny/operacje/maszyny, ale każde odejście od
   wygenerowanej wartości uzasadnij jednym zdaniem; nie schodź poniżej `time_model` floor; nazwy
   maszyn muszą zostać zgodne z `machines.toml`. Każda operacja niesie `basis` (cytat reguły,
   cechy, pewność, alternatywy) — przejrzyj je. Persona i kryteria oceny: `references/metoda-wyceny.md`.
   **Oddziel: pewne / założenia / ryzyka / braki danych** w narracji (analysis.json, krok 6).

4b. **Zakotwicz czasy fizyką (przed liczeniem ceny).**
   ```bash
   $PY skills/wycena/scripts/time_model.py --geometry detal.geom.json --estimate detal.estimate.json \
       --features detal.features.json --drawing detal.drawing.json   # kompozycja per cecha (celniejszy zakres)
   ```
   Z `--features` anchor liczy **kompozycję per cecha**: wiercenie (penetracja×głębokość+dojazd,
   peck >3×Ø), gwinty (z rysunku), kieszenie (MRR deratowane wymuszonym Ø freza z promienia
   naroża), szlif (gdy rysunek żąda Ra ≤ 0.8) + wymiany narzędzi — a resztę objętości kryje
   model blob. 40 małych głębokich otworów kosztuje wielokrotnie więcej niż ich cm³ — blob
   tego nie widzi, kompozycja tak. Blob pozostaje twardym sanity-bandem. Bez `--features`
   działa klasyczny anchor objętościowy:
   Liczy z geometrii fizyczny **dolny limit / typowy / górny** zakres czasu skrawania (objętość usuwana ÷ MRR materiału + pole ÷ tempo wykończenia; proces frezowanie/toczenie i wsad `block/bar/net` dobierane automatycznie lub przez `--process`/`--stock-mode`). Z `--estimate` porównuje Σ godzin operacji z zakresem i zwraca `flags`: poziom `blad`, gdy czas jest **poniżej fizycznego minimum** (nie da się usunąć tylu cm³ szybciej), `uwaga` przy zaniżeniu/zawyżeniu. Jeśli pojawi się `blad` — popraw czasy w oszacowaniu i licz cenę dopiero potem. MRR strojysz sekcją `[time_model]` w `config/machining.toml` (domyślne wartości są konserwatywne); jeśli istnieje `config/calibration.toml` (z `calibrate.py`), MRR jest **automatycznie skalowane realną produktywnością warsztatu** z zakończonych zleceń — wynik cytuje `n` próbek i ±rozrzut. Skrypt używa tylko biblioteki standardowej (nie czyta CAD — działa na liczbach z `geometry.py`).

5. **Policz koszt deterministycznie.**
   ```bash
   $PY skills/wycena/scripts/quote.py --estimate detal.estimate.json --geometry detal.geom.json
   ```
   Daje rozbicie PLN: materiał, przygotowanie, programowanie, obróbka, operacje ręczne, kontrola, kooperacja, rezerwa, zysk, cena, udział marży.
   **Polityka cenowa (W4.4)** — deterministyczna, z `rates.toml [polityka]`/`[klient.NAME]` (realne profile klientów w nakładce `config/local/`): `--customer "NAZWA"` bierze profil marży/rezerwy klienta, `--rush` dolicza dopłatę za pilne, a `minimalna_cena_zlecenia_pln` jest egzekwowana jako podłoga ceny serii — wszystko z **jawnymi wierszami** w `warnings` i blokiem `pricing_policy` (nigdy po cichu). Nieznany klient → `need_info` (nie wywala wyceny). quote.py zależy od ABSTRAKCJI `pricing_policy.PricingPolicy` (DIP) — nie zna struktury configu; profil pokazuje raport jako dane **wewnętrzne** (ukryte w druku dla klienta).

5b. **Alternatywa: kooperacja SendCutSend (druga opinia dla detali płaskich).**
   ```bash
   $PY skills/wycena/scripts/scs_check.py --geometry detal.geom.json            # z modelu 3D
   $PY skills/wycena/scripts/scs_check.py --geometry detal.geom.json --dxf detal.dxf   # z płaskim DXF
   ```
   **Dołącz płaski DXF (`--dxf`), by cechy stały się REALNE `✅/❌`** zamiast `❓`: `dxf_inspect.py` (ezdxf) mierzy jednostki ($INSUNITS), gabaryt 1:1, średnice otworów, linie gięcia ORAZ **odległości geometryczne** (otwór–krawędź, mostek otwór–otwór, flansza od linii gięcia) → `scs_check.py` porównuje je z limitami SCS (`min_hole_size`, `min_bridge_size`, `min_hole_to_edge`, `min_flange_length_*`, `max_bend_length`, rozmiar). Bez DXF kontrole cech zostają `need_info`. Wyjątek: gwintowanie/pogłębianie zostają `need_info` mimo DXF, jeśli przejdą (nie znamy intencji — które otwory), ale `fail` przy naruszeniu odległości.
   Sprawdza, czy detal nadaje się na laser SCS (płaski? materiał→kategoria SCS, grubość→gauge, footprint vs `min/max_part_size`) oraz **usługi dodatkowe dostępne dla danego SKU** (gięcie, gwintowanie, pogłębianie, montaż normaliów PEM, wykończenia — anodowanie/proszek/galwanika/tumbling/gratowanie): dla każdej cytuje blok `…_specs` i sprawdza footprint vs jej `min/max_flat_part_size` (real `✅/❌`), a cechy zależne od profilu (R gięcia, rozmiar gwintu/otworu, długość flanszy) zostawia jako `❓ need_info` do potwierdzenia na **DXF**. Etykiety `✅/❌/❓`, rekomendacja **wykonać u nas vs kooperacja**. **CENY nie liczy** (publiczne źródła SCS jej nie mają) — handoff do konfiguratora `sendcutsend.com`. Wymaga wcześniejszego `download_sources.py`. SCS = tylko kooperacja, nie obróbka u nas.

5c. **Optymalizacja kosztu — co-jeśli (policzona, nie zgadnięta).**
   ```bash
   $PY skills/wycena/scripts/optimize.py --geometry detal.geom.json --estimate detal.estimate.json \
       --qty-goal 10 --target 250 --json > detal.optimize.json
   ```
   `optimize.py` odpowiada na pytanie „dlaczego tyle i co to zbije": pokazuje **gdzie są pieniądze** (atrybucja kosztu wg PLN) i **dźwignie oszczędności** — każdą liczy PERTURBUJĄC jedną realną decyzję (większa seria, jedno zamocowanie zamiast wielu, pominięcie szlifu wymuszonego tolerancją) i **przeliczając wariant TYM SAMYM `quote.py`**; sortuje wg policzonej różnicy PLN i podaje kompromis każdej dźwigni. `--target` daje „przepis" dojścia do ceny docelowej (odwrotna wycena) i mówi, czy cel jest osiągalny dźwigniami. To ZASTĘPUJE zgadywanie w sekcji J realnymi liczbami — dyscyplina jak reszta skilla. Architektura: `optimize()` zależy od abstrakcji `CostLever` (strategia) i wstrzykniętej funkcji wyceny (DIP), nie od konkretów. Wynik dołącz do raportu przez `report.py --optimize detal.optimize.json` (sekcja **wewnętrzna**, ukryta w druku klienta).

6. **Zredaguj raport wg `references/report-template.md`**: kontekst → **źródła sprawdzone** (bibliografia z manifestu) → fakty geometryczne → **tabela Ustaleń** (`checks.py` + Twoje wiersze z rysunku, każdy z cytatem źródła; przy `❌ fail` wstaw SVG z `diagnose.py`) → analiza A–J wg `references/metoda-wyceny.md` → **werdykt bramkowany** → cena. Zawsze podawaj ile PLN liczysz za daną operację i koszt pracownika. Narrację (cechy, klasyfikacja, ryzyka, pewność, opłacalność, usprawnienia, rekomendacja) zapisz jako `analysis.json` — schemat w nagłówku `scripts/report.py` i w `references/metoda-wyceny.md`. Dźwignie oszczędności dołącz przez `report.py --optimize detal.optimize.json` (krok 5c). **Nie nazywaj wyceny wiążącą, gdy jakikolwiek wymagany wiersz to `❌ fail` lub `❓ need_info`.**

7. **Wygeneruj podgląd modelu** (SVG izometryczny, wbudowany w raport):
   ```bash
   $PY skills/wycena/scripts/preview.py ŚCIEŻKA/detal.stp --out detal.svg
   ```

8. **Wygeneruj interaktywny raport HTML i pokaż go użytkownikowi** (lepszy UX, gotowy do druku/PDF/wysyłki):
   ```bash
   $PY skills/wycena/scripts/report.py --geometry detal.geom.json --quote detal.quote.json \
       --analysis detal.analysis.json --preview detal.svg \
       --preflight detal.pf.json --scs detal.scs.json --estimate detal.estimate.json --out detal.html
   open detal.html        # macOS — otwórz w domyślnej przeglądarce
   ```
   Jeden samodzielny plik (inline CSS+JS, bez zależności). Cechy UX:
   - **Edytowalne ceny** — pola stawek/czasów to pola input; JS przelicza koszt i cenę **na bieżąco** tą samą formułą co `quote.py` (zasilane blokiem `inputs` z `quote.json`). Klient/technolog poprawia liczby wprost na raporcie.
   - **Podgląd modelu STP** — wbudowany inline SVG (`--preview`).
   - **Ustalenia preflight + werdykt** — podaj `--preflight detal.pf.json` (z `checks.py --json`): tabela ✅/❌/❓ z cytatem źródła i bramkowany werdykt.
   - **Alternatywa SendCutSend** — podaj `--scs detal.scs.json` (z `scs_check.py --json`): sekcja „K. Kooperacja SCS" z badge'em (kandydat/nieadekwatny), tabelą cech i handoffem do konfiguratora. **Zawsze dołącz `--scs`, gdy uruchomiłeś krok 5b** — inaczej wynik SCS nie trafi do raportu klienta.
   - **Make-vs-buy: wypalanie u nas vs SCS (W4.6)** — gdy marszruta policzyła cięcie u nas (`estimate.routing_meta.plasma` z `routing.py --dxf`), dołącz `--estimate detal.estimate.json`: raport dokleja **wewnętrzną** linię z deterministycznym kosztem `{materiał + wypalanie plazmą}` (liczby z `quote.py` — bez równoległego modelu kosztu) jako **próg PLN/szt**, poniżej którego kooperacja SCS się opłaca. Gdy grubość jest poza zdolnością plazmy (`capability=fail`), linia mówi wprost „wypalanie u nas niemożliwe → kooperacja konieczna". Bez `--estimate` lub dla detalu bez cięcia plazmą sekcja się nie pojawia.
   - **Waluta PLN/EUR + VAT (W4.5)** — przełącznik **PLN/EUR** w nagłówku i wiersz **VAT (netto/brutto)** w stopce tabeli cen. To **tylko prezentacja**: silnik liczy w PLN end-to-end (stawki/materiał/rejestr), a przeglądarka przelicza ceny na EUR przy wyświetlaniu i pokazuje brutto — **jedna formuła, jeden silnik** (pola input zostają w PLN). Kurs i stawkę VAT bierze z `config/rates.toml [waluta]` (`eur_pln`, `eur_pln_data`, `vat_proc`); kurs jest **ręczny i datowany** (cytowany w stopce — dyscyplina cytatu dotyczy też FX). `eur_pln = 0` → brak przełącznika EUR; `vat_proc = 0` → brak wiersza VAT (raport czysto PLN). Realny kurs/VAT trzymaj w nakładce `config/local/rates.toml`. Quote JSON i rejestr pozostają wyłącznie w PLN.
   - **Oferta handlowa (branding, W6.2)** — nagłówek z tożsamością firmy (nazwa, NIP/REGON, logo wklejone jako data-URI → plik zostaje samodzielny), numerem oferty (`--offer-no`, domyślnie `quote_id` albo `OF-RRRRMMDD`), datą wystawienia i **ważności** (z `[oferta].waznosc_dni`) oraz stopką **warunków handlowych**. Dane firmy czytane są z `config/company.toml` (neutralny placeholder w repo; realne dane w prywatnej nakładce `config/local/company.toml`). Przełącznik **PL/EN** tłumaczy „chrome" oferty po stronie przeglądarki (narracja technologa zostaje w oryginale — uczciwa notka informuje o tym przy EN). Przełącznik **wersja klienta / wewnętrzna** chowa wiersze wewnętrzne (marża, kalibracja); **druk domyślnie = wersja klienta**.
   Dodatkowo: badge rekomendacji kolorem, lista dopasowania do maszyn (✓/✗), tabela kosztów. Przykład działający: `examples/crank.html` (+ pliki wejściowe obok). W czacie możesz zwrócić zwięzłą wersję tekstową, ale plik HTML jest artefaktem dla klienta.

## Konfiguracja (stawki) — wstępnie wypełniona szacunkiem rynkowym PL

Stawki są już wypełnione **szacunkiem rynkowym PL** (2025/26), żeby wycena dawała cenę od razu. Wartości oznaczone `szacunek rynkowy PL — EDYTUJ` to punkt wyjścia — **poprawiaj je do realnych kosztów firmy**. Dopóki nie potwierdzisz ich z klientem/firmą, cena jest **orientacyjna**, nie wiążąca. Jeśli któreś pole wyzerujesz, `quote.py` zgłosi to i potraktuje wycenę jako niewiążącą dla danego składnika.

**Realne liczby firmy wpisuj do PRYWATNEJ nakładki, nie do plików repo:**
`config/local/*.toml` (gitignore; patrz `config/local/README.md`) albo katalog
wskazany zmienną `WYCENA_CONFIG_DIR`. Nakładka scala się per klucz nad bazą —
nadpisujesz tylko to, co znasz, a stawki firmy nigdy nie trafiają do historii
gita publicznego repo. Jawny `--config-dir` (testy/fixtures) wyłącza nakładkę.

- `config/machines.toml` — park maszynowy: gabaryty robocze + `rate_pln_h` (koszt maszyny/h, bez operatora).
- `config/materials.toml` — gęstości (fizyczne, gotowe) + `cena_pln_kg` (cena zakupu, szacunek rynkowy PL).
- `config/stock.toml` — standardowe wymiary handlowe (grubości blach, średnice prętów) per rodzina. `quote.py`/`time_model.py` dobierają najmniejszy mieszczący wymiar i cytują go (detal 41 mm ⇒ płyta 50 mm, nie 47). Wyłączasz polem `no_stock_catalog: true` w oszacowaniu (wraca model bbox+naddatek); brak pliku = też model bbox+naddatek.
- `config/cooperation.toml` — cennik procesów zewnętrznych (hartowanie/powłoki/EDM) dla linii `cooperation[]` w oszacowaniu.
- `config/rates.toml` — robocizna (operator CNC/konw., ślusarz, kontroler), programowanie, przygotowanie, koszt przezbrojenia, `material_waste_factor`, `rezerwa_proc`, `marza_proc`.
- opcjonalnie `config/machining.toml` z sekcją `[time_model]` stroi MRR/tempo wykończenia per klasa materiału dla `time_model.py` (bez tego pliku działają konserwatywne wartości domyślne).

Gabaryty maszyn oznaczone `DO WERYFIKACJI` uzupełnij wg DTR — od nich zależy automatyczna kontrola wykonalności.

## Pętla uczenia: rejestr zleceń → kalibracja MRR (wycena uczy się Twojego parku)

Domyślne MRR są tekstbookowe. **Każde zakończone zlecenie zamień w próbkę kalibracyjną**, a fizyczny zakres czasu (i cena) zacznie odzwierciedlać realną produktywność Twojego warsztatu — deterministycznie i cytowalnie (z `n` próbek, nie ze zgadywania).

Rejestr odwzorowuje **pętlę pieniądza** zlecenia: `quoted → won|lost → made → invoiced` (schemat v2, W5.1). Każdy rekord pamięta klienta + zastosowany profil polityki cenowej (W4.4) + progi cenowe (W4.3); czas rzeczywisty wpisujesz LUMP albo **per operacja** — a **kolumna „czas rzeczywisty" w karcie technologicznej (`route_card.py`, W3.4) jest papierowym źródłem tych liczb** (ta sama symetria w obu dokumentach).

```bash
# 1. Po wycenie zapisz zlecenie (pamięta bazową NIESKALIBROWANĄ prognozę + klienta/politykę/progi):
$PY skills/wycena/scripts/ledger.py log --geometry detal.geom.json --quote detal.quote.json --part-name "Detal"
# 2. Wynik sprzedaży (win-rate i marża per klient; lost z ceną konkurencji kalibruje model MARŻY):
$PY skills/wycena/scripts/ledger.py won  --id <quote_id> --price 480 --qty 10
$PY skills/wycena/scripts/ledger.py lost --id <quote_id> --reason "za drogo" --price 390
# 3. Po wykonaniu wpisz RZECZYWISTY czas — lump z karty pracy ALBO per operacja z karty technologicznej:
$PY skills/wycena/scripts/ledger.py actual --id <quote_id> --machining-h 2.3 --setup-h 0.6
$PY skills/wycena/scripts/ledger.py actual --id <quote_id> --op "Frezowanie zgrubne" --machine "MCV 1016" --hours 1.4
# 4. Zafakturowano (zamknięcie pętli: estymata → cena → realna kwota):
$PY skills/wycena/scripts/ledger.py invoice --id <quote_id> --amount 4750
# 5. Przelicz kalibrację → config/calibration.toml (time_model.py użyje jej automatycznie, też w webappie):
$PY skills/wycena/scripts/calibrate.py
$PY skills/wycena/scripts/ledger.py list --status quoted,won,made    # tor estymata vs rzeczywistość + statusy
```

Stary plik rejestru (v1) zmigrujesz jednorazowo: `ledger.py migrate` (kopia `.bak` + dopisanie pól; rekordy v1 i tak czytane są przejrzyście, a `calibrate.py` działa bez zmian — te same `ratio`/klasy).

Kalibracja liczy per (klasa materiału, proces) `ratio = czas_rzeczywisty / prognoza_typowa_nieskalibrowana`, bierze medianę (>1 = warsztat wolniejszy niż tekstbook), skaluje MRR przez `1/mediana` i podaje rozrzut (pewność). Stosuje się dopiero przy `n ≥ 3` (poniżej: tentatywna, tylko podgląd). **Hierarchia (W5.2):** gdy rekordy mają atrybucję maszyny (per-op actuals / predicted_ops), powstaje też grupa `klasa/proces::maszyna` — `time_model.py` rozstrzyga **(klasa, proces, maszyna) → (klasa, proces) → domyślne** i **cytuje zastosowany poziom** (DMU 50 i stara frezarka konwencjonalna nie smarują się w jednym „steel/milling"). **Outliery** ratio poza `[0.2, 5.0]` są odrzucane (raportowana liczba — literówka w karcie pracy nie psuje mediany przy n=3). **Drugi kanał — cechy:** `calibration.toml [feature]` kalibruje czas per RODZAJ operacji (wiercenie/gwint/kieszeń/szlif) z `time_scale = mediana(czas_rzecz/czas_przew)` z dopasowania per-op actuals↔predicted_ops, stosowany przy `n ≥ 5` (głośniejszy sygnał) — niezależnie od bloba, krzyżowo się sprawdzają. `calibrate.py` drukuje **tabelę wystarczalności danych** i podpowiada co zalogować dalej („najwięcej da wpisanie czasów dla 'steel/turning' — n=1"). Rejestr (`wycena/ledger/`) i `calibration.toml` to **dane operacyjne warsztatu** (gitignore), nie źródło. Odcisk geometrii w rejestrze przygotowuje przyszłe wyszukiwanie podobnych detali („wyceniałeś już taki detal").

**Analityka (W5.4)** — `analytics.py` (albo zakładka „Analityka" w webappie) liczy z rejestru liczby, które prowadzą firmę: **hit rate** (won-lub-dalej ÷ rozstrzygnięte, ogółem i per klient/klasa — wykonane/zafakturowane zliczają się jako wygrane), **marżę planowaną vs zrealizowaną** (zafakturowane vs koszt planowany = cena ÷ (1+marża)), **dokładność wyceny** (czas rzeczywisty ÷ wyceniony) i jej **trend po kwartałach** (maleje = pętla uczenia działa). Cienki rejestr degraduje się łagodnie („za mało danych, n=K"). To **dane wewnętrzne** (nazwy klientów + marże) — nigdy w raporcie dla klienta. `python analytics.py [--json]`.

## Czego NIE robić

- Nie zgaduj objętości/masy/wymiarów z modelu — czytaj je ze `geometry.py`.
- **Nie pisz marszruty od zera, gdy `routing.py` może ją wygenerować** — uruchom generator (krok 3) i RECENZUJ wynik. Każde odejście od wygenerowanej godziny/operacji/maszyny uzasadnij jednym zdaniem; nazwy maszyn trzymaj zgodne z `machines.toml`.
- Nie zaniżaj czasu skrawania poniżej fizycznego minimum z `time_model.py` — jeśli `flags` zgłasza `blad`, popraw czasy, a nie cenę.
- Nie wpisuj gotowej kwoty PLN „z głowy" — cenę zawsze liczy `quote.py` (stawki × czasy). Stawki możesz **zaproponować wg rynku PL** (lub wziąć z `config/`), ale samej ceny nie zgaduj.
- **Nie zostawiaj ustalenia bez cytatu źródła** — każdy wiersz ma `rule_source` (ścieżka pola / kotwica normy / `Direct file inspection`). Brak/sprzeczność danych → `❓ need_info`, nie zgadywany pass/fail.
- **Nie nazywaj wyceny „wiążącą"**, gdy jest jakikolwiek `❌ fail`/`❓ need_info`, ani gdy stawki to wciąż domyślny szacunek rynkowy PL — zaznacz „wycena orientacyjna wg cen rynkowych PL, stawki do potwierdzenia".
- Nie używaj źródeł SendCutSend do obróbki u nas — one dotyczą **kooperacji** cięcia/laser; do wykonania u nas autorytatywny jest `config/*.toml`.
- Nie streszczaj ogólnikowo. Oceniaj konkretnie, jak technolog. Jeśli detal jest nieopłacalny lub źle zaprojektowany pod wykonanie — napisz to wprost.

4. manufacturing-tool
# Analiza śladu marszruty produkcyjnej

Narzędzie do deterministycznej, audytowalnej analizy decyzji bramowych w **marszrucie produkcyjnej**
(manufacturing route — sekwencja stanowisk, na których przemieszczają się panele i komponenty).
Dane wejściowe pochodzą z czujników i logów PLC zebranych do jednego pliku `trace.json`.
Wyjściem są ustrukturyzowane datasety, raporty scoringowe oraz trzy samowystarczalne strony HTML
(architektura, dashboard scoringu, interaktywny czat traceability).

> **Audyt zamiast halucynacji.** Każde pytanie generowane do LLM ma sztywno zdefiniowany zbiór
> dopuszczalnych cytowań (`allowed_citations` — lista `trace_id`). Każda odpowiedź jest skanowana pod
> kątem brakujących faktów, brakujących cytowań i sprzeczności. Statyczny klient czatu w przeglądarce
> w ogóle nie wywołuje LLM — wszystkie odpowiedzi są precompute'owane z historycznych danych z
> cytowaniem `trace_id`. Tryb agentowy (Gemini function-calling) jest dostępny tylko z CLI lub przez
> lokalny serwer Pythona.

📐 **Interaktywna mapa architektury z parametrami biznesowymi:** otwórz [`architektura.html`](architektura.html)
w przeglądarce — klikalny diagram komponentów i panel z wartościami wszystkich parametrów scoringu.

---

## Spis treści

- [Co robi narzędzie](#co-robi-narzędzie)
- [Rola AI / LLM](#rola-ai--llm)
- [Parametry biznesowe (wartości)](#parametry-biznesowe-wartości)
- [Szybki start](#szybki-start)
- [Architektura w 30 sekund](#architektura-w-30-sekund)
- [Komponenty](#komponenty)
- [Przepływy (workflows)](#przepływy-workflows)
- [Format wejścia — `trace.json`](#format-wejścia--tracejson)
- [Artefakty wyjściowe](#artefakty-wyjściowe)
- [Referencja CLI](#referencja-cli)
- [Lokalny serwer UI z endpointami Pythona](#lokalny-serwer-ui-z-endpointami-pythona)
- [Zmienne środowiskowe](#zmienne-środowiskowe)
- [Integracje LLM](#integracje-llm)
- [Testy](#testy)
- [Deployment (GitHub Pages / S3)](#deployment-github-pages--s3)
- [Struktura repo](#struktura-repo)

---

## Co robi narzędzie

Marszruta produkcyjna to ścieżka panelu przez kolejne stanowiska (bramki rozjazdowe, bufory, stacje
pakowania). Eksport `trace.json` zawiera dziesiątki tysięcy zdarzeń telemetrycznych z czujników —
często z uciętymi payloadami JSON. Pipeline rozwiązuje pięć nakładających się problemów operacyjnych:

1. **Ekstrakcja decyzji.** Z surowego eksportu (~25 MB / setki tys. zdarzeń) tworzy ustrukturyzowany
   dataset decyzji bramowych z metrykami biznesowymi (panele przepuszczone, zmiana głębokości kolejki,
   zagłodzenia, blokady, opóźnienia).
2. **Wykrywanie szans (counterfactual).** Dla każdej historycznej decyzji liczy, czy istniała lepsza
   alternatywa na podstawie podobnych przypadków. Tam, gdzie różnica jest istotna — emituje
   *Opportunity* z dowodami i szacowaną wartością.
3. **Atrybucja przyczynowa (causal blame).** Dla każdego incydentu (starvation / blocked / queue
   overflow / no_throughput) wstecz w oknie czasowym identyfikuje sub-optymalne decyzje, kwantyfikuje
   udział winy (`blame_share ∈ [0,1]`) z wagami: counterfactual delta × recency decay × resource match.
4. **Wzbogacenie interpretacyjne (LLM).** Wykorzystuje LLM (Gemini Batch lub OpenAI) do generowania
   *czytelnych dla człowieka* wyjaśnień, co i dlaczego się stało, z **wymuszeniem cytowań źródłowych**
   (każda interpretacja musi zacytować konkretny `trace_id`). Scoring odpowiedzi pilnuje, by model
   nie halucynował.
5. **Snapshot + decyzja na teraz.** `traceability_snapshot_builder.py` kondensuje długi export do
   małego `live_snapshot.json`, a `traceability_live_decision.py` używa tego snapshotu i historycznych
   priors, żeby odpowiedzieć: *co zrobić właśnie teraz?* Lekka, heurystyczna rekomendacja live —
   nie pełny system RL.

Cała wartość trafia do trzech statycznych stron HTML:

- **`architektura.html`** — interaktywny diagram pipeline'u + boczny panel z wartościami parametrów.
- **`dashboard.html`** — szczegółowy raport scoringowy: per pytanie wynik, brakujące fakty,
  sprzeczności, ranking winowajców causal, filtry kliencie.
- **`chat.html`** — interaktywny asystent z precompute'owanymi odpowiedziami (bez backendu).
  Dodatkowo: panele CLI dla agenta Gemini, snapshot buildera i live decision; opcjonalnie wywołują
  lokalny serwer Pythona (`traceability_ui_server.py`).

---

## Rola AI / LLM

Decyzje rekomendacyjne **nie** są podejmowane przez LLM — pochodzą z deterministycznego porównania
historycznych wyników. LLM jest używany wyłącznie w trzech wąskich rolach:

| Rola | Komponent | Co robi LLM | Co kontroluje deterministyczna logika |
|---|---|---|---|
| **Wyjaśnienie interpretacji** | `tracebench.py run-llm` (Gemini Batch / OpenAI) | Składa zdanie w naturalnym języku o tym, gdzie wysłano bramę i dlaczego | Zbiór dopuszczalnych cytowań (`allowed_citations`) wymusza, że każda odpowiedź zacytuje istniejący `trace_id`. Scoring (`tracebench.py run`) kara za brak faktu (`-0.35`), brak cytowania (`-0.6`), sprzeczność (`-0.6`) |
| **Agent z function-calling** | `traceability_chat_agent.py` (Gemini) | Planuje, którą deterministyczną funkcję wywołać (`lookup_trace`, `recommend_gate`, `get_opportunities`, `get_incidents`, `get_patterns`, `search_decisions`, `compare_targets`) i pisze końcową odpowiedź | Wszystkie fakty muszą pochodzić z wyników narzędzi. Post-check skanuje cytowania i przy rekomendacjach wymaga `decision_explanation` (target, evidence_count, confidence, risks, benefits, limitations). Jeśli LLM nie przejdzie walidacji po reprompcie, UI/API zwraca deterministyczny fallback z narzędzia i oznacza `answer_source=agent_deterministic_fallback` |
| **Czat statyczny w przeglądarce** | `chat.html` (precompute) | **Nie wywołuje LLM w ogóle.** Wszystkie odpowiedzi są precompute'owane przez Pythona przy budowaniu pliku | Routing pytania po intent (`trace_lookup`, `recommend`, `opportunity`, `patterns`, `incident`, `starvation`); każda odpowiedź ma dosłowne cytowanie |

**Dlaczego tak?** Bo to narzędzie ma być audytowalne — w prezentacji dla biznesu każda liczba musi być
wskazywalna do konkretnego rekordu w `trace.json`. LLM odpowiada za czytelność, nie za prawdę.

Modele i ceny domyślne (do nadpisania przez ENV):

- Tryb Batch / Interactive: `gemini-2.5-flash` (domyślnie), alternatywa `--provider openai`
- Tryb agenta: `gemini-3-flash-preview` (`TRACEABILITY_AGENT_INPUT_USD_PER_1M=0.15`,
  `TRACEABILITY_AGENT_OUTPUT_USD_PER_1M=0.6`)
- Estymacja i rzeczywisty billing pokazywane w panelu agenta w `chat.html`

---

## Parametry biznesowe (wartości)

Wszystkie wagi i progi są jawne i wyliczalne — proces inżynierów może je tunować bez czytania kodu.
Te same liczby pokazane są w bocznym panelu `architektura.html`.

### Business score (per decyzja)

Plik: `traceability_decision_model.py::business_score`.

```
score = 2.0 × panels_passed
      − 5.0  jeśli flow_outcome zawiera "starved"
      − 4.0  jeśli flow_outcome zawiera "blocked"
      − 0.75 × queue_depth_delta    (gdy delta > 0)
      + 0.25 × |queue_depth_delta|  (gdy delta < 0)
      − 1.5  × blocked_packing_stations
```

### Podobieństwo przypadków (recommend_gate)

Plik: `traceability_decision_model.py::find_similar_cases`.

- Identyczny `action_type` (wymóg twardy)
- Identyczny `product_type` (gdy oba znane)
- `panel_length` różnica ≤ **650**
- `queue_depth_320r` różnica ≤ **8**

### Poziomy pewności rekomendacji

Plik: `traceability_decision_model.py::_confidence`.

| Confidence | Warunki |
|---|---|
| **low** | `fallback_used` LUB `total_cases < 5` LUB `< 2` targetów |
| **medium** | `total_cases < 20` |
| **high** | inaczej |

### Scoring odpowiedzi LLM (tracebench)

Plik: `tracebench.py::score_answer`.

```
score = 1.0
      − 0.35 × liczba_brakujących_faktów   (każdy gold value nieobecny w tekście)
      − 0.6   jeśli brak cytowania
      − 0.6  × liczba_sprzeczności          (wymieniono target inny niż gold)

pass = score ≥ 0.7 ∧ has_citation ∧ no_contradictions
```

`--strict-citations`: cytowanie liczy się **tylko** jeśli odpowiedź zawiera dokładny `trace_id`
(sam `business_key` nie wystarczy).

### Scoring funkcji AI (feature_eval)

Plik: `traceability_feature_eval.py::evaluate_feature_answer`.

```
score = 1.0
      − 0.18 × liczba_brakujących_keywords
      − 0.35 jeśli brak cytowania
      − 0.5  × liczba_sprzeczności

pass  = score ≥ 0.7 ∧ has_citation ∧ no_contradictions
min_pass_rate (default w run): 1.0 (każda funkcja musi przejść)
```

### Atrybucja przyczynowa (causal blame)

Plik: `traceability_causal_attribution.py`. Wartości domyślne (nadpisywalne CLI/ENV):

| Parametr | Domyślnie | Co kontroluje |
|---|---|---|
| `window_min` | 15 min | Okno look-back: kandydaci-priors muszą wystąpić w tym oknie przed incydentem |
| `tau_seconds` | 300 s | Stała czasowa exponential decay (`exp(−Δt / TAU)`). ~5 min half-life |
| `top` | 5 | Maks. liczba contributorów per incydent; reszta → `background_share` |
| `min_blame` | 0.05 | Minimalny `blame_share` żeby trafić do `attribution[]` |
| `min_severity` | 1.0 | Minimum `severity` (`= best_alt_score − actual_score`) żeby zdarzenie było incydentem |
| `queue_overflow_delta` | 4.0 | `queue_depth_delta ≥ ten próg` klasyfikuje incydent jako `queue_overflow` |
| `SAME_RESOURCE_WEIGHT` | 1.0 | Waga gdy `prior.target == incident.target` LUB ten sam `business_key` |
| `PARTIAL_RESOURCE_WEIGHT` | 0.7 | Waga gdy wspólny prefix targetu ≥ 2 znaki |
| `OFF_RESOURCE_WEIGHT` | 0.3 | Inaczej |

Formuła winy (per contributor):

```
raw_delta   = max(0, best_alt_score − actual_score)
raw_blame   = raw_delta × exp(−Δt / TAU) × resource_match_weight
blame_share = raw_blame / sum(raw_blame across all candidates)
```

### Klasyfikacja incydentów

Plik: `traceability_causal_attribution.py::classify_outcome`.

| Outcome | Warunek |
|---|---|
| `starved` | `flow_outcome` zawiera "starved" |
| `blocked` | `flow_outcome` zawiera "blocked" |
| `queue_overflow` | `queue_depth_delta ≥ queue_overflow_delta` (domyślnie 4.0) |
| `no_throughput` | `panels_passed == 0 ∧ observed_after_sec ≥ 60` |

### Decyzja live (live_decision)

Plik: `traceability_live_decision.py::recommend_now`.

```
final_score = avg_business_score (historyczny)
            + pressure_hint       (−0.35 × live_queue_depth − 4.0 jeśli blocked
                                   + 0.75 jeśli starved + 0.15 jeśli current_target)
            + support_bonus       (min(1.2, ln(1+cases)/2)  lub  −0.5 gdy 0 cases)
            − 6.0  jeśli blocked
            − 3.0  jeśli niedostępny
```

Domyślny `min_cases = 3` (poniżej — confidence = "low").

---

## Szybki start

```bash
# 1. Zależności (Python 3.11+)
pip install orjson
# opcjonalnie dla LLM:
pip install openai google-genai

# 2. Pojedyncze sparsowanie + dataset decyzji (najszybsza ścieżka, 0 wywołań API):
python traceability_decision_model.py build-dataset --trace trace.json --out decisions.jsonl

# 3. Zbuduj snapshot z długiego exportu / historycznych decyzji:
python traceability_snapshot_builder.py \
  --trace trace.json \
  --business-key "K006B01|A370026002261|2|1" \
  --out live_snapshot.json

# 4. Decyzja live z bieżącego snapshotu telemetrycznego:
python traceability_live_decision.py recommend \
  --snapshot live_snapshot.json \
  --dataset decisions.jsonl

# 5. Pełny build lokalny (mirror docelowego CI):
./build.sh                          # bez LLM, z deterministycznym fallbackiem

# 6. Otwórz wyniki w przeglądarce:
#    architektura.html, dashboard.html, chat.html

# 7. (Opcjonalnie) Lokalny serwer Pythona dla przycisków „Uruchom API" w chat.html:
python traceability_ui_server.py --host 127.0.0.1 --port 8000
```

Minimalny smoke-test bez plików produkcyjnych:

```bash
python -m unittest discover -s tests -v
```

---

## Architektura w 30 sekund

```
trace.json
    │
    ▼
[traceability_eval.py]           ← parser, fallback regex dla uciętych payloadów
    │
    ├──► [tracebench.py · build] ─► bench.jsonl ─► [run-llm (Gemini/OpenAI)] ─► answers.jsonl
    │                                              │     ▲ fallback: gen_det
    │                                              ▼
    │                                            [run · scoring] ─► report.json ─► [dashboard.py] ─► dashboard.html
    │
    ├──► [decision_model · build-dataset] ─► decisions.jsonl ─► [opportunity_miner audit] ─► opportunities.json
    │                                                       └──► [causal_attribution build] ─► causal_attribution.jsonl + causal_report.json
    │
    ├──► [snapshot_builder] ─► live_snapshot.json ─► [live_decision recommend] ─► live recommendation JSON
    │
    ├──► [feature_eval · build] ─► feature_items.jsonl ─► [oracle-answers] ─► feature_answers.jsonl ─► [run] ─► feature_report.json
    │
    ├──► [chat.py (lib + CLI)] ──► [chat_agent.py (Gemini agent)] ── tylko CLI / API
    │
    └──► [chat_ui.py] ──(używa chat.py, decision_model, opportunity_miner, snapshot_builder, live_decision)──► chat.html
                                  ↑ embed: feature_report.json (badge'y walidacji)
                                  ↑ embed: causal_attribution.jsonl (jeśli istnieje)

[traceability_ui_server.py + ui_backend.py] ─ opcjonalny HTTP serwer wystawiający
                                              /api/chat/ask, /api/agent/run,
                                              /api/snapshot/build, /api/live/recommend

[build.sh] ─ orchestrator wywołujący wszystkie powyższe w sekwencji
```

Pełny obraz interaktywny: **`architektura.html`** (lewy panel = klikalny diagram, prawy panel =
opis kroków i wartości parametrów).

---

## Komponenty

| Plik | Rola | Wejście | Wyjście |
|---|---|---|---|
| **`traceability_eval.py`** | Parser zapisów. Obsługuje dwa formaty wejścia i ucięte `payload_json` (regex fallback). | `trace.json` | `TraceRecord[]`, `TraceBundle` (in-memory) |
| **`tracebench.py`** | Podkomendy: `build` (benchmark QA), `answer-deterministic` (template bez LLM), `run-llm` (wywołanie modelu), `run` (scoring), `cancel-gemini-batch`. Klienci OpenAI i Gemini (interactive + Batch). | trace + bench + answers (zależnie od podkomendy) | `bench.jsonl`, `answers.jsonl`, `report.json` |
| **`traceability_decision_model.py`** | Spłaszcza zdarzenia w `DecisionRow` (15 pól), liczy `business_score`, znajduje podobne przypadki, rekomenduje bramę. Subkomendy: `build-dataset`, `recommend`. | `trace.json` lub `TraceRecord[]` | `decisions.jsonl` + funkcje rekomendacji (lib) |
| **`traceability_opportunity_miner.py`** | Kontrfaktyczne porównanie faktycznej decyzji z rekomendacją. Emituje *Opportunity* + propozycje reguł. | `decisions.jsonl` | `opportunities.json` |
| **`traceability_shadow_eval.py`** | Shadow-mode backtest recommendera: ile razy rekomendacja nie zgodziłaby się z historycznym targetem, jaki szacowany delta score i ryzyko regresji. | `decisions.jsonl` lub `trace.json` | `shadow_report.json` |
| **`traceability_causal_attribution.py`** | **Atrybucja przyczynowa** zdarzeń niepożądanych. Dla każdego incydentu wstecz w czasowym oknie identyfikuje sub-optymalne decyzje i kwantyfikuje udział winy. | `trace.json` + `decisions.jsonl` | `causal_attribution.jsonl`, `causal_report.json` |
| **`traceability_feature_eval.py`** | Trzy etapy mapy AI: `interpret_trace`, `recommend_gate`, `historical_patterns`. Build → oracle → run → (opc.) self-test. | `trace.json` | `feature_items.jsonl`, `feature_answers.jsonl`, `feature_report.json` |
| **`traceability_chat.py`** | Deterministyczny silnik Q&A (biblioteka + CLI `ask` / `chat`). Routuje pytanie po intent. Bez LLM w trybie deterministycznym. Flaga `--agent` deleguje do `traceability_chat_agent.py`. | `ChatContext` z trace lub dataset + opc. causal_attribution.jsonl + opportunities.json | `ChatAnswer` (tekst + cytowania + intent) |
| **`traceability_chat_agent.py`** | Warstwa Gemini function-calling. 7 narzędzi (`lookup_trace`, `recommend_gate`, `get_opportunities`, `get_incidents`, `get_patterns`, `search_decisions`, `compare_targets`). Wymusza cytowania post-hoc. Estymuje koszt USD. | `ChatContext` + Gemini API key | `ChatAnswer` (grounded + usage + billing) |
| **`traceability_chat_ui.py`** | Generuje `chat.html` z osadzonymi precompute'owanymi danymi. Embed: bundles, decyzje, rekomendacje, szanse, shadow report, wzorce, badge'y z `feature_report.json`, plus karty CLI do agenta, snapshot buildera i live decision. UI pokazuje estymację/billing agenta oraz status walidacji/fallbacku. | `trace.json` lub `decisions.jsonl` (+ opc. `feature_report.json`, `opportunities.json`, `shadow_report.json`, `causal_attribution.jsonl`) | `chat.html` |
| **`traceability_snapshot_builder.py`** | Kondensuje długi export do małego `live_snapshot.json` dla jednego biznesowego kontekstu / selectora. | `trace.json` albo `decisions.jsonl` | `live_snapshot.json` |
| **`traceability_live_decision.py`** | Live recommender: bierze bieżący snapshot telemetryczny i ocenia dostępne akcje na bazie historycznych priors + prostych sygnałów live. | `live_snapshot.json` + `decisions.jsonl` (lub `trace.json`) | JSON rekomendacji live (`recommended_target`, `candidate_comparison`, `confidence`, `rationale`) |
| **`traceability_ui_backend.py`** | Cienka warstwa serwisowa dla UI: cache'owany `ChatContext`, `runtime_config`, wywołania `run_chat_ask` / `run_snapshot_build` / `run_live_recommend`. | `chat.ChatContext` + ścieżki | dict odpowiedzi JSON |
| **`traceability_ui_server.py`** | Lokalny HTTP serwer (stdlib `BaseHTTPRequestHandler` + `ThreadingHTTPServer`) wystawiający `chat.html` i endpointy `/api/chat/ask`, `/api/agent/run`, `/api/snapshot/build`, `/api/live/recommend`, `/api/config`, `/api/health`. | CLI args (`--host`, `--port`, `--root`) | HTTP serwer (`http://127.0.0.1:8000`) |
| **`tracebench_dashboard.py`** | Generuje `dashboard.html` z raportu scoringowego + osadzonymi bench/answers + opc. causal incydentami. Klienckie filtrowanie. | `report.json + bench.jsonl + answers.jsonl` (+ opc. `causal_attribution.jsonl`, `causal_report.json`) | `dashboard.html` |
| **`generate_deterministic_answers.py`** | Backward-compatible wrapper do `tracebench.py answer-deterministic`. | `bench.jsonl` | `answers.jsonl` |
| **`build.sh`** | Orchestrator pipeline'u. Sekwencja kroków + obsługa fallbacku LLM. Konfigurowalny przez ENV. | `trace.json` + ENV | wszystkie artefakty + HTML |

---

## Przepływy (workflows)

Każdy przepływ jest udokumentowany krok-po-kroku w `architektura.html` (klikalny diagram).
Tutaj skrótowo, co który robi i jak go uruchomić:

### 1) Ekstrakcja decyzji
Najkrótsza ścieżka, bez LLM, bez kosztów. Daje fundament dla wszystkich innych przepływów.

```bash
python traceability_decision_model.py build-dataset --trace trace.json --out decisions.jsonl
```

### 2) Wzbogacenie AI (LLM)
QA-benchmark → wywołanie modelu (Gemini Batch lub OpenAI) → scoring z wymuszeniem cytowań.

```bash
python tracebench.py build --trace trace.json --out bench.jsonl --limit-bundles 200
python tracebench.py run-llm \
  --bench bench.jsonl --trace trace.json --out-answers answers.jsonl \
  --provider gemini --model gemini-2.5-flash \
  --gemini-batch --bundle-prompts --strict-citations
python tracebench.py run --bench bench.jsonl --answers answers.jsonl --include-items --strict-citations --out report.json
```

### 3) Wyszukiwanie szans (counterfactual)
Co byłoby gdyby model wybrał inną bramę? Dla każdej decyzji liczy delta wartości na podstawie podobnych historycznie.

```bash
python traceability_opportunity_miner.py audit --dataset decisions.jsonl --top 50 --out opportunities.json
```

### 3a) Atrybucja przyczynowa (causal blame)
Odwraca kierunek pytania: zamiast „która decyzja była sub-optymalna?" pyta „dla tego incydentu —
kto zawinił i w jakiej proporcji?". Dla każdego zdarzenia niepożądanego (starvation, blocked, queue
overflow, brak throughputu) wstecz w oknie czasowym wyszukuje sub-optymalne decyzje i apporcjonuje
udział winy.

```bash
python traceability_causal_attribution.py build \
  --trace trace.json --dataset decisions.jsonl \
  --out causal_attribution.jsonl --report-out causal_report.json \
  --window-min 15 --tau-seconds 300 --top 5 --lang pl
```

Wyjście (`causal_attribution.jsonl`, 1 incident / linia):

```json
{
  "incident_id": "starved_abc123def456",
  "outcome": "starved",
  "business_key": "K006B01|...",
  "decision_time_utc": "2025-05-14T14:23:18+00:00",
  "affected_target": "K_BAD",
  "severity": 13.0,
  "severity_unit": "score_delta_vs_best_alternative",
  "attribution": [
    {
      "trace_id": "prior_xxx", "business_key": "K005A22|...",
      "decision_time_utc": "2025-05-14T14:22:18+00:00",
      "actual_target": "K_BAD", "counterfactual_target": "K_GOOD",
      "actual_score": -5.0, "expected_score_alternative": 8.0,
      "raw_delta": 13.0, "temporal_weight": 0.819,
      "resource_match_weight": 1.0, "blame_share": 0.62,
      "evidence_cases": 47, "confidence": "high"
    }
  ],
  "background_share": 0.08,
  "narrative": "Incydent starved (severity=13.0) na bramie K_BAD ...",
  "citations": ["trace_id=...", "trace_id=..."]
}
```

(Pełna formuła wagi — patrz [Parametry biznesowe](#parametry-biznesowe-wartości).)

### 4) Ewaluacja funkcji AI (3 etapy)
Test pass-rate per etap mapy AI. Oracle answers powinny dawać ~100% — to test scoringu, nie modelu.

```bash
python traceability_feature_eval.py build --trace trace.json --out feature_items.jsonl
python traceability_feature_eval.py oracle-answers --items feature_items.jsonl --out feature_answers.jsonl --strict-citations
python traceability_feature_eval.py run --items feature_items.jsonl --answers feature_answers.jsonl --strict-citations --out feature_report.json
```

### 4b) Shadow-mode rekomendacji live
Przed użyciem rekomendacji operacyjnie uruchom backtest: raport pokazuje agreement/disagreement rate względem historycznych decyzji, szacowany total/avg delta score oraz potencjalne regresje. To walidacja decyzyjna, nie dowód przyczynowy.

```bash
python traceability_shadow_eval.py --dataset decisions.jsonl --out shadow_report.json
# albo bez datasetu:
python traceability_shadow_eval.py --trace trace.json --out shadow_report.json
```

### 5) Interfejs czatu (klient)
Generuje self-contained `chat.html` z całą logiką Q&A po stronie przeglądarki. Bez backendu.
Jeśli istnieje `decisions.jsonl`, jest preferowany jako mniejsze wejście; `--opportunities` unika
ponownego liczenia szans. Jeśli obok wejścia istnieje `shadow_report.json`, UI automatycznie pokazuje panel shadow-mode.

```bash
# Z wcześniej zbudowanym datasetem (mniejszy embed):
python traceability_chat_ui.py --dataset decisions.jsonl --opportunities opportunities.json --shadow-report shadow_report.json --out chat.html

# Albo prosto ze śladu (przelicza wszystko in-memory):
python traceability_chat_ui.py --trace trace.json --out chat.html
```

### 6) Dashboard wyników
Generuje `dashboard.html` z raportu scoringowego (opcjonalnie z incydentami causal).

```bash
python tracebench_dashboard.py \
  --report report.json --bench bench.jsonl --answers answers.jsonl \
  --causal-attribution causal_attribution.jsonl --causal-report causal_report.json \
  --out dashboard.html --lang pl
```

### 7) Snapshot builder + decyzja live (now)
Najprostszy path do pytania "co zrobić teraz?". Snapshot builder kondensuje długi export do małego
pliku, a live recommender używa tego snapshotu z historycznymi priors.

Przykładowy snapshot:

```json
{
  "line_id": "L1",
  "action_type": "packing",
  "current_target": "G2",
  "available_actions": ["G1", "G2", "G3"],
  "queue_depths": {"G1": 2, "G2": 8, "G3": 11},
  "blocked_actions": ["G3"]
}
```

```bash
python traceability_snapshot_builder.py \
  --trace trace.json \
  --business-key "K006B01|A370026002261|2|1" \
  --out live_snapshot.json

python traceability_live_decision.py recommend \
  --snapshot live_snapshot.json \
  --dataset decisions.jsonl
```

### 8) Pełny build (build.sh)
Sekwencja wszystkich powyższych w kolejności.

```bash
STRICT_CITATIONS=true ./build.sh
```

---

## Format wejścia — `trace.json`

Plik akceptowany w dwóch postaciach:

- Spłaszczona lista rekordów: `[ {...}, {...}, ... ]`
- Eksport z wrapperem: `{ "results": [ { "items": [ ... ] } ] }`

Każdy rekord ma typowo:

| Pole | Typ | Opis |
|---|---|---|
| `trace_type` | string | np. `JunctionTaskTrace`, `DecisionOutcomeTrace`, `Buffer04EpisodeTrace`, `PackingDecisionTrace` |
| `business_key` | string | identyfikator bramy/decyzji, np. `K006B01\|A370026002261\|2\|1` |
| `nrkk` | string | identyfikator części |
| `panel_lp` | number | numer sekwencyjny panelu |
| `trace_id` | string | unikalny ID (zwykle 32–64 hex znaków) |
| `created_at_utc` | string | timestamp (obsługiwane dwa formaty: `dd/mm/yy HH:MM:SS,fffffffff` oraz `YYYY-mm-ddTHH:MM:SS[.ffffff]Z`) |
| `payload_json` | string | obiekt JSON, **często ucięty** w eksporcie |

Z `payload_json` ekstrahowane są m.in.: `SelectedTarget`, `SelectedSlotKey`, `FlowOutcome`,
`EpisodeOutcome`, `DecisionCase`, `TaskReasonCode`, `ObservedAfterSec`, `PanelsPassedReferencePoint`,
`QueueDepth320R`, `QueueDepthDelta320R`, `OccupiedPackingStations`, `WaitingPackingStations`,
`BlockedPackingStations`. Gdy `json.loads()` zawodzi z powodu ucięcia, używany jest regex-fallback,
który odzyskuje pojedyncze pola — w praktyce uratowywane jest >90% rekordów.

---

## Artefakty wyjściowe

| Plik | Format | Producent | Konsumenci |
|---|---|---|---|
| `bench.jsonl` | JSONL (BenchItem) | `tracebench.py build` | `run-llm`, `run`, `dashboard.py`, fallback |
| `answers.jsonl` | JSONL ({id, answer, provider, model}) | `tracebench.py answer-deterministic`, `tracebench.py run-llm` lub wrapper `generate_deterministic_answers.py` | `tracebench.py run`, `dashboard.py` |
| `report.json` | JSON ({items, avg_score, pass_rate, strict_citations, results[]}) | `tracebench.py run` | `dashboard.py` |
| `decisions.jsonl` | JSONL (DecisionRow, 15 pól) | `decision_model build-dataset` | `opportunity_miner`, `causal_attribution`, `chat_ui` (preferowany), `live_decision`, testy |
| `opportunities.json` | JSON ({summary, top_opportunities[], suggested_rule_changes[], parameters}) | `opportunity_miner audit` | `chat_ui`, testy |
| `shadow_report.json` | JSON ({summary, decisions[], top_positive_deltas[], top_negative_deltas[], breakdowns}) | `traceability_shadow_eval.py` | `chat_ui`, audyt walidacji rekomendacji live |
| `causal_attribution.jsonl` | JSONL (Incident: outcome, severity, attribution[], background_share, narrative, citations) | `causal_attribution build` | `dashboard.py`, `chat_ui.py`, audyt, przyszłe LLM Q&A „dlaczego X?" |
| `causal_report.json` | JSON ({summary, top_affected_targets[], top_culprit_targets[], top_culprit_bundles[]}) | `causal_attribution build --report-out` lub `report` | `dashboard.py`, audyt operacyjny |
| `feature_items.jsonl` | JSONL (FeatureEvalItem) | `feature_eval build` | `oracle-answers`, `run`, testy |
| `feature_answers.jsonl` | JSONL ({id, answer}) | `feature_eval oracle-answers` | `feature_eval run` |
| `feature_report.json` | JSON ({items, avg_score, pass_rate, strict_citations, actions{interpret_trace, recommend_gate, historical_patterns}, results[]}) | `feature_eval run` | `chat_ui` (badge'y), audyt |
| `live_snapshot.json` | JSON (LiveSnapshot — selector, queue_depths, signals, candidate_metrics) | `snapshot_builder build` | `live_decision recommend`, UI server |
| `dashboard.html` | self-contained HTML | `tracebench_dashboard.py` | przeglądarka (Pages/S3) |
| `chat.html` | self-contained HTML | `traceability_chat_ui.py` | przeglądarka (Pages/S3) lub serwowany lokalnie przez `ui_server.py` |
| `architektura.html` | self-contained HTML | utrzymywany ręcznie | przeglądarka |

---

## Referencja CLI

### `tracebench.py`

```bash
# Buduje benchmark QA z trace.json
tracebench.py build --trace trace.json --out bench.jsonl [--limit-bundles 200]

# Wywołuje LLM (Gemini Batch lub OpenAI)
tracebench.py run-llm \
  --bench bench.jsonl --trace trace.json --out-answers answers.jsonl \
  --provider (openai|gemini) --model MODEL \
  [--gemini-batch]              # async batch (~50% taniej; max wait 48h)
  [--bundle-prompts]            # 1 prompt na business_key (zamiast 1 na pytanie)
  [--batch-poll-seconds 20]
  [--batch-max-wait-seconds N]
  [--batch-job-file PATH] [--no-write-batch-job-file]
  [--strict-citations]          # wymaga trace_id (nie tylko business_key)
  [--lang en|pl] [--max-items N] [--temperature 0.0]

# Scoring
tracebench.py run --bench bench.jsonl --answers answers.jsonl --out report.json \
  [--include-items] [--strict-citations]

# Cancel uruchomionego Gemini Batch (po Ctrl+C / timeout)
tracebench.py cancel-gemini-batch --name batches/JOB_ID
tracebench.py cancel-gemini-batch --from-file last_gemini_batch_job.txt
```

### `traceability_decision_model.py`

```bash
traceability_decision_model.py build-dataset --trace trace.json --out decisions.jsonl
traceability_decision_model.py recommend --dataset decisions.jsonl --business-key BK [--min-cases 1]
```

### `traceability_opportunity_miner.py`

```bash
traceability_opportunity_miner.py audit \
  (--dataset decisions.jsonl | --trace trace.json) \
  [--out opportunities.json] \
  [--min-delta 1.0] [--min-confidence low|medium|high] [--min-cases 1] \
  [--top 50] [--exclude-low-evidence]
```

### `traceability_causal_attribution.py`

```bash
# Wykryj incydenty i atrybuuj winę
traceability_causal_attribution.py build \
  --trace trace.json --dataset decisions.jsonl \
  --out causal_attribution.jsonl [--report-out causal_report.json] \
  [--window-min 15] [--tau-seconds 300] \
  [--top 5] [--min-blame 0.05] [--min-severity 1.0] \
  [--queue-overflow-delta 4.0] [--lang pl|en]

# Agreguj istniejący JSONL do raportu sumarycznego
traceability_causal_attribution.py report \
  --attribution causal_attribution.jsonl --out causal_report.json
```

### `traceability_feature_eval.py`

```bash
traceability_feature_eval.py build --trace trace.json --out feature_items.jsonl [--limit-bundles 200]
traceability_feature_eval.py oracle-answers --items feature_items.jsonl --out feature_answers.jsonl --strict-citations
traceability_feature_eval.py run --items feature_items.jsonl --answers feature_answers.jsonl \
  [--out feature_report.json] [--strict-citations] [--min-pass-rate 1.0]
traceability_feature_eval.py self-test --trace trace.json [--out feature_report.json] [--strict-citations]
```

### `tracebench_dashboard.py`

```bash
tracebench_dashboard.py --report report.json --out dashboard.html \
  [--bench bench.jsonl] [--answers answers.jsonl] \
  [--causal-attribution causal_attribution.jsonl] [--causal-report causal_report.json] \
  [--lang en|pl] [--title "..."]
```

### `traceability_chat.py`

```bash
# Pojedyncze pytanie (deterministyczny silnik lub agent Gemini)
traceability_chat.py ask (--trace trace.json | --dataset decisions.jsonl) \
  --question "..." [--output text|json] [--lang en|pl] \
  [--opportunities opportunities.json] [--causal-attribution causal_attribution.jsonl] \
  [--agent] [--agent-model gemini-3-flash-preview]

# Interaktywny czat w terminalu
traceability_chat.py chat (--trace trace.json | --dataset decisions.jsonl) \
  [--lang en|pl] [--agent] [--agent-model ...] \
  [--opportunities ...] [--causal-attribution ...]
```

### `traceability_chat_ui.py`

```bash
traceability_chat_ui.py (--trace trace.json | --dataset decisions.jsonl) \
  --out chat.html [--lang en|pl] [--title "..."] \
  [--max-opportunities 50] [--opportunities opportunities.json] [--shadow-report shadow_report.json]
```

### `traceability_shadow_eval.py`

```bash
traceability_shadow_eval.py (--trace trace.json | --dataset decisions.jsonl) \
  [--out shadow_report.json] [--min-confidence low|medium|high] \
  [--min-cases 1] [--exclude-low-evidence]
```

### `traceability_snapshot_builder.py`

```bash
traceability_snapshot_builder.py [build] \
  (--trace trace.json | --dataset decisions.jsonl) \
  [--business-key BK] [--trace-id ID] [--nrkk NRKK] \
  --out live_snapshot.json
```

### `traceability_live_decision.py`

```bash
traceability_live_decision.py recommend \
  --snapshot live_snapshot.json \
  (--dataset decisions.jsonl | --trace trace.json) \
  [--min-cases 3]
```

### `traceability_eval.py`

```bash
# Tryb interaktywny: zapytanie o konkretny business_key
traceability_eval.py --trace trace.json --business-key BK [--nrkk NRKK] [--panel-lp N] \
  [--answer TEXT] [--output json|text]
```

---

## Lokalny serwer UI z endpointami Pythona

```bash
python traceability_ui_server.py --host 127.0.0.1 --port 8000 [--root .]
```

Serwer (`http.server.ThreadingHTTPServer`) wystawia:

| Endpoint | Co robi |
|---|---|
| `GET /` lub `/chat.html` | Serwuje wygenerowany `chat.html` |
| `GET /dashboard.html` | Serwuje wygenerowany `dashboard.html` |
| `GET /architektura.html` | Serwuje wygenerowany `architektura.html` |
| `GET /api/health` | `{ok, root}` — sanity check |
| `GET /api/config` | Zwraca `runtime_config` (dostępność trace.json/dataset/opportunities/causal, czy `google-genai` jest zainstalowane, czy w ENV jest `GEMINI_API_KEY`) |
| `POST /api/chat/ask` | `{question, lang, source_mode}` → deterministyczna odpowiedź |
| `POST /api/agent/run` | Jak wyżej, ale wymusza tryb agentowy Gemini (potrzeba `gemini_api_key` w body lub w ENV) |
| `POST /api/snapshot/build` | Buduje `live_snapshot.json` (selektor wyciągany z `question`) |
| `POST /api/live/recommend` | Snapshot + live recommendation w jednym wywołaniu |

Te endpointy są używane przez przyciski **Uruchom API** w panelach CLI w `chat.html`. Klucz Gemini
jest trzymany tylko w `localStorage` przeglądarki i wysyłany do lokalnego serwera na żądanie.
Cache `ChatContext` jest `lru_cache(16)` — pierwsze wywołanie jest wolne, kolejne natychmiastowe.

---

## Zmienne środowiskowe

Używane przez `build.sh` (wszystkie opcjonalne; wartości domyślne są takie same jak default CLI):

| ENV | Domyślnie | Opis |
|---|---|---|
| `TRACE` | `trace.json` | ścieżka do pliku wejściowego |
| `LIMIT_BUNDLES` | `200` | maks. liczba bundli w benchmarku |
| `LLM_PROVIDER` | `gemini` | `gemini` lub `openai` |
| `LLM_MODEL` | `gemini-2.5-flash` | nazwa modelu |
| `STRICT_CITATIONS` | `true` | wymaga `trace_id` w odpowiedziach |
| `BATCH_POLL_SECONDS` | `20` | interwał pollingu Gemini Batch |
| `GEMINI_BATCH_MAX_WAIT_SECONDS` | `172800` (48h) | maks. wait time dla Batch |
| `GEMINI_CANCEL_BATCH_ON_INTERRUPT` | (unset) | `1` → Ctrl+C wywoła `batches.cancel` na zdalnej pracy |
| `GEMINI_BATCH_JOB_FILE` | `last_gemini_batch_job.txt` | gdzie zapisać ID joba (pomocne przy recovery) |
| `OPPORTUNITY_TOP` | `50` | limit `--top` dla opportunity miner |
| `SKIP_SHADOW_EVAL` | (unset) | `1` → pomiń `shadow_report.json` |
| `SKIP_CAUSAL` | (unset) | `1` → pomiń causal attribution |
| `CAUSAL_WINDOW_MIN` | `15` | okno look-back w minutach |
| `CAUSAL_TAU_SECONDS` | `300` | tau exponential decay (recency) |
| `CAUSAL_TOP` | `5` | maks. liczba contributorów per incydent |
| `CAUSAL_MIN_BLAME` | `0.05` | minimalny `blame_share` żeby trafić do `attribution[]` |
| `CAUSAL_MIN_SEVERITY` | `1.0` | minimum `severity` żeby zdarzenie było incydentem |
| `CAUSAL_LANG` | `pl` | język narracji (`pl`\|`en`) |
| `SKIP_TESTS` | (unset) | `1` → pomiń testy jednostkowe |
| `SKIP_DECISION_MINER` | (unset) | `1` → pomiń `decisions.jsonl` + `opportunities.json` (i causal) |

Konfiguracja agenta (odczytywana przez `traceability_chat_agent.py`):

| ENV | Domyślnie | Opis |
|---|---|---|
| `TRACEABILITY_AGENT_INPUT_USD_PER_1M` | `0.15` | Cena za 1 mln tokenów promptu (do estymacji kosztu w UI) |
| `TRACEABILITY_AGENT_OUTPUT_USD_PER_1M` | `0.6` | Cena za 1 mln tokenów completion |

Sekrety API (czytane bezpośrednio przez SDK, nie przez `build.sh`):

| ENV | Komponent |
|---|---|
| `GEMINI_API_KEY` lub `GOOGLE_API_KEY` | Gemini API (Batch, interactive, agent) |
| `OPENAI_API_KEY` | OpenAI API |

Klucz Gemini można też podać per request przez UI (`/api/agent/run` body lub w `chat.html`); jest
przechowywany tylko w `localStorage` przeglądarki.

---

## Integracje LLM

### Gemini (preferowane — tryb Batch)

- SDK: `google-genai`
- Model domyślny dla scoringu: `gemini-2.5-flash`
- Model domyślny dla agenta: `gemini-3-flash-preview`
- Batch API: async submit → poll co 20 s → download. Maks. czekanie 48 h.
- Pliki > 15 MiB: ładowane przez `files.upload()` i referowane przez `file_data`.
- ID joba zapisywane do `last_gemini_batch_job.txt` (recovery po wyłączeniu maszyny).
- Ctrl+C: jeśli `GEMINI_CANCEL_BATCH_ON_INTERRUPT=1`, wywoła `batches.cancel` zdalnie.

### OpenAI (alternatywa — synchroniczne)

- SDK: `openai`
- Wywołanie: `chat.completions.create` per pytanie (lub per bundle z `--bundle-prompts`).
- Brak Batch API w tym kliencie.

### Format promptu (scoring)

Single-item (JSON-wrapped):
```json
{
  "question": "...",
  "selector": "business_key=K006B01|A370026002261|2|1",
  "trace_summary": "...",
  "allowed_citations": ["<trace_id_1>", "<trace_id_2>", "..."],
  "requirements": ["odpowiedz po polsku", "zacytuj trace_id", "..."]
}
```

Bundle (`--bundle-prompts`, jedna wymiana na bundle):
```json
{
  "trace_summary": "...",
  "tasks": [
    { "id": "...", "question": "...", "selector": "...", "allowed_citations": [...] }
  ],
  "requirements": [...]
}
```

Oczekiwana odpowiedź: `{"answers": {"id1": "text1", "id2": "text2", ...}}`. Parser odporny na
markdown fences (` ```json ... ``` `).

### Agent Gemini (function-calling)

`traceability_chat_agent.py` rejestruje 7 deterministycznych narzędzi:

| Narzędzie | Co robi |
|---|---|
| `lookup_trace` | Selector → interpretacja + impact + cytowania |
| `recommend_gate` | Selector → rekomendacja + porównanie kandydatów + ryzyka/korzyści |
| `get_opportunities` | (Opc. selector) → top-N szans z `opportunity_report` |
| `get_incidents` | (Opc. selector) → incydenty causal, sortowane po severity |
| `get_patterns` | Sumaryczne wzorce historyczne (top targets, decision cases, outcome counts, starved_rate) |
| `search_decisions` | Filtry typu `selected_target=BUFOR_360`, `flow_outcome~starved`, `queue_depth_320r>5` |
| `compare_targets` | Porównanie kilku targetów po wybranej metryce (`avg_business_score`, `starved_rate`, ...) |

Gemini planuje sekwencję wywołań, a post-check po finalnej odpowiedzi wymusza, by każdy
`business_key=...` lub `trace_id=...` w tekście pochodził z wyników narzędzi. Inaczej model dostaje
ponowny prompt z listą dozwolonych cytowań i prosi go o przeredagowanie.

---

## Testy

```bash
python -m unittest discover -s tests -v
```

Każdy moduł ma własny plik testów:

- `tests/test_tracebench.py` — serializacja BenchItem, budowa promptów, parsowanie bundle answers, normalizacja nazw Gemini Batch.
- `tests/test_traceability_eval.py` — parsowanie zapisów, formaty timestampów, regex fallback dla uciętych payloadów.
- `tests/test_traceability_decision_model.py` — ekstrakcja DecisionRow, podobieństwo, business_score, rekomendacje.
- `tests/test_traceability_opportunity_miner.py` — mining szans, progi, propozycje reguł.
- `tests/test_traceability_causal_attribution.py` — klasyfikacja incydentów, atrybucja, blame normalizuje do 1, recency decay, okno czasowe, CLI.
- `tests/test_traceability_feature_eval.py` — generacja itemów, oracle answers, scoring per funkcja.
- `tests/test_traceability_chat.py` — routing pytań, intent detection, format `ChatAnswer`.
- `tests/test_traceability_chat_ui.py` — payload czatu, indeksowanie danych.
- `tests/test_traceability_chat_agent_cost.py` — koszt tokenów i billing estimates dla agenta.
- `tests/test_traceability_snapshot_builder.py` — snapshot builder z selectorami.
- `tests/test_traceability_live_decision.py` — parsowanie snapshotu i live recommendation.
- `tests/test_traceability_ui_backend.py` — `run_chat_ask`, `run_snapshot_build`, `run_live_recommend`, injection runnera agenta.
- `tests/test_dashboard.py` — generacja HTML, embed danych.

Fixtures: `tests/fixtures/traceability_fixture.json`.

W CI testy lecą zawsze przed buildem (`build.sh` linia 46–50). Lokalnie można pominąć:
`SKIP_TESTS=1 ./build.sh`.

---

## Deployment (GitHub Pages / S3)

Po `./build.sh`:

```bash
mkdir -p public
cp architektura.html dashboard.html chat.html report.json feature_report.json bench.jsonl public/
cp answers.jsonl feature_items.jsonl decisions.jsonl opportunities.json public/ 2>/dev/null || true
cp causal_attribution.jsonl causal_report.json public/ 2>/dev/null || true
```

Repo zawiera już katalog `public/` z gotowymi artefaktami (w tym `home.html` — mini-sitemap oraz
`index.html` będący kopią `architektura.html`).

Strona działa w pełni statycznie — nie wymaga backendu ani środowiska Python na serwerze. Lokalny
serwer Pythona (`traceability_ui_server.py`) jest opcjonalny i potrzebny tylko do przycisków
**Uruchom API** w `chat.html` (agent Gemini, snapshot, live decision).

---

## Struktura repo

```
.
├── tracebench.py                       # benchmark + LLM + scoring (4 podkomendy)
├── tracebench_dashboard.py             # generator dashboard.html
├── traceability_eval.py                # parser + normalizator (fundament)
├── traceability_decision_model.py      # decisions.jsonl + recommend_gate
├── traceability_opportunity_miner.py   # opportunities.json
├── traceability_causal_attribution.py  # atrybucja przyczynowa zdarzeń niepożądanych
├── traceability_feature_eval.py        # 3-etapowa mapa AI: ewaluacja
├── traceability_chat.py                # silnik Q&A (lib + CLI ask/chat)
├── traceability_chat_agent.py          # Gemini function-calling (7 deterministycznych narzędzi)
├── traceability_chat_ui.py             # generator chat.html (precompute + embed)
├── traceability_snapshot_builder.py    # condenses trace to live_snapshot.json
├── traceability_live_decision.py       # live recommender from snapshot telemetry
├── traceability_ui_backend.py          # warstwa serwisowa dla UI server
├── traceability_ui_server.py           # lokalny HTTP serwer (chat.html + /api/*)
├── generate_deterministic_answers.py   # fallback CI dla braku LLM
├── build.sh                            # orchestrator
├── architektura.html                   # interaktywna mapa przepływów + panel parametrów
├── README.md                           # ten plik
├── HOW TO IMPROVE.md                   # lista rzeczy do dalszej pracy
├── autoresearch.ideas.md               # notatki performance / ideas
├── public/                             # statyczne artefakty do hostingu
│   ├── architektura.html / index.html  # diagram (kopia)
│   ├── chat.html, dashboard.html
│   ├── home.html                       # mini-sitemap
│   └── *.jsonl, *.json                 # artefakty danych
├── tests/                              # unit testy (jeden plik na moduł)
│   ├── test_tracebench.py
│   ├── test_traceability_eval.py
│   ├── test_traceability_decision_model.py
│   ├── test_traceability_opportunity_miner.py
│   ├── test_traceability_causal_attribution.py
│   ├── test_traceability_feature_eval.py
│   ├── test_traceability_chat.py
│   ├── test_traceability_chat_ui.py
│   ├── test_traceability_chat_agent_cost.py
│   ├── test_traceability_snapshot_builder.py
│   ├── test_traceability_live_decision.py
│   ├── test_traceability_ui_backend.py
│   ├── test_dashboard.py
│   └── fixtures/traceability_fixture.json
└── (artefakty generowane: bench.jsonl, answers.jsonl, report.json,
     decisions.jsonl, opportunities.json, causal_attribution.jsonl, causal_report.json,
     feature_*.jsonl, feature_report.json, live_snapshot.json,
     dashboard.html, chat.html)
```

---

## Licencja / kontakt

Wewnętrzne narzędzie analityczne. Szczegóły kontraktów płynących między komponentami — w
[`architektura.html`](architektura.html); wartości parametrów biznesowych — w sekcji
[Parametry biznesowe](#parametry-biznesowe-wartości) i w bocznym panelu `architektura.html`.

5. calc-price-agent
# math-tool

A multi-agent playground built on the [AI SDK](https://sdk.vercel.ai/) (`ai` v5) and [Bun](https://bun.sh/). It ships four self-contained Bun workspaces:

| Workspace | What it does |
| --- | --- |
| `calc-agent/` | One-shot CLI that solves arithmetic word problems by calling `add`/`subtract`/`multiply`/`divide` tools. |
| `code-agent/` | Interactive coding REPL with `read_file` / `write_file` / `run_command` tools and per-tool stdin confirmations. |
| `pricing-agent/` | One-shot CLI that runs a `parse → search (eBay) → compute → present` pipeline and prints a price quote. |
| `web/` | Bun HTTP server (port `3000`) that exposes both the calculator and pricing agents over SSE, plus a static UI (`index.html`). |
| `shared/` | Reusable models, parsing helpers, eBay client, and the deterministic pricing engine consumed by `pricing-agent` + `web`. |

Each workspace has its own `package.json`, `bun.lock`, and `node_modules` — there is **no root lockfile**. Run every command from inside the workspace folder you care about.

## Prerequisites

- **Bun** ≥ 1.2 (`brew install oven-sh/bun/bun` or [bun.sh/install](https://bun.sh/install))
- An LLM provider key (whichever matches the model you pick — see [Environment](#environment))
- For `pricing-agent` (and `web` in pricing mode): eBay Browse API credentials (`EBAY_APP_ID`, `EBAY_CERT_ID`)

Verify Bun:

```bash
bun --version   # 1.2.x
```

## Environment

| Variable | Required for | Notes |
| --- | --- | --- |
| `MODEL` | all agents | Defaults to `claude-sonnet-4-5`. Resolver: `claude-*` → Anthropic, `gpt-*` → OpenAI Chat, `o<N>*` / `*codex*` → OpenAI Responses. Anything else throws. |
| `ANTHROPIC_API_KEY` | any `claude-*` model | |
| `OPENAI_API_KEY` | any `gpt-*` / `o<N>*` / `*codex*` model | |
| `EBAY_APP_ID`, `EBAY_CERT_ID` | `pricing-agent`, `web` pricing mode | OAuth client-credentials for the Browse API. |
| `EBAY_ENV` | optional | `production` (default) or `sandbox`. |
| `EBAY_MARKETPLACE` | optional | `EBAY_DE` (default), `EBAY_US`, or `EBAY_GB`. |
| `EBAY_CURRENCY` | optional | `EUR` (default), `USD`, or `GBP`. |
| `PORT` | optional (web only) | Port the web server listens on; defaults to `3000`. |
| `YOLO` | optional (`code-agent` only) | Set to `1` to skip per-tool stdin confirmations. |

Tip: drop these into a local shell init or `direnv`/`.envrc`. The repo intentionally has no `.env` loader to keep secrets explicit.

## Install

`bun install` is per-workspace. Install everything once after cloning:

```bash
cd shared        && bun install
cd ../calc-agent && bun install
cd ../code-agent && bun install
cd ../pricing-agent && bun install
cd ../web        && bun install
```

If you only touch one workspace, only that workspace needs an install.

## Run

### calc-agent (CLI, one-shot)

```bash
cd calc-agent
ANTHROPIC_API_KEY=… bun run start "What is 12 * 4 + 6?"
# → ... (model takes tool calls) ... 54
```

The agent is constrained to **always** use the calculator tools — it must never "simplify" arithmetic in plain text.

### code-agent (CLI, REPL)

```bash
cd code-agent
ANTHROPIC_API_KEY=… bun run start
# Each tool call (read_file / write_file / run_command) prompts for [y]es / [n]o / [a]llow-always.
# Set YOLO=1 to skip prompts for the session.
YOLO=1 ANTHROPIC_API_KEY=… bun run start
```

`run_command` shells out via `/bin/sh` with a 10 MB output buffer — treat it as privileged and **never** expose `code-agent` (or `web`'s code mode) on a public network without auditing `makeCodeTools` in `web/server.ts`.

### pricing-agent (CLI, one-shot)

```bash
cd pricing-agent
EBAY_APP_ID=… EBAY_CERT_ID=… ANTHROPIC_API_KEY=… \
  bun run start "blue Wrangler jeans, men, L, discount"
# Exit code 0 → a quote was presented.
# Exit code 1 → no match / parse failure / model budget exhausted.
```

The pipeline is hardcoded to `parse_shopping_query → search_offers → compute_quote → present_quote`. The model is **forbidden** from doing arithmetic itself; all numbers come from `compute_quote`.

### web (HTTP + SSE + static UI)

```bash
cd web
ANTHROPIC_API_KEY=… EBAY_APP_ID=… EBAY_CERT_ID=… bun run dev
# bun run dev    → hot-reload (preferred while developing)
# bun run start  → no hot reload
# Open http://localhost:3000
```

Endpoints exposed by `server.ts`:

| Method & path | Purpose |
| --- | --- |
| `GET /` | Static `index.html` shell for both agents. |
| `POST /api/chat` | SSE stream. Body: `{ "prompt": string, "mode": "calc" \| "code" \| "pricing", "sessionId"?: string }`. Streams `text-delta`, `tool-call`, `tool-result`, `approval-needed` (code mode), `quote-ready` (pricing mode), and a terminal `{type:"done"}`. |
| `POST /api/approve` | Code-mode approval. Body: `{ sessionId, approvalId, decision: "allow"\|"deny"\|"always" }`. Closing the SSE stream auto-denies any pending approvals. |
| `POST /api/pricing/approve` | Pricing-mode approval. Body: `{ sessionId, quoteId, decision: "approve"\|"reject" }`. Returns `409` if the quote was already decided or expired, `404` if unknown. |

Smoke test the calc path (no eBay creds needed):

```bash
curl -N -X POST http://localhost:3000/api/chat \
  -H 'content-type: application/json' \
  -d '{"prompt":"2+2","mode":"calc"}'
# Expect SSE `data:` frames ending with {"type":"done"}.
```

Smoke test the pricing path (needs eBay creds + LLM key):

```bash
curl -N -X POST http://localhost:3000/api/chat \
  -H 'content-type: application/json' \
  -d '{"prompt":"blue Wrangler jeans, men, L","mode":"pricing","sessionId":"s1"}'
# Stream parks on a `quote-ready` event. Approve with:
curl -X POST http://localhost:3000/api/pricing/approve \
  -H 'content-type: application/json' \
  -d '{"sessionId":"s1","quoteId":"<quote-id-from-stream>","decision":"approve"}'
```

## Validate (typecheck + tests)

There is no lint config. After edits, at minimum typecheck the workspaces you touched:

```bash
cd shared        && bunx tsc --noEmit -p tsconfig.json
cd ../web        && bunx tsc --noEmit -p tsconfig.json
cd ../pricing-agent && bunx tsc --noEmit -p tsconfig.json
```

Run the unit + golden tests:

```bash
cd shared          && bun test   # pricing engine + eBay client (93 tests)
cd ../pricing-agent && bun test   # agent loop + tool surface  (21 tests)
cd ../web          && bun test   # SSE server contracts        (9 tests)
```

`calc-agent` and `code-agent` have no automated tests — exercise them with the CLI smoke tests above.

## Repo Layout

```
math-tool/
├── AGENTS.md            # build/run/operational notes consumed by Cursor agents
├── IMPLEMENTATION_PLAN.md
├── PROMPT_build.md      # used by loop.sh for headless Claude Code runs
├── README.md            # this file
├── loop.sh              # headless agent driver (commits + pushes per iteration)
├── calc-agent/          # CLI: arithmetic via tools
├── code-agent/          # CLI: read/write/run with stdin approvals
├── pricing-agent/       # CLI: parse → search → compute → present
├── web/                 # HTTP/SSE server + static UI for calc + pricing
├── shared/              # models, parsing, eBay client, pricing engine
│   ├── ebay/            # Browse API client + tests
│   ├── parsing/         # natural-language → ShoppingQuery
│   ├── pricing/         # deterministic compute + golden fixtures
│   └── models.ts        # zod schemas for every wire shape
└── specs/               # numbered design specs (data models, parsing, tools, …)
```

## Patterns to Preserve

These are duplicated on purpose right now — keep them in sync until they get extracted:

- **Model resolution** (`resolveModel`) is duplicated in `calc-agent/index.ts`, `code-agent/index.ts`, `pricing-agent/index.ts`, and `web/server.ts`. Update all four if routing rules change.
- **Calculator tool surface** (`add`/`subtract`/`multiply`/`divide`) and its system prompt live in both `calc-agent/index.ts` and `web/server.ts` (`calcTools`).
- **Coding tool surface** (`read_file`/`write_file`/`run_command`) lives in `code-agent/index.ts` (stdin confirm) and `web/server.ts` (`makeCodeTools`, SSE approval). Behavior must stay equivalent.
- All tool schemas use `zod` with `.describe()` — keep the descriptions, they feed the model's tool docs.
- Stream chunk readers prefer `part.input ?? part.args` and `part.text ?? part.textDelta` for AI SDK version drift.
- Step budgets: `stepCountIs(15)` for calc, `stepCountIs(25)` for code, `stepCountIs(8)` for pricing. Bumping these has real cost/latency impact — justify before changing.

## Troubleshooting

- `Unknown model: …` — `MODEL` doesn't match any of the prefixes in `resolveModel`. Use a `claude-*`, `gpt-*`, `o<N>*`, or `*codex*` id.
- `EBAY_APP_ID` / `EBAY_CERT_ID` missing — pricing tooling will throw at startup. Set both, even in `EBAY_ENV=sandbox`.
- `bun install` reports "could not find a package.json" — you're not inside the workspace folder. Each workspace must be installed from its own directory.
- Web smoke test hangs before `{type:"done"}` — verify the LLM key for the model in `MODEL` is set; the SSE stream waits for the model to terminate.

6. trading
## BUILD COMMANDS

```bash
# Build
python -m py_compile monitoring/backend/main.py

# Start (dev)
python -m monitoring.backend.main

# Start (prod)
uvicorn monitoring.backend.main:app --host 0.0.0.0 --port 8000 --workers 4
```

## TEST/VALIDATION COMMANDS

```bash
# Health check
curl http://localhost:8000/api/health

# Symbol routing verify
python -c "from monitoring.backend.config import get_settings, get_exchange_for_symbol; print(get_settings().SYMBOLS)"

# Binance test
curl -s "https://fapi.binance.com/fapi/v1/ticker/24hr?symbol=BTCUSDT"

# Kraken test
curl -s "https://api.kraken.com/0/public/Ticker?pair=XBTUSD"
```

## LOOPBACK EVALUATION

After work completion:
2. `python -m monitoring.backend.main` → "Application startup complete"
3. `curl /api/health` → status: "healthy"
4. Logs show NO "invalid symbol" or "400"

## OPERATIONAL LEARNINGS

- Symbol routing: Use `get_service_for_symbol()`, NOT `binance_service` directly
- Settings: `@lru_cache` requires process restart for `.env` changes
- Exchange errors: Log + return None (graceful degradation)
- Service pattern: Singleton modules, import directly

## KEY FILES

| Purpose | File |
|---------|-------|
| Build entry | `monitoring/backend/main.py` |
| Config | `monitoring/backend/config.py` |
| Exchange services | `monitoring/backend/services/{binance,kraken,kucoin}_service.py` |
| Executor | `monitoring/backend/services/autonomous_executor.py` |
| Market data | `monitoring/backend/services/market_data_service.py` |

## ANTI-PATTERNS

- NEVER run evolution on mainnet
- ALWAYS use `async/await` for network calls
- ALWAYS use `get_service_for_symbol()` for exchange routing

7. localise
MVP (Lokalise-style): background AI translation, missed-key detection, optional human verification — built to compress translator turnaround.

# MY CV
Full-stack engineer specialising in AI tooling for industry. I take products end to end, RAG platforms, automation pipelines, internal MVPs, picking whichever stack each problem calls for. Backed by six years in software and three years designing parts in the automotive industry.
EXPERIENCE
AI Engineer  ·  WiśniowskiFeb 2025 — Present
Building internal AI tools for a manufacturer of industrial doors, gates and fences.
Deployed enterprise RAG (RAGFlow) on a Linux server with full telemetry and monitoring; integrated with Open-WebUI through a custom pipeline as the company-wide chat front-end.
Built MS Teams transcript & recording pipeline — webhook-driven ingestion and analysis of meeting content, reaching ~90% accuracy on extraction tasks.
Designed and shipped a full-stack translation platform MVP (Lokalise-style): background AI translation, missed-key detection, optional human verification — built to compress translator turnaround.
Prototyping a manufacturing-intelligence tool on top of marszruta (process-route) data — chat with historical traces, surface past product data fast, suggest new routing paths.
Software Developer  ·  Freelance / IndependentAug 2023 — Jan 2025
Shipped a responsive staking application UI across web and mobile; prototyped AI tooling (predictive models, chat interfaces) to validate product ideas quickly.
Full-Stack Developer  ·  PlaydateJun 2023 — Aug 2023
Built a version-control system for mobile releases so users stuck on outdated iOS/Android builds could be migrated cleanly.
Fixed a critical onboarding bug blocking Android users; pushed the app to the store; owned CI/CD on AWS Beanstalk.
Software Developer  ·  AriableDec 2022 — Jun 2023
Delivered the front-end MVP for a trading platform and a real-time Node.js + PostgreSQL watcher monitoring on-chain transactions.
Software Developer  ·  BlockchainWares SoftwareDec 2020 — Dec 2022
Built balance, contacts and sanction-screening features for a regulated financial application; documented a custom Material-UI library in Storybook and set up the Cypress E2E foundation (2FA, IMAP, UI login).
Product / CAD Engineer  ·  Varroc Lighting Systems · Auto Design · Alpha TechnologyJan 2017 — Jul 2020
Three years across the automotive supply chain — the engineering foundation under everything I build now.
Designed front and rear lamp components in CATIA V5 at Varroc — concept, feasibility, simulation, tooling, BOM and GD&T drawings.
Worked on interior parts (Instrument Panel, Door Trim) for Audi at Auto Design, including porting parts between CATIA V5 and NX 11.
Prepared technical inquiries for the VW Group at Alpha Technology and ran internal training on plastics processes.


