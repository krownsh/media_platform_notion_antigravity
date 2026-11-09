---
name: owner-guided-media-workflow
description: Capture and dehydrate collected media, compare existing evidence, discuss and synthesize owner-led knowledge, resume across agents, retrieve sources, support Project decisions and optional creative outputs.
---

# Owner-Guided Knowledge Workflow

Make knowledge synthesis and the Owner's judgment the primary workflow. Treat content creation as an optional branch. Collection means potential value, not endorsement or a commitment to act. Preserve 原始來源, AI 候選, and Owner-accepted 正式知識 as distinct states. Only recorded 明確接受 may promote the Owner's understanding; acceptance does not prove factual truth.

This is the canonical workflow; my-mediacrawl-skill is only a compatibility entry. Use any capable agent through the shared integration boundary. Do not introduce Knowledge Space as a parallel system.

## Load the relevant references

- Read [knowledge-model.md](references/knowledge-model.md) before organizing, synthesizing or promoting knowledge.
- Read [preprocessing.md](references/preprocessing.md) for capture, 脫水, comparison and prioritization.
- Read [discussion-and-synthesis.md](references/discussion-and-synthesis.md) for single-source or multi-source discussions and knowledge updates.
- Read [project-and-output.md](references/project-and-output.md) for Project decisions, POC, content creation and execution boundaries.
- Read [integration-and-handoff.md](references/integration-and-handoff.md) before connected reads/writes, handoff, local delivery or claims of background automation.

## Start from intent and verified capability

Identify save-for-later, discuss-now, retrieve, resume, Topic review, Project decision or creative-output intent. A URL sent directly to the agent defaults to priority knowledge preparation and discussion; explicit "先存著" overrides that default. n8n and frontend captures use the same underlying records. Do not equate entry channel with credibility or creative intent.

On start, handoff, blockage or a meaningful stage change, briefly explain 目前階段, 為什麼現在在這裡 and the next useful action (唯一下一步 when one action unlocks progress). Do not mechanically repeat these labels every reply. Use natural Traditional Chinese discussion and avoid requiring internal IDs or CLI knowledge.

Read current source/review state before resuming. Verify available APIs and caller scope. Skill instructions describe desired behavior, not deployed capabilities. If a backend capability is missing, provide an explicitly unsaved analysis or handoff; never fabricate endpoints, completed jobs, saved records or background monitoring.

## Execute the knowledge workflow

1. Retain source evidence and capture intent; check duplicates and source completeness.
2. Dehydrate available evidence into claims, methods, evidence, conditions and limitations, with source references.
3. Retrieve relevant sources and knowledge; compare repetition, support, contradiction, context differences and uncertainty.
4. Prepare a material card for every source; deepen preparation when novelty, relevance, evidence gaps or Owner priority justify it. Include exploratory ideas even without an active Project.
5. Discuss the most useful judgment or cross-source question. Support one source, multiple sources, Topic review and Project decisions.
6. Record the Owner's position and conditions; prepare a reusable knowledge update with provenance.
7. Apply supported, authorized updates and read them back. Offer Project verification or creative reuse only where relevant.
8. Preserve unresolved questions and continuation context. New evidence proposes revisions; it never silently replaces prior Owner judgments.

Do not wait for hypothetical future sources. A single source can be useful now; compare future sources retrospectively. Do not force a folder, 貼文學習筆記, Topic, Project, task or output for every source.

## Preserve the Owner's agency

Automatically prepare and save labelled AI work only through supported candidate/preprocessing interfaces. Keep it separate from raw evidence and Owner knowledge.
No automatic process may accept or promote its own conclusions as the Owner's position.

The Owner leads credibility, investment priority and fusion of ideas. Preserve disagreement, uncertainty, applicability conditions and reasons for changing a view. An explicit statement such as "採用，但只適用個人專案" is acceptance for that exact proposition and condition; record its evidence once, without demanding another ceremonial approval. Silence, collection, "continue", draft approval or an ambiguous "OK" is not blanket acceptance. Ask a narrow question when the referent or consequence is unclear.

New AI-added propositions remain candidates. Perform supported bookkeeping after an authorized decision without repeatedly asking. Formal folder assignment and title-based file moves still require explicit Owner choice unless a separate scoped automatic-filing policy has been approved. Provide relevant choices with reasons and access to the complete current list; never hide alternatives or preselect acceptance.

## Source quality and completion

Preserve complete, partial and failed capture distinctions. 部分擷取 may receive bounded dewatering of retrieved text; block conclusions depending on missing evidence. "以目前來源建立候選" authorizes only that disclosed scope. A failed capture without evidence cannot produce knowledge conclusions.

Report capture, preparation, review, execution and local synchronization separately. "Prepared" is not "Owner reviewed"; "accepted" is not "verified"; "drafted" is not "published". Complete the requested stage with evidence and an honest continuation state. Deliberate defer, rejection and retention without action are valid outcomes.

Keep Library retrieval source-linked and state-labelled. Use relevant candidates internally for comparison, but never present them as accepted knowledge. Respect current search API filters; do not bypass them to pretend the target retrieval model is implemented.
