# Owner-Guided Navigation Cutover (M6)

## Decision

M6 removes legacy boards and legacy workflow controls that can create a second
semantic workflow. It retains compatible Library navigation, folder browsing,
an explicit Owner folder selector, folder creation, and a read-only historical
source-analysis view. These are a compatibility shell, not the old automation
model. The normal path is:

1. **Inbox** — capture a source and complete the visible Owner review step.
2. **Library search** — recover a source by raw evidence or accepted knowledge.
3. **Source detail** — distinguish raw evidence, accepted learning/Topic/Project
   context, and still-pending candidates.
4. **Topics / Projects** — maintain the independent knowledge catalog and
   propose a separately-approved POC.

Legacy records remain preserved and the restored shell keeps them findable.
Historical categories, tags, and charts are labelled as source analysis rather
than formal folders, Topics, or accepted knowledge. Physical removal of
unneeded legacy runtime is deferred to M7 after an Owner-approved deletion
manifest and backup/readback gate.

## Write boundary

M6 does not introduce a new automatic write. Capture still writes source facts;
Owner review promotion remains the only path to formal note/Topic/project
writes. A direct Library folder choice is an explicit Owner decision: it uses
the reviewed promotion endpoint when a folder candidate is open, otherwise an
owner-scoped audited manual-override endpoint. Folder creation is likewise
owner-scoped and audited. The source-detail endpoint remains read-only and all
interactive owner-guided routes share the same user JWT guard.

## Accessibility / ADHD guardrails

Every normal screen must name the current phase, why it exists, and one next
action. Candidate content is visibly labelled and never rendered as accepted
knowledge. Redirecting old deep links prevents the user from needing to
remember which generation of screen is safe to use.
