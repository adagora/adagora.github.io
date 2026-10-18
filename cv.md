# Adrian Góra

AI / Software Engineer | LLM apps, RAG, agents | TypeScript, Python

- Email: adrian.gora14@gmail.com
- Portfolio: https://adagora.github.io/
- GitHub: https://github.com/adagora
- LinkedIn: https://www.linkedin.com/in/adrian-gora/
- Location: Poland · Remote or hybrid, also open to remote roles in the EU and worldwide
- Availability: Available from 1 November 2026, no notice period
- Contract: B2B or employment contract
- Target roles: AI Engineer, Software Engineer

## Profile

AI Engineer at Wiśniowski since February 2025, building internal tools for document search, translation, meeting reports and production analysis. Before that, four years of TypeScript and React in fintech and Web3.

## Experience

### AI Engineer · Wiśniowski (Feb 2025 – present)

Official title: Specjalista ds. AI. Internal AI tools for a Polish manufacturer of industrial doors, gates and fences.

- **Company-wide RAG assistant:** Deployed RAGFlow on a Linux server and connected it to Open WebUI as the company chat. It answers from the company's technical PDFs with complex layouts. Telemetry and monitoring are built for EU AI Act compliance.
- **Microsoft Teams meeting pipeline:** Scans one group's meetings in on-premises Outlook and switches on automatic recording. Transcripts and recordings come in through Microsoft Graph (webhooks and polling), and an LLM turns them into structured JSON reports.
- **AI translation portal:** Built an internal portal to replace lokalise.com. Gemini pre-translates every key, translators accept or fix it, and missing keys are flagged. To keep terms consistent across languages, I added statistics, translator helpers and a generated starting glossary. Every decision is logged, which shows how often the AI is right.
- **Process-route analytics:** Working on a prototype that lets engineers chat with historical production traces, test new settings and get suggested routes. A deterministic core computes the numbers, and experimental modules add an LLM and autoresearch.
- **AI interviews for process improvement:** After a 15-minute voice or text interview about someone's daily work, it writes an automation report, adds what it learned to an LLM wiki and turns repeatable tasks into SKILL.md files for agents. Runs on the Gemini managed-agents sandbox.

## Selected projects

### PDF-Insight: validated document extraction

Inspects PDFs locally, redacts sensitive text and extracts summaries, parties, amounts and dates as validated JSON. Shared Zod schemas connect the React frontend, Cloudflare Worker and Gemini responses.

Results: 298 (unit, contract and property tests documented in the repository); 29.1 s (p95 across 20 public uploads in the 6 October 2026 benchmark).

- Original PDF bytes remain local; only redacted text reaches the API.
- Checks amounts and dates against source text and flags values it cannot verify. These checks do not establish the accuracy of every summary sentence.
- Benchmark: 19 of 20 public uploads completed within 30 seconds; maximum 41.0 seconds. Long-term reliability remains under observation.

Stack: TypeScript, React, Cloudflare Workers, Gemini, Zod, Playwright
Code: https://github.com/adagora/PDF-Insight

### Cairn: process-route analysis

Shows where work waits, where it loops back and which routing choice succeeded more often once the mix of work is held fixed. Every number opens into the records behind it. The code is private; the live demo runs on public datasets, and its free hosting can take a minute to wake up.

- Each claim carries its sample size, basis and whether it may be quoted, and a marked finding can be re-proved on new data.
- The CLI prints one JSON envelope per call, with ready-to-quote sentences, caveats and refused questions, so an AI agent can use it without inventing numbers.
- The demo opens on online retail orders (UCI, CC BY 4.0); the factory data the tool was built for stays private. Includes a robot-fleet dispatch testbed (VDA 5050).

Stack: Go, TypeScript, Preact, BPMN, VDA 5050
Live demo: https://manufacturing-tool.onrender.com/

### VisualRAG

Searches technical PDFs using page images and BM25 text retrieval, then answers with citations to source pages.

- Hybrid retrieval fuses page-image matches with BM25 text matches using Reciprocal Rank Fusion.
- Seven retrieval modes can be compared in the web UI; answers cite the retrieved source pages.

Credit: Built on StarTrail’s PixelRAG; I added page-level retrieval, BM25 fusion, citations, evaluation and the web UI.

Stack: Python, FAISS, BM25 + RRF, PixelRAG, Gemini, Claude
Code: https://github.com/adagora/visualRAG

### CAD quoting engine for machined parts

Quotes a machined part from its STEP file (a 3D CAD model) for a tool shop. Code measures the part and computes the price; an AI model reviews the machining process and risks the way a shop manager would.

