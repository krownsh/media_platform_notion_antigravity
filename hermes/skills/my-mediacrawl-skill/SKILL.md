---
name: my-mediacrawl-skill
description: Manage this project's captured links as a user-triggered inbox. Use when the user asks to inspect new captures, analyze a saved URL, match it to the local project, or run an isolated POC from a captured item.
---

# Media Vault

Use the existing project scripts as the execution layer. Do not create a
background worker. Only inspect or process items when the user explicitly asks.

## Preconditions

- Run commands from the repository root, identified by `package.json` and
  `scripts/agent-sdk/`.
- Require `server/.env` to be configured locally. The existing scripts load
  this file themselves; never read, print, copy, commit, or ask the user to
  paste its secrets.
- Treat `collection_capture_outbox` as a manual capture inbox. A `pending`
  item is not an instruction to act automatically.
- Do not invoke database consoles, raw SQL, or ad-hoc Supabase commands.
  Use only the commands below unless the user asks to change this project.

## Command map

| User intent | Command | Effect |
| --- | --- | --- |
| View new captures | `npm run agent:inbox` | Read pending capture events and print their source, URL, and summary. |
| Analyze one capture | `npm run agent:analyze -- <outbox-id>` | Route the capture, optionally enrich it, audit the local repository read-only, and show project matches. |
| Run an isolated POC | `npm run agent:analyze -- <outbox-id> --execute-poc` | Create and lease a `poc_execute` job, then run the highest-scoring POC in `sandbox/jobs/<outbox-id>`. |

`agent:analyze` calls the existing Route Agent, enrichment service, Project
Auditor, Opportunity Matcher, and POC services. Do not import individual
`server/services` modules directly from a shell command; the SDK script is the
supported entry point.

## Interaction workflow

### Inspect captures

1. Run `npm run agent:inbox` when the user asks to check new captures.
2. Present a short numbered list containing the outbox ID, source URL, and
   available summary.
3. Ask which item the user wants to analyze. Do not choose one or process all
   items automatically.

### Analyze a capture

1. Require a concrete `<outbox-id>`.
2. Run `npm run agent:analyze -- <outbox-id>`.
3. Report the routes, project-audit findings, and matching application cases.
4. State clearly whether the result is a content opportunity, a POC candidate,
   or has no match.
5. Do not run a POC unless the user explicitly approves it.

### Run a POC

1. Before running, state the selected capture, target match, and that the POC
   is limited to `sandbox/jobs/<outbox-id>`.
2. Require an explicit instruction such as “執行 POC”, “做隔離測試”, or
   “run the isolated POC”.
3. Run `npm run agent:analyze -- <outbox-id> --execute-poc`.
4. Report the job ID, pass/fail status, timeout state, and useful stdout/stderr
   summary.
5. Do not modify the formal project, install production dependencies, commit,
   deploy, publish, or change Supabase schema as part of this workflow.

## Current limitations

- Do not run `npm run agent:complete`. Its script writes legacy outbox fields
  and statuses that do not match the current Stage B schema.
- Analysis results are currently printed by the script; it does not yet persist
  `source_routes` or `application_cases`.
- There is no CLI command for content-draft creation. If the user asks for a
  rewrite, explain that a draft workflow still needs to be added rather than
  inventing a command or publishing anything.
- If a command reports missing Supabase configuration, missing outbox data, or
  a service error, stop and show the error. Do not edit `.env`, retry a POC, or
  fabricate a successful result.
