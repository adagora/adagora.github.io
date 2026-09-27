# Adrian Góra

AI Engineer | LLM apps, RAG and AI agents for manufacturing | TypeScript, Python

- Email: adrian.gora14@gmail.com
- Portfolio: https://adagora.github.io/
- GitHub: https://github.com/adagora
- LinkedIn: https://www.linkedin.com/in/adrian-gora/
- Location: Poland · Remote or hybrid, also open to remote roles in the EU and worldwide
- Availability: Available from 1 November 2026, no notice period
- Contract: B2B or employment contract
- Target roles: AI Engineer, LLM Engineer, Generative AI Engineer, AI Solutions Engineer, Forward Deployed Engineer, Full-stack Engineer (TypeScript / Python), AI focus

## Profile

Since February 2025 I have been building internal AI tools at an industrial manufacturer: a company-wide RAG assistant, a Teams meeting pipeline, an AI translation portal and production-route analytics. Before that I spent four years on TypeScript and React in fintech and web3, and three and a half years designing car parts in CATIA V5.

## Experience

### AI Engineer · Wiśniowski (Feb 2025 – present)

Official title: Specjalista ds. AI. Internal AI tools for a Polish manufacturer of industrial doors, gates and fences.

- **Company-wide RAG assistant:** Deployed RAGFlow on a Linux server and connected it to Open WebUI as the company chat. It answers from a large set of complex technical PDFs. Telemetry and monitoring are built for EU AI Act compliance.
- **Microsoft Teams meeting pipeline:** Scans one group's meetings in on-premises Outlook and switches on automatic recording. Transcripts and recordings come in through Microsoft Graph (webhooks and polling), and an LLM turns them into structured JSON reports.
- **AI translation portal:** Built an internal portal to replace lokalise.com. Gemini pre-translates every key, translators accept or fix it, and missing keys are flagged. Our texts exist in many languages and must stay consistent, so I added statistics, helpers for translators and an automatically generated starting glossary. Every decision is logged, so we can see how often the AI gets it right.
- **Process-route analytics:** Working on a prototype that lets engineers chat with historical production traces, test new settings and get suggested routes. A deterministic core computes the numbers, and experimental modules add an LLM and autoresearch.
- **AI interviews for process improvement:** Runs on the Gemini managed-agents sandbox. After a 15-minute voice or text interview about someone's daily work, it writes an automation report, adds what it learned to an LLM wiki, and turns repeatable tasks into SKILL.md files for agents.

## Selected projects

### Visual RAG for technical PDFs

Finds the right page in product catalogues and technical PDFs by how the page looks (drawings, tables, dimension callouts), then answers from the page images with a vision model and cites the page.

Results: 55% → 84% (top-1 page, visual-only vs hybrid); 100% (recall with LLM page reranking); p = 0.001 (hybrid beats visual 11–0 where they disagree).

- Benchmarked 7 retrieval modes on 38 questions whose gold page is verified by string match (114 in the full set), with Wilson intervals and an exact McNemar test for every pair.
- Hybrid search (pixel index + BM25, fused with reciprocal rank fusion) raised top-1 from 55% to 84%. The same benchmark showed that a paid query-expansion stage added nothing, so the default mode skips it.
- Web UI and API with a per-question retrieval mode, page citations and an answerability score.

Credit: Thin layer over PixelRAG (StarTrail): retrieval modes, hybrid search, evaluation and UI are mine.

Stack: Python, FAISS, BM25 + RRF, PixelRAG, Gemini, Claude
Code: https://github.com/adagora/try_pixelRAG_optional_BM25_hybrid_JEV

### CAD quoting engine for machined parts

Quotes a machined part from its STEP model for a tool shop. Code measures the geometry and computes the price; the language model reviews technology and risks the way a shop manager would.

Results: STEP → PLN (geometry from OpenCASCADE, price from shop rates); 3 states (pass, fail or need-info on every check, each citing its source).