Results: STEP file → price (a 3D CAD model goes in, a quote in PLN comes out, based on the shop's own rates).

- Volume, mass, envelope and cost-driving features come from OpenCASCADE. Price is machining time × shop rate, and a physics-based floor on cutting time stops the model from inventing hours.
- Preflight marks each check pass, fail or need-info with a cited source (ISO 2768, ISO 286, material data). Any fail or missing input makes the quote non-binding.
- Web app for estimators who don't program: 3D preview, 2D drawing input, editable rates, print to PDF and a make-or-buy check against SendCutSend. Covered by 8 test modules.

Credit: My wycena skill inside a fork of the MIT-licensed text-to-cad library.

Stack: Python, OpenCASCADE, build123d, trimesh, ezdxf, Claude / OpenAI
Code: https://github.com/adagora/cad-tools/tree/wycena/w1-foundation/skills/wycena

### LLM-judged translation audit

Finds inconsistent terms in translations that never had a glossary. Code finds the disagreements across 7,040 texts, and an AI model decides each one.

Results: 99,933 (AI decisions in 3 minutes); ~300 ms (to re-check a text after each edit in the review app).

- Exports an Excel workbook for sign-off and a keyboard-driven review app where translators curate the glossary; decided terms are never re-arbitrated.
- Sibling demo judge-sheets: type a column header such as Urgency and 300 rows fill with semantic predictions in about 3.5 s, as =JUDGE, =PICK and =RATE formulas you can inspect in the formula bar.

Stack: TypeScript, TypeSafe Jev, Excel
Code: https://github.com/adagora/jev-experiments

### EternalChat: conversation as memory

Local terminal chat implementing the UniiChat design: append-only message logs feed a background tree of summaries. Each turn receives a size-budgeted view, with zoom back to original messages. Python with no runtime dependencies.

Stack: Python, Claude, UniiChat
Code: https://github.com/adagora/EternalChat

### meat: reading diffs

Turns a large code diff into a smaller reading diff focused on the consequential changes. TypeScript CLI, migrated from Go.

Stack: TypeScript, Go
Code: https://github.com/adagora/diff-explain

### HSS heat treatment

Steel quench simulation with a narrated Manim explainer.

Stack: Manim
Code: https://github.com/adagora/HSS-heat-treatment

### Private repositories (code shown on request)

- PDF wiki: Local-first knowledge base: drop in a PDF, run ingest, get a cross-linked Markdown wiki with semantic search. Claude vision describes every figure. (TypeScript, Claude, qmd)
- Robot arm control in the browser: Calibration and daily control of a LeRobot SO-ARM100 from a laptop or phone: keyboard and gamepad input, an e-stop, and a single owner for the serial port. (Python, LeRobot, WebSockets)
- HAR to API brief: Record browser traffic once and get a brief for rebuilding the API outside the browser: auth, endpoints, body shapes and curl templates. (Python)
- loop-me: employee interviews: Agent interviews employees and produces automation specifications with ROI estimates. (AI agents)
- Transport planner: Turns Excel orders into truck loads, routes and 3D loading plans. (Excel, 3D)
- Allegro selling skill: Agent skill for selling on Allegro with human approval. (Agent skills)

### Additional projects

- [Multi-agent pricing playground](https://github.com/adagora/calc-price-agent): Four Bun workspaces on the Vercel AI SDK: a tool-calling calculator agent, a coding REPL with per-tool confirmations, an eBay pricing agent (parse → search → compute → present) and a web server that streams the agents over SSE. (TypeScript, Bun, Vercel AI SDK, Claude, OpenAI, eBay API)
- [Streaming ML demo, hackathon 2nd place](https://github.com/adagora/streamr-ml-demo): Live Binance trades through the Streamr network, ARIMA forecasts on the stream, results on a chart. 2nd place at the LearnWeb3 AI Hackathon. (Node.js, Streamr, ARIMA)
- [Ralph loop for coding agents](https://github.com/adagora/loop-coding-agent): A plan-and-build prompt loop driven by AGENTS.md and specs, for Claude Code, opencode and Kilo Code. (Shell)
- [Roaming RAG](https://github.com/adagora/experiment-with-roaming-RAG): Collapses a long Markdown document to its headings and lets the model expand only the sections it needs. (Python)
- [MiCA regulation Q&A](https://github.com/adagora/book-ai-chat): Answers questions about the EU crypto-asset regulation (MiCA) from the regulation text, with PostgresML for semantic search. A 2024 project, still live; the free hosting tier can take a minute to wake up. (Node.js, PostgresML, OpenAI) Live demo: https://cryptoregulationtalk.onrender.com/
- [Say: speech to text in the browser](https://github.com/adagora/voice-to-text-research): Voice notes transcribed locally with Whisper on Transformers.js, with a rich-text editor. (React, Transformers.js, Whisper)
- [Video frames analyzer](https://github.com/adagora/llm-video-extract-frames): Extracts frames from video, analyses them with Gemini, tracks cost and skips duplicate work. (TypeScript, Gemini)
- [Hand-tracking interaction experiments](https://github.com/adagora/mediapipe-for-fun): Human-computer interaction prototypes with MediaPipe. (Python, MediaPipe)
- [Eboombox](https://github.com/adagora/eboombox): Turns Cardano transactions into sound. (Next.js, Cardano)

## Earlier experience

### Software Engineer · Freelance (Aug 2023 – Jan 2025)

- Prototyped AI tools (predictive models, chat over documents) to test product ideas, and shipped a staking app UI for web and mobile (TypeScript, React, ethers). Took 2nd place at the LearnWeb3 AI Hackathon.

### Full-Stack Engineer · Playdate App Limited (Jun 2023 – Aug 2023)

- Built release version control so users on outdated iOS and Android builds could be migrated, fixed a critical Android onboarding bug and owned CI/CD on AWS Elastic Beanstalk (React Native, Django).

### Software Engineer · Ariable (Dec 2022 – Jun 2023)

- Delivered the front-end MVP of an NFT perpetual trading platform and a real-time Node.js + PostgreSQL watcher for on-chain transactions. Also reviewed the Solidity contracts.

### Frontend Engineer · BlockchainWares Software (Dec 2020 – Dec 2022)

- Built balance, contacts and sanction-screening features for a regulated financial application (React, TypeScript, React Query), a Material-UI component library in Storybook and the Cypress E2E suite.

### Web Developer (part-time, in parallel) · Nervos Network (Dec 2021 – May 2022)

- Contributed to a DAO voting app and built a bridge UI for onboarding to the network.

### Product Engineer · Varroc Lighting Systems, Kraków (Jun 2018 – Jul 2020)

- Designed front and rear lamp components in CATIA V5: concept, fixing, feasibility, simulation and test results, tooling requests, BOM and GD&T drawings. Worked with the Czech R&D team.

### CAD Designer · Auto Design, Bielsko-Biała (Sep 2017 – Feb 2018)

- Designed interior parts (instrument panel, door trim) for Audi and ported parts from CATIA V5 to NX 11.

### Project Engineer · Alpha Technology (Jan 2017 – Aug 2017)

- Prepared technical inquiries for the VW Group, worked in the D-FMEA team and trained staff on plastics processes.

## Skills

- LLM applications: RAG (hybrid BM25 + vector, reranking, citations), Visual RAG over PDFs, Agents and tool calling, LLM-as-judge, Structured extraction, Evaluation and benchmarks, Prompt engineering
- Models and platforms: Claude, Gemini, OpenAI, Vercel AI SDK, RAGFlow, Open WebUI, FAISS, Microsoft Graph
- Languages: TypeScript, Python, Go (one project), Rust (6 months), JavaScript, SQL
- Backend and infrastructure: Node.js, Bun, Express, NestJS, FastAPI, PostgreSQL, Prisma, Redis, Linux servers, GitHub Actions, AWS Elastic Beanstalk, Telemetry and monitoring
- Frontend and testing: React, Next.js, React Native, React Query, Material-UI, Storybook, Cypress, D3, Playwright, pytest
- Engineering and CAD: CATIA V5 (advanced), Siemens NX, AutoCAD, GD&T, BOM, D-FMEA, Plastics, OpenCASCADE / build123d, STEP and DXF
- AI-assisted development: Claude Code, Codex, Agent skills, AGENTS.md
- Web3: Solidity, Foundry, ethers.js, Cardano

## Education

- MSc Eng., Materials Engineering (surface engineering and heat treatment), Silesian University of Technology, Gliwice (2010–2016)
- Exchange, Forming technology (Umformtechnik), TU Bergakademie Freiberg, Germany (2014–2015)
- Exchange, Materials science, Universidad de Oviedo, Spain (2013)

## Languages

- Polish: Native
- English: Professional working (B2)
- German: Limited working (B1, DSH-2 certificate)

## Certificates

- CATIA V5, advanced level, CADSOL Design Poland (2018)
- AutoCAD, levels 1 and 2, Autodesk (2015)
- Generative AI Essentials for Software Developers

## Awards and publications

- 2nd place, LearnWeb3 AI Hackathon (2023)
- Co-author: Laser surface treatment technologies: laser ablation

---

I agree to the processing of my personal data provided in this document for the purpose of the recruitment process, in accordance with Regulation (EU) 2016/679 (GDPR).
