# Adrian Góra

AI Engineer | aplikacje LLM, RAG i agenci AI dla produkcji | TypeScript, Python

- Email: adrian.gora14@gmail.com
- Portfolio: https://adagora.github.io/
- GitHub: https://github.com/adagora
- LinkedIn: https://www.linkedin.com/in/adrian-gora/
- Lokalizacja: Polska · Zdalnie lub hybrydowo, także zdalnie dla firm z UE i spoza niej
- Dostępność: Dostępny od 1 listopada 2026, bez okresu wypowiedzenia
- Forma współpracy: B2B lub umowa o pracę
- Szukane role: AI Engineer, LLM Engineer, Generative AI Engineer, AI Solutions Engineer, Forward Deployed Engineer, Full-stack Engineer (TypeScript / Python), AI focus

## Profil

Od lutego 2025 buduję wewnętrzne narzędzia AI u producenta przemysłowego: firmowego asystenta RAG, pipeline spotkań Teams, portal tłumaczeń z AI i analitykę marszrut. Wcześniej przez cztery lata pisałem w TypeScript i React (fintech, web3), a przez trzy i pół roku projektowałem części samochodowe w CATIA V5.

## Doświadczenie

### AI Engineer · Wiśniowski (02.2025 – obecnie)

Stanowisko formalne: Specjalista ds. AI. Wewnętrzne narzędzia AI dla polskiego producenta bram, drzwi i ogrodzeń.

- **Firmowy asystent RAG:** Wdrożyłem RAGFlow na serwerze Linux z telemetrią i monitoringiem i podłączyłem go do Open WebUI jako firmowy czat. 90% trafnych odpowiedzi.
- **Pipeline spotkań Microsoft Teams:** Skanuje spotkania jednej grupy w lokalnym (on-premises) Outlooku i włącza automatyczne nagrywanie. Transkrypcje i nagrania przychodzą przez Microsoft Graph (webhooki i polling), a LLM zamienia je w raporty JSON.
- **Portal tłumaczeń z AI:** Zbudowałem wewnętrzny portal zamiast lokalise.com. Gemini wstępnie tłumaczy każdy klucz, tłumacze akceptują albo poprawiają, a brakujące klucze są oznaczane. Każda decyzja jest logowana, więc widać, jak często AI trafia.
- **Analityka marszrut:** Rozwijam prototyp, w którym technolog rozmawia z historią przebiegów produkcji, testuje nowe ustawienia i dostaje propozycje marszrut.
- **Wywiady AI o usprawnieniach:** Działa na sandboxie Gemini managed agents. Po 15-minutowym wywiadzie (głos lub tekst) o codziennej pracy pisze raport z pomysłami na automatyzację, dopisuje wiedzę do wiki prowadzonego przez LLM i zamienia powtarzalne zadania w pliki SKILL.md dla agentów.

## Wybrane projekty

### Visual RAG dla dokumentacji technicznej

Znajduje właściwą stronę w katalogach i dokumentacji PDF po tym, jak strona wygląda (rysunki, tabele, wymiary), a potem odpowiada z obrazów stron modelem wizyjnym i cytuje stronę.

Results: 55% → 84% (top-1 page, visual-only vs hybrid); 100% (recall with LLM page reranking); p = 0.001 (hybrid beats visual 11–0 where they disagree).

Stack: Python, FAISS, BM25 + RRF, PixelRAG, Gemini, Claude
Code: https://github.com/adagora/try_pixelRAG_optional_BM25_hybrid_JEV

### Wycena detali obrabianych z modelu CAD

Wycenia detal obrabiany mechanicznie na podstawie modelu STEP dla narzędziowni. Geometrię i cenę liczy kod, a model językowy ocenia technologię i ryzyka jak kierownik narzędziowni.

Results: STEP → PLN (geometry from OpenCASCADE, price from shop rates); 3 states (pass, fail or need-info on every check, each citing its source).

Stack: Python, OpenCASCADE, build123d, trimesh, ezdxf, Claude / OpenAI
Code: https://github.com/adagora/cad-tools/tree/wycena/w1-foundation/skills/wycena

### Audyt tłumaczeń z sędzią LLM

Wykrywa niespójną terminologię w korpusie tłumaczeń bez glosariusza. Kod wydobywa rozbieżności z 7 040 kluczy, a sędzia LLM rozstrzyga każdą z nich.

