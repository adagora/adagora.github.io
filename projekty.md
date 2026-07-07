1. [**loop-me-enterprise**](https://github.com/adagora/loop-me-enterprise)  
   \# loop-me interview  
     
   A dark, Palantir-style chat page where an employee is interviewed by the \*\*loop-me\*\*  
   skill running on Gemini Managed Agents. One question at a time, voice or text. The  
   conversation and the skill's sandbox persist across turns, so the skill accumulates  
   state and writes its workflow specs exactly as it would in a coding agent.  
     
   \`\`\`  
   employee → chat page (voice/text) → /api/chat → Managed Agent (multi-turn) → spec  
   \`\`\`  
   \# LIMITATIONS of gemini sandbox for NOW  
   Preview status: Managed agents are in preview. Features and schemas may change.  
   Base agent: Only antigravity-preview-05-2026 is supported as base\_agent.  
   No versioning: Agent versioning and rollback are not yet available.  
   No subagent nesting: Subagent delegation is not yet supported.  
   You can have up to 1000 managed agents.  
     
   \#\# Run it  
     
   \`\`\`bash  
   npm install  
   npm run mock          \# scripted interviewer, no API key — preview the UX at :9090  
   \`\`\`  
     
   For real interviews, copy \`.env.example\` to \`.env\`, add your \`GEMINI\_API\_KEY\`  
   (https://aistudio.google.com/apikey), then \`npm start\` → http://localhost:9090.  
     
   Open in \*\*Chrome or Edge\*\* for voice (built-in browser speech); text works anywhere.  
   Domyślny język rozmowy to \*\*polski\*\* (agent przełączy się, jeśli napiszesz inaczej).  
   Wywiad jest \*\*anonimowy\*\* — opcjonalnie podaj imię i nazwisko w nagłówku, jeśli ma trafić do raportu.  
     
   \#\# Architecture  
   \`\`\`  
   flowchart TB  
     subgraph Browser\["Browser (public/)"\]  
       UI\["index.html \+ interview.css"\]  
       JS\["client.js"\]  
       AdminUI\["admin.html \+ admin.css"\]  
       AdminJS\["admin-client.js"\]  
     end  
     
     subgraph Express\["Node / Express (src/ → dist/src/)"\]  
       Static\["express.static(public/)"\]  
       Auth\["auth/ — OIDC, cookies, RBAC"\]  
       API\["REST API"\]  
       Sessions\["interviewSession — in-memory TTL"\]  
     end  
     
     subgraph External\["External services"\]  
       Gemini\["Gemini Managed Agents"\]  
       Sandbox\["Remote sandbox — NOTES.md, workflows/\*.md"\]  
       Mongo\["MongoDB — reports"\]  
       Langfuse\["Langfuse — optional traces"\]  
       IdP\["OIDC IdP — optional SSO"\]  
     end  
     
     UI \--\> Static  
     AdminUI \--\> Static  
     JS \--\> API  
     AdminJS \--\> API  
     
     Static \--\> Auth  
     API \--\> Auth  
     Auth \--\> IdP  
     
     JS \--\>|"POST /api/interview/session"| Sessions  
     JS \--\>|"POST /api/chat, /preview, /finish"| API  
     AdminJS \--\>|"GET /api/admin/reports"| API  
     
     API \--\> Sessions  
     API \--\>|"buildTurn \+ interactions.create"| Gemini  
     Gemini \--\> Sandbox  
     API \--\>|"finish → normalizeReport"| Mongo  
     API \--\> Langfuse  
     
     skills\["./skills/\*.md"\] \--\>|"first turn mount"| Gemini  
   \`\`\`  
     
   \#\# How it works  
     
   \- The first turn mounts \`loop-me\` and \`grilling\` from \`./skills\`, plus a short  
     bootstrap in \`turn.ts\` that tells the agent to read those skills and start the  
     interview (skills alone do not auto-invoke — \`loop-me\` has  
     \`disable-model-invocation: true\`). Each later turn passes \`previous\_interaction\_id\`  
     \+ the same \`environment\`, so the conversation and sandbox (the evolving  
     \`NOTES.md\`, \`workflows/\*.md\`, \`spec.md\`) persist.  
   \- \*\*Idea speaks first.\*\* Right after a session is created the client requests the  
     agent's greeting (\`/api/interview/greeting\`), so the sandbox boots and the first  
     question appears while the employee is still reading the intro — the cold start  
     is invisible.  
   \- \*\*Replies stream.\*\* Chat, preview, and the greeting arrive token-by-token over  
     SSE — words start appearing within seconds instead of a spinner for the whole  
     agent run. Works in mock mode too (\`npm run mock\` simulates the streaming).  
   \- \*\*Preview the loop ▷\*\* runs one specified workflow once with sample data and shows  
     the \*\*Brief\*\* the human would review — without advancing the interview.  
   \- \*\*Finish & save\*\* finalizes the spec, then (if \`MONGODB\_URI\` is set) writes a report  
     into MongoDB, and downloads the sandbox snapshot to \`./out/\<session\>.snapshot.tar\`.  
   \- \*\*Leader view\*\* at \`/admin\` — Palantir-style dashboard to browse finished reports  
     (workflows, markdown, JSON). Optional \`ADMIN\_TOKEN\` for access control.  
     
   \#\# Continuity: rehydration, checkpoints, employee memory  
     
   Gemini sandboxes auto-stop after \~15 min idle and are retained \~7 days — without  
   countermeasures an expiry mid-interview would lose the spec. Three layers prevent that:  
     
   \- \*\*Checkpoints\*\* — every \`SNAPSHOT\_EVERY\_TURNS\` (default 3\) chat turns the sandbox  
     tar is saved to \`./out\` and the extracted artifacts (\`NOTES.md\`, \`workflows/\*.md\`,  
     \`spec.md\`) are cached on the session (MongoDB, survives restarts).  
   \- \*\*Rehydration\*\* — when the environment turns out to be gone, the next message  
     rebuilds a \*\*fresh\*\* sandbox: skills \+ checkpointed working files \+ a transcript of  
     the conversation so far, with a system note telling the agent to continue where it  
     left off (no re-greeting). Resume of an expired session returns \`rehydratable: true\`  
     instead of a 410 whenever restore material exists.  
   \- \*\*Employee memory\*\* — when an authenticated employee starts a \*new\* interview, their  
     most recent report is mounted read-only under \`.agents/memory/\` so the advisor  
     greets them as a returning interviewee, confirms what still holds, and probes for  
     new loops instead of re-asking basics. Disable with \`EMPLOYEE\_MEMORY=0\`.  
     
   \#\# Workflow chat: the spec is a living document  
     
   Saving the spec no longer ends the conversation — it opens \*\*maintenance mode\*\*:  
     
   \- \*\*Chat after save\*\* — a finished interview stays resumable and chattable. The first  
     message after a save carries a maintenance note to the agent: update  
     \`workflows/\*.md\` / \`NOTES.md\` / \`spec.md\` as things get agreed ("przesuńmy raport  
     na czwartek" edits the spec, no forms or tickets).  
   \- \*\*Re-save updates the report\*\* — clicking \*\*Zapisz spec\*\* again re-finalizes and  
     \*updates\* the existing MongoDB report for the session (original \`createdAt\`  
     preserved, \`updatedAt\` refreshed, \`revision\` incremented) instead of duplicating  
     it. Re-saving with no new messages is rejected (\`no\_changes\_since\_save\`).  
   \- \*\*Brief feedback\*\* — every Preview Brief renders with \*\*✓ Zatwierdź brief\*\* /  
     \*\*Poproś o zmiany\*\* actions; the decision flows back into the conversation (and  
     therefore the spec) as a checkpoint approval or a change request.  
     
   \#\# Agent tools (optional)  
     
   By default the interviewer uses the sandbox filesystem only (\`AGENT\_TOOLS\` blank).  
   Enable grounded Microsoft help and richer previews with env vars (see \`.env.example\`):  
     
   | Variable | Effect |  
   | \--- | \--- |  
   | \`AGENT\_MCP\_LEARN=1\` | Appends \[Microsoft Learn MCP\](https://learn.microsoft.com/en-us/training/support/mcp) — official Excel, Power Query, Power Automate docs |  
   | \`AGENT\_MCP\_CONTEXT7=1\` \+ \`CONTEXT7\_API\_KEY\` | Appends \[Context7 MCP\](https://context7.com) — version-specific library/API docs (Python, Node, SDKs) |  
   | \`AGENT\_TOOLS=\[{"type":"code\_execution"},{"type":"url\_context"}\]\` | Base tools; combined with MCP servers on chat/preview |  
   | \`AGENT\_NETWORK\_ALLOWLIST=\[{"domain":"pypi.org"}\]\` | Allow pip installs when preview runs code |  
     
   \*\*Per-route policy\*\* (\`src/config/agent.ts\`): chat uses MCP \+ pasted URLs;  
   preview adds \`code\_execution\` (sample runs, ROI math, mermaid diagrams); finish uses  
   no tools. Learn MCP → Microsoft products; Context7 → libraries/APIs. See \`loop-me/SKILL.md\` § Tools.  
     
   \#\# Tracing  
     
   Every turn (chat, preview, finish) is traced:  
     
   \- \*\*File (default):\*\* append-only JSONL at \`./traces/\<sessionId\>.jsonl\` — enough for  
     local audit, replay, and debugging. Set \`TRACE\_FILE=0\` to disable.  
   \- \*\*Langfuse (recommended for prod):\*\* set \`LANGFUSE\_PUBLIC\_KEY\`, \`LANGFUSE\_SECRET\_KEY\`,  
     and \`LANGFUSE\_BASE\_URL\` (your self-hosted URL). Uses the official SDK (\`flushAt: 1\`).  
     For self-signed TLS set \`LANGFUSE\_SKIP\_SSL\_VERIFY=true\`. One Langfuse trace per interview  
     session; each turn becomes a generation. Anonymous users appear as \`anonymous\`; a  
     provided name is used as \`userId\`.  
     
   \#\# ROI capture  
     
   The interview asks (one extra question per loop) how often it runs, roughly how many  
   hours per week it costs, which tools it touches, and how confident the estimate is  
   (\`effort.confidence\`: high / moderate / low; \`effort.basis\`: self\_report / sampled /  
   measured in the report schema). The admin analytics overview sums hours into \*\*Est.  
   hours/week found\*\*, with a high-confidence subtotal when labels are present — use  
   that split when prioritizing what to automate first.  
     
   Spec completeness is enforced during the interview itself (\`loop-me\` \+ \`grilling\`):  
   Preview Brief approve/reject, and \`openQuestions\[\]\` in the finish JSON (the loop-me  
   equivalent of low-reliability metrics — gaps go here, not in headline numbers).  
     
   Finished reports render as a leader brief (What's broken / What we'd do / What we  
   don't know) in the admin Markdown tab.  
     
   \#\#\# Optional: quantify before you build  
     
   For a high-priority loop, leaders can run \[Measure Twice, Spend Once\](https://github.com/mattbeane/measure-twice-workflow-analyzer)  
   (\`mtso analyze\`) on that loop's communication exhaust (Slack threads, emails, meeting  
   notes) to get calibrated cycle-time and bottleneck metrics with reliability flags —  
   \*before\* funding implementation. loop-me finds and specs the automation; MTSO  
   measures how bad the status quo actually is.  
     
   \#\# Skills  
     
   Skills live in \`./skills\`, one folder each with a \`SKILL.md\`. Edit and restart — the  
   next first turn mounts it fresh. Bundled: \`loop-me\` and \`grilling\` (from  
   \[mattpocock/skills\](https://github.com/mattpocock/skills)).  
     
   \#\#\# Skills to consider (future)  
     
   Keep the set small — every mounted skill costs first-turn bytes and  
   instruction-following attention. Candidates, in rough priority order:  
     
   | skill | what it would add | prerequisite |  
   | \--- | \--- | \--- |  
   | \`brief-writing\` | House style for Briefs: length, structure, links-not-assets, decision framing | none — sharpen preview quality now |  
   | \`spec-quality\` | Authoring checklist so specs are born complete (loop-me definition of done) | none |  
   | \`skill-forge\` | Compile a finished workflow spec into a new org \`SKILL.md\` folder (spec → reusable skill) | skills registry / review flow |  
   | \`dept-vocab/\*\` | Per-department canonical vocabulary packs seeded from accumulated NOTES.md | enough finished interviews per dept |  
     
   Rule of thumb: prefer improving \`loop-me\`/\`grilling\` over adding a new skill; add a  
   skill only when the knowledge is \*modular\* (used by some sessions, not all).  
     
   \#\# Files  
     
   | file | what it is |  
   | \--- | \--- |  
   | \`src/server.ts\` | Express app: \`/api/chat\`, \`/api/preview\`, \`/api/finish\`, \`/api/handoff/\*\`, rehydration \+ checkpoints |  
   | \`src/turn.ts\` | builds each turn (first vs continuation) \+ mock scripts |  
   | \`src/rehydrate.ts\` | sandbox rehydration \+ returning-employee memory |  
   | \`src/environment.ts\` / \`src/snapshot.ts\` | sandbox lifecycle, tar extraction, handoff markdown |  
   | \`src/skills.ts\` | scans \`./skills\` and mounts every file |  
   | \`src/finishInterview.ts\` / \`src/report.ts\` | finalize pipeline, prose/JSON split, dashboard shape |  
   | \`src/interviewSession.ts\` / \`src/session-store.ts\` | TTL sessions (memory \+ MongoDB write-through) |  
   | \`src/admin.ts\`, \`src/analytics.ts\`, \`src/leaderboard.ts\` | leader dashboard \+ \`/api/admin/\*\` |  
   | \`src/auth/\*\` | OIDC SSO, cookies, RBAC (admin / org leader / user) |  
   | \`src/mongo.ts\` / \`src/local-reports.ts\` | report persistence (MongoDB / on-disk) |  
   | \`src/trace.ts\` / \`src/langfuse.ts\` | file \+ Langfuse turn tracing |  
   | \`src/operator.ts\` | CLI: list skills, sharpen reports, pull from Mongo |  
   | \`AGENTS.md\` | contributor/agent guide: commands, invariants, env vars |  
   | \`.env.example\` | config |  
   | \`render.yaml\` | Render Blueprint (web service) |  
     
   \#\# Deploy on Render  
     
   1\. Push this repo to GitHub and connect it in \[Render\](https://render.com).  
   2\. \*\*New → Blueprint\*\* and select \`render.yaml\`, \*\*or\*\* create a \*\*Web Service\*\* manually:  
      \- \*\*Root Directory:\*\* leave \*\*empty\*\* (repo root — \`package.json\` is NOT in \`src/\`)  
      \- \*\*Build command:\*\* \`npm install && npm run build\`  
      \- \*\*Start command:\*\* \`npm start\`  
      \- \*\*Health check path:\*\* \`/healthz\`  
   3\. Set environment variables (Dashboard → Environment):  
     
   | Variable | Required | Notes |  
   | \--- | \--- | \--- |  
   | \`GEMINI\_API\_KEY\` | yes | Real interviews |  
   | \`MONGODB\_URI\` | recommended | Atlas URI — reports \+ \`/admin\` |  
   | \`ADMIN\_TOKEN\` | recommended | Protects \`/admin\` in prod |  
   | \`LANGFUSE\_\*\` | optional | Tracing (preferred over file traces on Render) |  
   | \`TRACE\_FILE\` | \`0\` | Render disk is ephemeral — blueprint sets this |  
   | \`SNAPSHOT\_EVERY\_TURNS\` | optional | Sandbox checkpoint cadence (default 3; \`0\` disables) |  
   | \`EMPLOYEE\_MEMORY\` | optional | \`0\` disables returning-employee memory |  
     
   Render sets \`PORT\` automatically; the server binds to \`0.0.0.0\`.  
     
   \*\*Build error \`ENOENT .../src/package.json\`?\*\* Root Directory in Render is set to \`src\` by mistake.  
   Clear it (Settings → Root Directory → blank) and redeploy.  
     
   \*\*Production caveats:\*\* \`./out\` snapshot tars are lost on restart/redeploy (Render disk  
   is ephemeral). With \`MONGODB\_URI\` set, interview sessions — including checkpointed  
   sandbox artifacts used for rehydration — persist in MongoDB and survive restarts.  
   Use MongoDB for reports/sessions and Langfuse for traces.  
     
   \#\# Tests  
     
   \`\`\`bash  
   npm test   \# builds, then runs all suites offline — mock mode, no API key  
   \`\`\`  
     
   \#\# Credits  
     
   The \`loop-me\` and \`grilling\` skills are from  
   \[mattpocock/skills\](https://github.com/mattpocock/skills), MIT License  
   © 2026 Matt Pocock.  
     
2. [**alike-pintrest**](https://github.com/adagora/alike-pintrest)  
   \# AGENTS.md — working in this repository  
     
   Read \`README.md\` first for what the project \*is\* (domain, architecture, feature catalog).  
   This file is the operational guide: how to build, test, specify, and track work without  
   breaking the project's quality gates or its multi-agent workflow.  
     
   \#\# Ground rules  
     
   \- \*\*Go module \`routeseq\`\*\*, Go ≥ 1.26. Engine code lives in \`internal/\`; the acceptance  
     adapter layer in \`acceptance/\`; there is intentionally no product binary yet (see beads).  
   \- \*\*Determinism is a contract.\*\* Every ranking breaks ties by target name ascending; every  
     reported probability/lift/share is rounded to 2 decimals at the presentation edge.  
     Acceptance scenarios pin exact values — nondeterminism is a bug.  
   \- \*\*Mapping-driven, dataset-neutral.\*\* Engines never hard-code dataset field names. New  
     roles go through \`Mapping\` types \+ \`internal/fieldmap\` binding/validation, and get a  
     \`\*\_mapping\` rejection scenario.  
   \- \*\*Dependency inversion is binding.\*\* High-level (policy) packages never know about  
     low-level (detail) packages — even when they call them, they call through abstractions.  
     Go idiom: define the interface \*\*where it is consumed\*\* (high-level side); the low-level  
     module implements it and so depends upward. Existing models to copy: \`recall.Scorer\` /  
     \`EntryScorer\` (harness-owned, adapter-implemented), \`runtime.Registry\`/\`StepFunc\`.  
     New details from the roadmap (export readers, config loaders, durable backends, CLI/HTTP  
     transports) are plug-ins onto engine-owned contracts; engine packages never import them.  
     When touching a concrete coupling (e.g. \`predict.Predictor\` holding \`\*graph.Builder\`),  
     prefer narrowing it to a consumer-defined read interface.  
   \- \*\*Keep environmentally unsuitable code at the boundary.\*\* \`cmd/\` shells (argv,  
     filesystem, process exit) hold no logic; their testable logic lives in \`internal/gen\`,  
     \`internal/runner\`, etc. Preserve this split for any new binary.  
   \- \*\*Worktree-local toolchain.\*\* Scripts export \`GOPATH\`/\`GOMODCACHE\`/\`GOCACHE\` under  
     \`.gocache/\` — don't run bare \`go test\` with global caches in sandboxed contexts; prefer  
     the scripts. Use \`./tmp/\` (not \`/tmp\`) for scratch files.  
     
   \#\# Verification  
     
   \`\`\`sh  
   bash scripts/verify.sh               \# unit+coverage → acceptance → property (the standard suite)  
   bash scripts/acceptance.sh           \# parse features → generate entry points → run them  
   bash scripts/property.sh             \# property tests (build tag \`property\`, kept out of coverage/CRAP)  
   bash scripts/crap.sh                 \# crap4go: fails if any function scores \> 6  
   bash scripts/dry.sh                  \# dry4go structural duplication report  
   bash scripts/acceptance-mutation.sh  \# APS gherkin-mutator over Examples values  
   \`\`\`  
     
   Quality bars enforced by the architect/refactorer roles (and expected from any agent):  
     
   \- \*\*mutate4go\*\* (language mutation): 0 surviving mutants per changed file, except  
     documented equivalents. Manifests are embedded in comment blocks at the bottom of source  
     files (\`mutate4go-manifest-begin/end\`) — \*\*never edit them by hand\*\*; only the tools  
     update them.  
   \- \*\*crap4go\*\*: every function ≤ 6 (complexity × coverage). Decompose, don't suppress.  
   \- \*\*dry4go\*\*: no new duplication unless it matches an established precedent (per-step  
     handler skeletons, per-mode query factories — see logbook for the rulings).  
   \- \*\*Acceptance mutation\*\*: every Gherkin example mutation must fail a test; provably  
     equivalent survivors are allowlisted in \`scripts/equivalent/\<feature\>.txt\` with the  
     reasoning recorded in the commit/logbook.  
   \- \*\*Property tests\*\* live in \`property\_test.go\` files with the \`property\` build tag, run  
     via \`scripts/property.sh\` only.  
     
   \#\# Writing Gherkin specs (APS subset)  
     
   Specs live in \`features/\*.feature\`, parsed by the APS \`gherkin-parser\` (bootstrapped into  
   \`bin/\` by \`scripts/acceptance.sh\`). Hard constraints:  
     
   \- \*\*No step data tables.\*\* All fixture setup is repeated plain \`Given\`/\`And\` steps.  
   \- \*\*No \`|\` inside Examples cells\*\* (pipes delimit cells; the values must be pipe-free).  
   \- Steps dispatch on the \*exact\* step text with quoted segments templated to \`{}\`  
     (\`acceptance/runtime.Template\`). A new step needs a handler entry in  
     \`acceptance/handlers/handlerTable()\` — keep handlers small, named, per-feature, in the  
     \`handlers\_\<area\>.go\` file for the feature family (the table itself stays a flat literal).  
   \- Scenario comments carry the spec's reasoning (fixture arithmetic, paper grounding) —  
     follow the style of \`features/typed\_blend.feature\`.  
     
   \#\# Multi-agent workflow (SwarmForge)  
     
   This repo is configured for a four-role swarm (specifier → coder → refactorer →  
   architect). The specifier works in the main checkout on \`main\`; coder, refactorer and  
   architect each work in \`.worktrees/\<role\>\` on branch \`swarmforge-\<role\>\`. All are  
   governed by  
   \`swarmforge/constitution/articles/\` and the  
   role prompts in \`swarmforge/roles/\`. If you are \*not\* one of those roles:  
     
   \- Don't touch role prompts or another role's workflow without explicit user direction.  
   \- Don't commit to \`swarmforge-\*\` branches or rebase/merge them.  
   \- Handoffs use the daemon-backed file transport under \`.swarmforge/handoffs/\`; agents  
     queue outbound drafts with \`swarm\_handoff.sh\` and consume inbox items through  
     \`ready\_for\_next.sh\` / \`done\_with\_current.sh\`. Do not append agent handoffs to  
     \`logbook.json\` or send tmux messages directly.  
   \- \`logbook.md\` / \`logbook.json\` are historical engineering memory only, not the live  
     handoff queue.  
     
   A feature normally flows: specifier writes \`features/\<name\>.feature\` on \`main\` → coder  
   implements the slice TDD-first → refactorer enforces CRAP/DRY \+ property tests →  
   architect runs differential mutation \+ acceptance mutation, hardens, reports complete.  
     
   \#\# Issue tracking (beads)  
     
   The roadmap lives in \`.beads/\` and is managed \*\*only\*\* through the \`br\` CLI:  
     
   \`\`\`sh  
   br ready                  \# unblocked work, by priority  
   br show \<id\>              \# full self-contained context (background, design, acceptance)  
   br epic status            \# epic progress (children closed / total)  
   br graph \--all            \# full dependency tree  
   br create / update / close / dep add ...  
   \`\`\`  
     
   Conventions: epics carry the strategic rationale; child tasks are self-contained (they  
   never require consulting an external plan document); \`blocks\` dependencies gate readiness;  
   \`parent-child\` expresses epic membership. When you finish work, \`br close \<id\> \--reason  
   "..."\` and reference the bead id in the commit message. Issues sync to  
   \`.beads/issues.jsonl\` automatically — commit it with your change.  
     
   \#\# Reference material  
     
   \- \`pages/\*.md\` — Pinterest papers/blogs in agent-readable markdown. Several have an  
     \`\# ABSTRACT\` section: read that first; read the full text only when implementing the  
     feature it grounds. PinSage and Related Pins markdowns have OCR-garbled tables but  
     intact method text. \`raw/\` holds the original PDFs.  
   \- \`logbook.md\` / \`logbook.json\` — the project's complete engineering memory: every  
     feature slice, mutation ruling, DRY precedent, and equivalence argument to date.  
     
3. [**anonimizacja-research**](https://github.com/adagora/anonimizacja-research)  
   

| [anomizer-test.gemma3n-e4b-llm-report.json](https://github.com/adagora/anonimizacja-research/blob/dev/anomizer-test.gemma3n-e4b-llm-report.json) | [add gemma report](https://github.com/adagora/anonimizacja-research/commit/9861396c9575f433a1a5148390949d4eb343710f) | 3 weeks ago |
| :---- | :---- | ----- |
| [anomizer-test.gemma3n-e4b-llm-report.txt](https://github.com/adagora/anonimizacja-research/blob/dev/anomizer-test.gemma3n-e4b-llm-report.txt) | [add gemma report](https://github.com/adagora/anonimizacja-research/commit/9861396c9575f433a1a5148390949d4eb343710f) | 3 weeks ago |
| [anomizer-test.gemma3n-e4b-llm-wall.html](https://github.com/adagora/anonimizacja-research/blob/dev/anomizer-test.gemma3n-e4b-llm-wall.html) | [add gemma report](https://github.com/adagora/anonimizacja-research/commit/9861396c9575f433a1a5148390949d4eb343710f) | 3 weeks ago |
| [anomizer-test.gliner-polish.json](https://github.com/adagora/anonimizacja-research/blob/dev/anomizer-test.gliner-polish.json) | [add scripts and reports different llm and encoders, compare and propo…](https://github.com/adagora/anonimizacja-research/commit/2a0a3cd253765d805c59ab9002d835a1750bc9cf) | 3 weeks ago |
| [anomizer-test.gliner-report.html](https://github.com/adagora/anonimizacja-research/blob/dev/anomizer-test.gliner-report.html) | [add scripts and reports different llm and encoders, compare and propo…](https://github.com/adagora/anonimizacja-research/commit/2a0a3cd253765d805c59ab9002d835a1750bc9cf) | 3 weeks ago |
| [anomizer-test.gliner-report.json](https://github.com/adagora/anonimizacja-research/blob/dev/anomizer-test.gliner-report.json) | [add scripts and reports different llm and encoders, compare and propo…](https://github.com/adagora/anonimizacja-research/commit/2a0a3cd253765d805c59ab9002d835a1750bc9cf) | 3 weeks ago |
| [anomizer-test.gliner-report.txt](https://github.com/adagora/anonimizacja-research/blob/dev/anomizer-test.gliner-report.txt) | [add scripts and reports different llm and encoders, compare and propo…](https://github.com/adagora/anonimizacja-research/commit/2a0a3cd253765d805c59ab9002d835a1750bc9cf) | 3 weeks ago |
| [anomizer-test.gliner-wall.html](https://github.com/adagora/anonimizacja-research/blob/dev/anomizer-test.gliner-wall.html) | [add scripts and reports different llm and encoders, compare and propo…](https://github.com/adagora/anonimizacja-research/commit/2a0a3cd253765d805c59ab9002d835a1750bc9cf) | 3 weeks ago |
| [anomizer-test.llm-pii-report.json](https://github.com/adagora/anonimizacja-research/blob/dev/anomizer-test.llm-pii-report.json) | [add scripts and reports different llm and encoders, compare and propo…](https://github.com/adagora/anonimizacja-research/commit/2a0a3cd253765d805c59ab9002d835a1750bc9cf) | 3 weeks ago |
| [anomizer-test.llm-pii-report.txt](https://github.com/adagora/anonimizacja-research/blob/dev/anomizer-test.llm-pii-report.txt) | [add scripts and reports different llm and encoders, compare and propo…](https://github.com/adagora/anonimizacja-research/commit/2a0a3cd253765d805c59ab9002d835a1750bc9cf) | 3 weeks ago |
| [anomizer-test.llm-pii-wall.html](https://github.com/adagora/anonimizacja-research/blob/dev/anomizer-test.llm-pii-wall.html) | [add scripts and reports different llm and encoders, compare and propo…](https://github.com/adagora/anonimizacja-research/commit/2a0a3cd253765d805c59ab9002d835a1750bc9cf) | 3 weeks ago |
| [anomizer-test.openmed-report.json](https://github.com/adagora/anonimizacja-research/blob/dev/anomizer-test.openmed-report.json) | [add scripts and reports different llm and encoders, compare and propo…](https://github.com/adagora/anonimizacja-research/commit/2a0a3cd253765d805c59ab9002d835a1750bc9cf) | 3 weeks ago |
| [anomizer-test.openmed-report.txt](https://github.com/adagora/anonimizacja-research/blob/dev/anomizer-test.openmed-report.txt) | [add scripts and reports different llm and encoders, compare and propo…](https://github.com/adagora/anonimizacja-research/commit/2a0a3cd253765d805c59ab9002d835a1750bc9cf) | 3 weeks ago |
| [anomizer-test.openmed-wall.html](https://github.com/adagora/anonimizacja-research/blob/dev/anomizer-test.openmed-wall.html) | [add scripts and reports different llm and encoders, compare and propo…](https://github.com/adagora/anonimizacja-research/commit/2a0a3cd253765d805c59ab9002d835a1750bc9cf) | 3 weeks ago |
| [anomizer-test.opf-report.json](https://github.com/adagora/anonimizacja-research/blob/dev/anomizer-test.opf-report.json) | [add scripts and reports different llm and encoders, compare and propo…](https://github.com/adagora/anonimizacja-research/commit/2a0a3cd253765d805c59ab9002d835a1750bc9cf) | 3 weeks ago |
| [anomizer-test.opf-report.txt](https://github.com/adagora/anonimizacja-research/blob/dev/anomizer-test.opf-report.txt) | [add scripts and reports different llm and encoders, compare and propo…](https://github.com/adagora/anonimizacja-research/commit/2a0a3cd253765d805c59ab9002d835a1750bc9cf) | 3 weeks ago |
| [anomizer-test.opf-wall.html](https://github.com/adagora/anonimizacja-research/blob/dev/anomizer-test.opf-wall.html) | [add scripts and reports different llm and encoders, compare and propo…](https://github.com/adagora/anonimizacja-research/commit/2a0a3cd253765d805c59ab9002d835a1750bc9cf) | 3 weeks ago |
| [anomizer-test.presidio-report.json](https://github.com/adagora/anonimizacja-research/blob/dev/anomizer-test.presidio-report.json) | [add microsoft presidio report](https://github.com/adagora/anonimizacja-research/commit/d90b45c3c152c6885490b01980c5dcbd10c9b881) | 2 weeks ago |
| [anomizer-test.presidio-report.txt](https://github.com/adagora/anonimizacja-research/blob/dev/anomizer-test.presidio-report.txt) | [add microsoft presidio report](https://github.com/adagora/anonimizacja-research/commit/d90b45c3c152c6885490b01980c5dcbd10c9b881) | 2 weeks ago |
| [anomizer-test.presidio-wall.html](https://github.com/adagora/anonimizacja-research/blob/dev/anomizer-test.presidio-wall.html) | [add microsoft presidio report](https://github.com/adagora/anonimizacja-research/commit/d90b45c3c152c6885490b01980c5dcbd10c9b881) | 2 weeks ago |
| [anomizer-test.qwen2.5-7b-llm-report.json](https://github.com/adagora/anonimizacja-research/blob/dev/anomizer-test.qwen2.5-7b-llm-report.json) | [add scripts and reports different llm and encoders, compare and propo…](https://github.com/adagora/anonimizacja-research/commit/2a0a3cd253765d805c59ab9002d835a1750bc9cf) | 3 weeks ago |
| [anomizer-test.qwen2.5-7b-llm-report.txt](https://github.com/adagora/anonimizacja-research/blob/dev/anomizer-test.qwen2.5-7b-llm-report.txt) | [add scripts and reports different llm and encoders, compare and propo…](https://github.com/adagora/anonimizacja-research/commit/2a0a3cd253765d805c59ab9002d835a1750bc9cf) | 3 weeks ago |
| [anomizer-test.qwen2.5-7b-llm-wall.html](https://github.com/adagora/anonimizacja-research/blob/dev/anomizer-test.qwen2.5-7b-llm-wall.html) | [add scripts and reports different llm and encoders, compare and propo…](https://github.com/adagora/anonimizacja-research/commit/2a0a3cd253765d805c59ab9002d835a1750bc9cf) | 3 weeks ago |
| [anomizer-test.qwen3-8b-llm-report.json](https://github.com/adagora/anonimizacja-research/blob/dev/anomizer-test.qwen3-8b-llm-report.json) | [add scripts and reports different llm and encoders, compare and propo…](https://github.com/adagora/anonimizacja-research/commit/2a0a3cd253765d805c59ab9002d835a1750bc9cf) | 3 weeks ago |
| [anomizer-test.qwen3-8b-llm-report.txt](https://github.com/adagora/anonimizacja-research/blob/dev/anomizer-test.qwen3-8b-llm-report.txt) | [add scripts and reports different llm and encoders, compare and propo…](https://github.com/adagora/anonimizacja-research/commit/2a0a3cd253765d805c59ab9002d835a1750bc9cf) | 3 weeks ago |
| [anomizer-test.qwen3-8b-llm-wall.html](https://github.com/adagora/anonimizacja-research/blob/dev/anomizer-test.qwen3-8b-llm-wall.html) | [add scripts and reports different llm and encoders, compare and propo…](https://github.com/adagora/anonimizacja-research/commit/2a0a3cd253765d805c59ab9002d835a1750bc9cf) | 3 weeks ago |
| [anomizer-test.roberta8k-pii-report.json](https://github.com/adagora/anonimizacja-research/blob/dev/anomizer-test.roberta8k-pii-report.json) | [add scripts and reports different llm and encoders, compare and propo…](https://github.com/adagora/anonimizacja-research/commit/2a0a3cd253765d805c59ab9002d835a1750bc9cf) | 3 weeks ago |
| [anomizer-test.roberta8k-pii-report.txt](https://github.com/adagora/anonimizacja-research/blob/dev/anomizer-test.roberta8k-pii-report.txt) | [add scripts and reports different llm and encoders, compare and propo…](https://github.com/adagora/anonimizacja-research/commit/2a0a3cd253765d805c59ab9002d835a1750bc9cf) | 3 weeks ago |
| [anomizer-test.roberta8k-pii-wall.html](https://github.com/adagora/anonimizacja-research/blob/dev/anomizer-test.roberta8k-pii-wall.html) | [add scripts and reports different llm and encoders, compare and propo…](https://github.com/adagora/anonimizacja-research/commit/2a0a3cd253765d805c59ab9002d835a1750bc9cf) | 3 weeks ago |
| [anomizer-test.roberta8k-viterbi-pii-report.json](https://github.com/adagora/anonimizacja-research/blob/dev/anomizer-test.roberta8k-viterbi-pii-report.json) | [add scripts and reports different llm and encoders, compare and propo…](https://github.com/adagora/anonimizacja-research/commit/2a0a3cd253765d805c59ab9002d835a1750bc9cf) | 3 weeks ago |
| [anomizer-test.roberta8k-viterbi-pii-report.txt](https://github.com/adagora/anonimizacja-research/blob/dev/anomizer-test.roberta8k-viterbi-pii-report.txt) | [add scripts and reports different llm and encoders, compare and propo…](https://github.com/adagora/anonimizacja-research/commit/2a0a3cd253765d805c59ab9002d835a1750bc9cf) | 3 weeks ago |
| [anomizer-test.roberta8k-viterbi-pii-wall.html](https://github.com/adagora/anonimizacja-research/blob/dev/anomizer-test.roberta8k-viterbi-pii-wall.html) |  |  |

   

   [**adaptive-retrieval**](https://github.com/adagora/adaptive-retrieval)

   Private

* Watch  
* 0  
*  (0)  
* Fork 0  
*  Star 0  
    
  \#  
  \#  Copyright 2026 The InfiniFlow Authors. All Rights Reserved.  
  \#  
  \#  Licensed under the Apache License, Version 2.0 (the "License");  
  \#  you may not use this file except in compliance with the License.  
  \#  You may obtain a copy of the License at  
  \#  
  \#      http://www.apache.org/licenses/LICENSE-2.0  
  \#  
  \#  Unless required by applicable law or agreed to in writing, software  
  \#  distributed under the License is distributed on an "AS IS" BASIS,  
  \#  WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.  
  \#  See the License for the specific language governing permissions and  
  \#  limitations under the License.  
  \#  
  """  
  Sentinel-based DeepResearch escalation (opt-in via the \`\`adaptive\_retrieval\`\` flag).  
    
  Replaces the old regex/keyword \`\`adaptive\_router\`\`. Instead of \*guessing\* a question's  
  difficulty from its text \*before\* retrieval, the answering model itself — having seen the  
  single-pass knowledge — decides whether the sources are complete enough for an exhaustive  
  answer. When they are not, it emits a single sentinel token; the backend intercepts it,  
  runs multi-hop \`\`DeepResearch\`\` to enrich the chunks, and re-prompts the model plainly.  
    
  Why this design:  
    \* Zero extra LLM call on easy questions — the sufficiency judgement piggybacks on the  
      answer-generation pass the model has to run anyway.  
    \* No brittle lexical heuristics — completeness ("does the answer need ALL values / several  
      tables?") is judged by the model's own reasoning over the retrieved context, which is the  
      only signal that reliably catches partial-but-high-similarity gaps.  
    \* Deep research only fires on genuinely under-served questions, at the cost of one extra  
      generation pass on those (and only those).  
    
  Knobs (all optional, env):  
    DEEP\_RESEARCH\_JUDGE\_MODEL   model name for DeepResearch's internal sufficiency\_check judge  
                                (e.g. \`\`gemini-3.1-flash-lite-preview\`\`). Empty \-\> reuse the  
                                dialog's chat model.  
    DEEP\_RESEARCH\_JUDGE\_EFFORT  thinking level for that judge: minimal|low|medium|high (default low).  
  """  
    
  import os  
    
  \# Distinctive ASCII sentinel — practically impossible to occur in a genuine answer, and stable  
  \# across tokenizers (no exotic Unicode). The backend strips/never forwards it to the user.  
  DEEP\_RESEARCH\_SENTINEL \= "\<\<\<DEEP\_RESEARCH\>\>\>"  
    
  \# Backend-injected meta-instruction appended to the dialog's system prompt for the Phase-1  
  \# (answer-or-escalate) pass only. Written in Polish to match the assistant's working language;  
  \# the rule is language-agnostic in effect. It deliberately takes precedence over any  
  \# "no information" template so that a missing-data question gets a DeepResearch attempt first.  
  \_ESCALATION\_DIRECTIVE \= """\\  
  \---  
  \# META-INSTRUKCJA SYSTEMOWA: KONTROLA KOMPLETNOŚCI ŹRÓDEŁ (priorytet nad „Zasadą elastyczności" oraz sekcją \# BRAK INFORMACJI)  
  Najpierw, w przestrzeni myśli (thinking), oceń czy powyższa \# BAZA WIEDZY zawiera komplet danych potrzebnych do PEŁNEJ, wyczerpującej odpowiedzi na pytanie użytkownika.  
  Uznaj źródła za NIEWYSTARCZAJĄCE wyłącznie, gdy zachodzi co najmniej jedno:  
  \- pytanie wymaga wymienienia WSZYSTKICH wartości/parametrów/wariantów/pozycji, a w bazie widać jedynie część zbioru,  
  \- pełna odpowiedź wymaga danych z wielu tabel/sekcji/dokumentów, a którejś z nich brakuje,  
  \- pytanie dotyczy złożonej pozycji (np. cena dla konkretnego wymiaru ORAZ koloru/RAL), a brakuje którejś składowej,  
  \- w bazie są jedynie nagłówki/odsyłacze tabel bez właściwych wartości.  
  PIERWSZEŃSTWO: Jeśli pytanie wymaga kompletu/wyczerpania (którekolwiek z powyższych kryteriów), NIE poprzestawaj na danych częściowych — niniejsza kontrola ma pierwszeństwo nad „Zasadą elastyczności". W pozostałych sytuacjach „Zasada elastyczności" obowiązuje normalnie (częściowe, ale przydatne dane są wystarczające).  
  DZIAŁANIE:  
  \- Jeśli źródła są NIEWYSTARCZAJĄCE: jako jedyną treść odpowiedzi zwróć dokładnie token {sentinel} — bez cudzysłowów, bez nagłówków, bez żadnego innego tekstu. NIE używaj wtedy szablonu z sekcji \# BRAK INFORMACJI.  
  \- Jeśli źródła są wystarczające: zignoruj ten mechanizm i odpowiedz normalnie, zgodnie z zasadami powyżej. NIGDY nie umieszczaj tokenu {sentinel} w zwykłej odpowiedzi.  
  \- NIGDY nie zwracaj pustej odpowiedzi: jeśli z jakiegokolwiek powodu nie potrafisz sformułować pełnej, rzeczowej odpowiedzi na podstawie \# BAZY WIEDZY, zwróć token {sentinel}."""  
    
    
  def is\_escalation\_enabled(kwargs: dict) \-\> bool:  
      """Sentinel escalation is requested via the same \`\`adaptive\_retrieval\`\` request flag the  
      pipeline already sends. \`\`reasoning\`\` (forced DeepResearch) takes precedence and is handled  
      by the caller, so this only reports the raw opt-in."""  
      return bool(kwargs.get("adaptive\_retrieval"))  
    
    
  def build\_escalation\_directive() \-\> str:  
      return \_ESCALATION\_DIRECTIVE.format(sentinel=DEEP\_RESEARCH\_SENTINEL)  
    
    
  def judge\_model\_name() \-\> str:  
      """Configured model name for DeepResearch's internal sufficiency judge, or '' to reuse the  
      dialog chat model."""  
      return os.getenv("DEEP\_RESEARCH\_JUDGE\_MODEL", "").strip()  
    
    
  def judge\_reasoning\_effort() \-\> str:  
      val \= os.getenv("DEEP\_RESEARCH\_JUDGE\_EFFORT", "low").strip().lower()  
      return val if val in {"minimal", "low", "medium", "high"} else "low"  
    
    
  def judge\_gen\_conf() \-\> dict:  
      """gen\_conf forwarded to the judge model. \`\`reasoning\_effort\`\` maps to the Gemini 3.x  
      thinking level (see LiteLLMBase), keeping the judge fast and cheap."""  
      return {"reasoning\_effort": judge\_reasoning\_effort()}  
    
    
  \# Leading characters stripped before sentinel matching, so the token is still recognised if the  
  \# model disobeys "no quotes/headers" and wraps it in whitespace or markdown (\`\`\`, \`, \#, \-, \*, \>,  
  \# quotes). NB: "\<" is intentionally NOT here — the sentinel itself starts with "\<\<\<".  
  \_LEADING\_NOISE \= " \\t\\r\\n\`\*\#-\>\\"'"  
    
    
  def \_normalize\_lead(text: str) \-\> str:  
      return (text or "").lstrip(\_LEADING\_NOISE)  
    
    
  def is\_sentinel(text: str) \-\> bool:  
      """True when the visible answer begins with the escalation sentinel, tolerating leading  
      whitespace/markdown noise. Anchored to the start so a token buried mid-answer never matches.  
      Used for the buffered streaming prefix and the non-streaming full answer."""  
      return \_normalize\_lead(text).startswith(DEEP\_RESEARCH\_SENTINEL)  
    
    
  def could\_be\_sentinel\_prefix(text: str) \-\> bool:  
      """True while the (noise-normalized) leading text is still a partial prefix of the sentinel,  
      i.e. not enough visible characters yet to decide. Once this is False and \`\`is\_sentinel\`\` is  
      False, the text is a normal answer and can be flushed to the user."""  
      norm \= \_normalize\_lead(text)  
      if not norm:  
          return True  
      return DEEP\_RESEARCH\_SENTINEL.startswith(norm)  
    
  [**msteams-transcript-processor**](https://github.com/adagora/msteams-transcript-processor)  
    
  \# Microsoft Teams Transcript Automation  
    
  Ingests Teams transcripts/recordings via Microsoft Graph, converts VTT → text, analyzes with LLM, outputs JSON/reports. Supports real-time (webhook \+ watcher) and batch processing.  
    
  \#\# Folder Structure  
    
  \`\`\`  
  transcripts/  
  ├── callTranscript/\<hash\>/           \# Transcript files  
  │   ├── raw.json                     \# Raw transcript data  
  │   ├── analysis.json                \# LLM analysis results  
  │   └── \_\*.json                      \# Additional analysis outputs  
  │  
  ├── callRecording/\<hash\>/            \# Recording files  
  │   ├── recording.json               \# Recording metadata  
  │   └── recording.mp4                \# Video file  
  \`\`\`  
    
  \*\*Note\*\*: Folders use first 16 chars of MD5 hash of transcript/recording ID.  
    
  \#\# Architecture  
    
  \#\#\# Multi-Server Setup  
    
  \`\`\`  
  ┌─────────────────────────────────────────────────────────────────────────────┐  
  │                           Microsoft Graph API                               │  
  └─────────────────────────────────────┬───────────────────────────────────────┘  
                                        │  
                                        ▼  
  ┌─────────────────────────────────────────────────────────────────────────────┐  
  │                        Linux Server (webhook-forwarder)                    │  
  │  ┌─────────────────────┐                                                      │  
  │  │  webhook-forwarder/ │  ← Public endpoint, receives Graph webhooks         │  
  │  │    (index.ts)      │    Validates → forwards to Windows backend          │  
  │  └─────────────────────┘                                                      │  
  └─────────────────────────────────────┬───────────────────────────────────────┘  
                                        │ HTTP POST (with auth)  
                                        ▼  
  ┌─────────────────────────────────────────────────────────────────────────────┐  
  │                        Windows Server (Main)                                │  
  │                                                                             │  
  │  ┌──────────────┐    ┌──────────────┐    ┌──────────────┐    ┌───────────┐ │  
  │  │ webhook.ts   │    │ watcher.ts   │    │storageWatcher│    │ Scheduler │ │  
  │  │              │    │              │    │              │    │           │ │  
  │  │ Receives     │    │ Watches      │    │ Saves to     │    │ Batch     │ │  
  │  │ forwarded    │    │ raw.json     │    │ MongoDB      │    │ catch-up  │ │  
  │  │ webhooks     │    │ → LLM        │    │ (transcript, │    │ every 5m  │ │  
  │  │              │    │ analysis     │    │ recording,    │    │           │ │  
  │  │ Saves to     │    │              │    │ analysis)     │    │           │ │  
  │  │ filesystem   │    │              │    │               │    │           │ │  
  │  └──────────────┘    └──────────────┘    └──────────────┘    └───────────┘ │  
  │         │                   │                   │                             │  
  │         └───────────────────┴───────────────────┘                             │  
  │                             ▼                                                 │  
  │  ┌──────────────────────────────────────────────────────────────────────┐   │  
  │  │                     Filesystem (transcripts/)                         │   │  
  │  │                                                                     │   │  
  │  │  callTranscript/\<hash\>/                                             │   │  
  │  │    ├── raw.json              ← Transcript content                  │   │  
  │  │    └── \_\*.json               ← Analysis outputs                    │   │  
  │  │                                                                     │   │  
  │  │  callRecording/\<hash\>/                                                │   │  
  │  │    ├── recording.json        ← Recording metadata                  │   │  
  │  │    └── recording.mp4         ← Video file                          │   │  
  │  └──────────────────────────────────────────────────────────────────────┘   │  
  │                                      │                                       │  
  │                                      ▼                                       │  
  │  ┌──────────────────────────────────────────────────────────────────────┐   │  
  │  │                     MongoDB (AW\_AI\_MSTEAMS)                          │   │  
  │  │   Meetings with transcripts, recordings, analysis linked by meetingId│   │  
  │  └──────────────────────────────────────────────────────────────────────┘   │  
  └─────────────────────────────────────────────────────────────────────────────┘  
  \`\`\`  
    
  \#\#\# Data Flow  
    
  \`\`\`  
  1\. Teams Meeting → Graph API → webhook-forwarder (Linux) → webhook.ts (Windows)  
  2\. webhook.ts saves to filesystem:  
     \- Transcript → transcripts/callTranscript/\<hash\>/raw.json  
     \- Recording  → transcripts/callRecording/\<hash\>/recording.json \+ .mp4  
  3\. storageWatcher detects new files → saves to MongoDB  
  4\. watcher detects raw.json → runs LLM analysis → updates MongoDB  
  5\. batchScheduler catches up missed files every \~5 minutes  
  \`\`\`  
    
  \#\#\# Data Flow  
    
  \`\`\`  
  1\. Teams Meeting → Graph API → webhook-forwarder (Linux) → webhook.ts (Windows)  
  2\. webhook.ts saves to filesystem:  
     \- Transcript → transcripts/callTranscript/\<hash\>/raw.json  
     \- Recording  → transcripts/CallRecording/\<hash\>/recording.json \+ .mp4  
  3\. storageWatcher detects new files → saves to MongoDB  
  4\. watcher detects raw.json → runs LLM analysis → updates MongoDB  
  5\. batchScheduler catches up missed files every \~5 minutes  
  \`\`\`  
    
  \#\# Quick Start  
    
  \`\`\`bash  
  \# Install  
  npm install  
    
  \# Linux Server (webhook-forwarder only)  
  cd webhook-forwarder  
  npm install  
  npm start  
    
  \# Windows Server \- Different modes:  
  npm run start:no-analysis  \# webhook \+ MongoDB (no LLM analysis)  
  npm run dev                \# webhook \+ watcher (LLM analysis, no MongoDB)  
  npm run start:with-storage \# webhook \+ watcher \+ scheduler \+ MongoDB (full)  
  \`\`\`  
    
  \#\# Environment Variables  
    
  | Variable | Description |  
  |----------|-------------|  
  | \`TRANSCRIPTS\_BASE\_PATH\` | Path to store transcripts |  
  | \`MONGODB\_URI\` | MongoDB connection string |  
  | \`MONGODB\_DB\_NAME\` | Database name (default: transcripts) |  
  | \`OPENAI\_API\_KEY\` or \`GOOGLE\_GENERATIVE\_AI\_API\_KEY\` | LLM API key |  
  | \`ENABLE\_CHUNKING=true\` | Enable chunked analysis |  
  | \`INCLUDE\_RECORDINGS=true\` | Include recordings in MongoDB save |  
    
  \#\#\# webhook-forwarder (Linux)  
  | Variable | Description |  
  |----------|-------------|  
  | \`AIHOST01\_WEBHOOK\_URL\` | Windows server webhook URL |  
  | \`AIHOST01\_API\_KEY\` | Auth key for Windows server |  
  | \`CLIENT\_ID\`, \`TENANT\_ID\` | Microsoft Graph app credentials |  
    
  \#\# Scripts  
    
  \`\`\`bash  
  \# Core (Windows)  
  npm run start:with-storage  \# Full: webhook \+ watcher \+ scheduler \+ MongoDB  
  npm run dev                  \# Real-time only  
  npm run start:auto          \# Real-time \+ scheduler (no MongoDB)  
    
  \# webhook-forwarder (Linux)  
  cd webhook-forwarder  
  npm start                   \# Start forwarder  
  npm run webhook:https       \# HTTPS server  
    
  \# Batch  
  npm run batch:catch-up      \# Process missed transcripts  
  npm run batch:auto          \# Run scheduler  
    
  \# MongoDB  
  npm run mongo:save-batch    \# Save all meetings to MongoDB  
  npm run mongo:save-single   \# Save single meeting  
    
  \# Analysis  
  npm run process:existing    \# Analyze existing transcripts  
  npm run generateMarkdownForRAG  \# Generate RAG-friendly output  
    
  \# Subscriptions  
  npm run subscribe          \# Create webhook subscription  
  npm run subscription:health \# Check subscription health  
    
  \# Recordings  
  npm run process:downloaded-recordings  \# Download missing recordings  
  npm run recordings:list                 \# List all recordings  
  npm run recordings:get-by-meeting \<id\> \# Get recording by meeting ID  
  npm run recordings:delete \<id\>         \# Delete a recording  
    
  \# MongoDB Manual  
  npm run mongo:save-batch           \# Save all meetings to MongoDB  
  npm run mongo:save-single \<path\>   \# Save single meeting  
  npm run mongo:save-with-recordings \# Save with recordings included  
    
  \# Test API  
  npm test \-- \--testPathPattern=api.test.ts  
  npm test \-- \--testPathPattern=api.integration.test.ts   
  \`\`\`  
    
  \#\# Key Files  
    
  | File | Purpose |  
  |------|---------|  
  | \`webhook-forwarder/index.ts\` | Linux: receives Graph webhooks, forwards to Windows |  
  | \`src/webhook.ts\` | Windows: receives forwarded webhooks |  
  | \`src/watcher.ts\` | File watcher for real-time LLM analysis |  
  | \`src/storageWatcher.ts\` | Saves transcripts/recordings/analysis to MongoDB |  
  | \`src/utils/transcriptProcessor.ts\` | Core processing pipeline |  
    
  \#\# Development  
    
  \`\`\`bash  
  npm run type-check  
  npm run lint  
  npm run build  
  npm test  
  \`\`\`