- Volume, mass, envelope and cost-driving features come from OpenCASCADE. Price is machining time × shop rate, and a physics-based floor on cutting time stops the model from inventing hours.
- Preflight marks each check pass, fail or need-info with a cited source (ISO 2768, ISO 286, material data). Any fail or missing input makes the quote non-binding.
- Web app for estimators who don't program: 3D preview, 2D drawing input, editable rates, print to PDF and a make-or-buy check against SendCutSend. Covered by 8 test modules.

Credit: My wycena skill inside a fork of the MIT-licensed text-to-cad library.

Stack: Python, OpenCASCADE, build123d, trimesh, ezdxf, Claude / OpenAI
Code: https://github.com/adagora/cad-tools/tree/wycena/w1-foundation/skills/wycena

### LLM-judged translation audit

Finds inconsistent terminology in a translation corpus that never had a glossary. Code mines the disagreements across 7,040 keys and an LLM judge settles each one.

Results: 99,933 (judgments in 3 minutes); ~300 ms (check on every edit in the review app).

- Exports an Excel workbook for sign-off and a keyboard-driven review app where translators curate the glossary; decided terms are never re-arbitrated.
- Sibling demo judge-sheets: type a column header such as Urgency and 300 rows fill with semantic predictions in about 3.5 s, as =JUDGE, =PICK and =RATE formulas you can inspect in the formula bar.

Stack: TypeScript, TypeSafe Jev, Excel
Code: https://github.com/adagora/jev-experiments

### Multi-agent pricing playground

Four Bun workspaces on the Vercel AI SDK: a tool-calling calculator agent, a coding REPL with per-tool confirmations, an eBay pricing agent (parse → search → compute → present) and a web server that streams the agents over SSE.

Stack: TypeScript, Bun, Vercel AI SDK, Claude, OpenAI, eBay API
Code: https://github.com/adagora/calc-price-agent

### Streaming ML demo, hackathon 2nd place

Live Binance trades through the Streamr network, ARIMA forecasts on the stream, results on a chart. 2nd place at the LearnWeb3 AI Hackathon.

Stack: Node.js, Streamr, ARIMA
Code: https://github.com/adagora/streamr-ml-demo

### Private repositories (code shown on request)

- Cairn: evidence CLI for process routing: Answers where work waits, where it loops back and which routing choice succeeded more often with the work mix held fixed. Each claim carries its sample size, basis and whether it may be quoted, and findings can be re-proved on new data. Output is one JSON envelope per call, built for AI agents first. Includes a robot-fleet dispatch testbed (VDA 5050). (Go, BPMN, VDA 5050)
- PDF wiki: Local-first knowledge base: drop in a PDF, run ingest, get a cross-linked Markdown wiki with semantic search. Claude vision describes every figure. (TypeScript, Claude, qmd)
- Robot arm control in the browser: Calibration and daily control of a LeRobot SO-ARM100 from a laptop or phone: keyboard and gamepad input, an e-stop, and a single owner for the serial port. (Python, LeRobot, WebSockets)
- HAR to API brief: Record browser traffic once and get a brief for rebuilding the API outside the browser: auth, endpoints, body shapes and curl templates. (Python)
- meat: reading diffs: Turns a large code diff into a smaller reading diff focused on the consequential changes. TypeScript CLI, migrated from Go. (TypeScript, Go)

### Earlier experiments

- [Ralph loop for coding agents](https://github.com/adagora/loop-coding-agent): Plan and build prompt loop with AGENTS.md and specs, for Claude Code, opencode and Kilo Code. (Shell)
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
- Languages: TypeScript, Python, Go, JavaScript, SQL
- Backend and infrastructure: Node.js, Bun, Express, NestJS, FastAPI, PostgreSQL, Prisma, Redis, Linux servers, GitHub Actions, AWS Elastic Beanstalk, Telemetry and monitoring
- Frontend: React, Next.js, React Native, React Query, Material-UI, Storybook, Cypress, D3
- Engineering and CAD: CATIA V5 (advanced), Siemens NX, AutoCAD, GD&T, BOM, D-FMEA, Plastics, OpenCASCADE / build123d, STEP and DXF
- AI-assisted development: Claude Code, Codex, Agent skills, AGENTS.md

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