Results: 99,933 (judgments in 3 minutes); ~300 ms (check on every edit in the review app).

Stack: TypeScript, TypeSafe Jev, Excel
Code: https://github.com/adagora/jev-experiments

### Wieloagentowy playground do wycen

Cztery workspace'y Bun na Vercel AI SDK: agent-kalkulator z narzędziami, REPL do kodowania z potwierdzaniem narzędzi, agent wyceny na danych z eBay (parse → search → compute → present) i serwer strumieniujący agentów przez SSE.

Stack: TypeScript, Bun, Vercel AI SDK, Claude, OpenAI, eBay API
Code: https://github.com/adagora/calc-price-agent

### Demo ML na strumieniu danych, 2. miejsce w hackathonie

Transakcje z Binance na żywo przez sieć Streamr, prognozy ARIMA na strumieniu, wyniki na wykresie. 2. miejsce w LearnWeb3 AI Hackathon.

Stack: Node.js, Streamr, ARIMA
Code: https://github.com/adagora/streamr-ml-demo

### Prywatne repozytoria (kod do pokazania na rozmowie)

- Cairn: CLI do analizy przepływu pracy: Odpowiada, gdzie praca czeka, gdzie wraca i który wybór marszruty częściej się udawał przy tej samej mieszance zleceń. Każde twierdzenie ma liczność próby, podstawę i informację, czy wolno je cytować. Wynik to jedna koperta JSON na wywołanie, zaprojektowana w pierwszej kolejności dla agentów AI. (Go, BPMN, VDA 5050)
- PDF wiki: Lokalna baza wiedzy: wrzucasz PDF, uruchamiasz ingest i dostajesz powiązane wiki w Markdown z wyszukiwaniem semantycznym. Claude opisuje każdą rycinę. (TypeScript, Claude, qmd)
- Sterowanie ramieniem robota z przeglądarki: Kalibracja i codzienne sterowanie ramieniem LeRobot SO-ARM100 z laptopa lub telefonu: klawiatura i gamepad, e-stop i jeden właściciel portu szeregowego. (Python, LeRobot, WebSockets)
- HAR → opis API: Nagrywasz ruch przeglądarki raz i dostajesz opis potrzebny do odtworzenia API poza przeglądarką: autoryzacja, endpointy, kształty body i szablony curl. (Python)
- meat: diff do czytania: Zamienia duży diff kodu w mniejszy diff do czytania, skupiony na istotnych zmianach. CLI w TypeScript, zmigrowane z Go. (TypeScript, Go)

### Wcześniejsze eksperymenty

- [Ralph loop for coding agents](https://github.com/adagora/loop-coding-agent): Plan and build prompt loop with AGENTS.md and specs, for Claude Code, opencode and Kilo Code. (Shell)
- [Roaming RAG](https://github.com/adagora/experiment-with-roaming-RAG): Collapses a long Markdown document to its headings and lets the model expand only the sections it needs. (Python)
- [MiCA regulation Q&A](https://github.com/adagora/book-ai-chat): Answers questions about the EU crypto-asset regulation (MiCA) from the regulation text, with PostgresML for semantic search. A 2024 project, still live; the free hosting tier can take a minute to wake up. (Node.js, PostgresML, OpenAI) Live demo: https://cryptoregulationtalk.onrender.com/
- [Say: speech to text in the browser](https://github.com/adagora/voice-to-text-research): Voice notes transcribed locally with Whisper on Transformers.js, with a rich-text editor. (React, Transformers.js, Whisper)
- [Video frames analyzer](https://github.com/adagora/llm-video-extract-frames): Extracts frames from video, analyses them with Gemini, tracks cost and skips duplicate work. (TypeScript, Gemini)
- [Hand-tracking interaction experiments](https://github.com/adagora/mediapipe-for-fun): Human-computer interaction prototypes with MediaPipe. (Python, MediaPipe)
- [Eboombox](https://github.com/adagora/eboombox): Turns Cardano transactions into sound. (Next.js, Cardano)

## Wcześniejsze doświadczenie

### Software Engineer · Freelance (08.2023 – 01.2025)

- Prototypowałem narzędzia AI (modele predykcyjne, czat nad dokumentami) do testowania pomysłów i dostarczyłem interfejs aplikacji stakingowej na web i mobile (TypeScript, React, ethers). 2. miejsce w LearnWeb3 AI Hackathon.

### Full-Stack Engineer · Playdate App Limited (06.2023 – 08.2023)

- Zbudowałem wersjonowanie wydań, dzięki któremu użytkowników starych wersji iOS i Android dało się zmigrować, naprawiłem krytyczny błąd onboardingu na Androidzie i odpowiadałem za CI/CD na AWS Elastic Beanstalk (React Native, Django).

### Software Engineer · Ariable (12.2022 – 06.2023)

- Dostarczyłem MVP frontendu platformy do handlu kontraktami perpetual na NFT oraz watcher transakcji on-chain w czasie rzeczywistym (Node.js + PostgreSQL). Analizowałem też kontrakty Solidity.

### Frontend Engineer · BlockchainWares Software (12.2020 – 12.2022)

- Budowałem funkcje sald, kontaktów i screeningu sankcyjnego w regulowanej aplikacji finansowej (React, TypeScript, React Query), bibliotekę komponentów Material-UI w Storybooku i testy E2E w Cypress.

### Web Developer (równolegle, część etatu) · Nervos Network (12.2021 – 05.2022)

- Rozwijałem aplikację do głosowań DAO i zbudowałem interfejs mostu (bridge) ułatwiający wejście do sieci.

### Product Engineer · Varroc Lighting Systems, Kraków (06.2018 – 07.2020)

- Projektowałem elementy lamp przednich i tylnych w CATIA V5: koncepcja, mocowania, wykonalność, wyniki symulacji i testów, zapytania narzędziowe, BOM i rysunki z GD&T. Współpraca z działem R&D w Czechach.

### CAD Designer · Auto Design, Bielsko-Biała (09.2017 – 02.2018)

- Projektowałem elementy wnętrza (deska rozdzielcza, boczki drzwi) dla Audi; przenosiłem części z CATIA V5 do NX 11.

### Project Engineer · Alpha Technology (01.2017 – 08.2017)

- Przygotowywałem zapytania techniczne dla Grupy VW, pracowałem w zespole D-FMEA i szkoliłem pracowników z przetwórstwa tworzyw.

## Umiejętności

- Aplikacje LLM: RAG (hybrid BM25 + vector, reranking, citations), Visual RAG over PDFs, Agents and tool calling, LLM-as-judge, Structured extraction, Evaluation and benchmarks, Prompt engineering
- Modele i platformy: Claude, Gemini, OpenAI, Vercel AI SDK, RAGFlow, Open WebUI, FAISS, Microsoft Graph
- Języki programowania: TypeScript, Python, Go, JavaScript, SQL
- Backend i infrastruktura: Node.js, Bun, Express, NestJS, FastAPI, PostgreSQL, Prisma, Redis, Linux servers, GitHub Actions, AWS Elastic Beanstalk, Telemetry and monitoring
- Frontend: React, Next.js, React Native, React Query, Material-UI, Storybook, Cypress, D3
- Inżynieria i CAD: CATIA V5 (advanced), Siemens NX, AutoCAD, GD&T, BOM, D-FMEA, Plastics, OpenCASCADE / build123d, STEP and DXF
- Programowanie z agentami AI: Claude Code, Codex, Agent skills, AGENTS.md

## Wykształcenie

- mgr inż., Inżynieria Materiałowa (inżynieria powierzchni i obróbka cieplna), Politechnika Śląska, Gliwice (2010–2016)
- Wymiana, Technologia przeróbki plastycznej (Umformtechnik), TU Bergakademie Freiberg, Niemcy (2014–2015)
- Wymiana, Nauka o materiałach, Universidad de Oviedo, Hiszpania (2013)

## Języki

- polski: ojczysty
- angielski: B2, swobodna praca zawodowa
- niemiecki: B1 (certyfikat DSH-2)

## Certyfikaty

- CATIA V5, advanced level, CADSOL Design Poland (2018)
- AutoCAD, levels 1 and 2, Autodesk (2015)
- Generative AI Essentials for Software Developers

## Nagrody i publikacje

- 2. miejsce, LearnWeb3 AI Hackathon (2023)
- Współautor: Laser surface treatment technologies: laser ablation

---

Wyrażam zgodę na przetwarzanie moich danych osobowych zawartych w niniejszym dokumencie dla potrzeb niezbędnych do realizacji procesu rekrutacji, zgodnie z Rozporządzeniem Parlamentu Europejskiego i Rady (UE) 2016/679 z dnia 27 kwietnia 2016 r. (RODO).
