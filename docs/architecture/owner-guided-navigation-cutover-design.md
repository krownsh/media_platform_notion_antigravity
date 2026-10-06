# Owner-Guided Navigation Cutover (M6)

## Decision

M6 removes legacy boards, automatic-analysis views, collection creation, and
legacy workflow controls from normal navigation. The normal path is:

1. **Inbox** — capture a source and complete the visible Owner review step.
2. **Library search** — recover a source by raw evidence or accepted knowledge.
3. **Source detail** — distinguish raw evidence, accepted learning/Topic/Project
   context, and still-pending candidates.
4. **Topics / Projects** — maintain the independent knowledge catalog and
   propose a separately-approved POC.

Legacy views remain in the repository and their historical database records are
preserved. Their former routes redirect to the Library rather than keeping a
second day-to-day workflow alive. Physical removal is deferred to M7 after an
Owner-approved deletion manifest and backup/readback gate.

## Write boundary

M6 does not introduce a new automatic write. Capture still writes source facts;
Owner review promotion remains the only path to formal note/Topic/project
writes. The new source-detail endpoint is read-only and is mounted behind the
same user JWT guard as the rest of the interactive owner-guided API.

## Accessibility / ADHD guardrails

Every normal screen must name the current phase, why it exists, and one next
action. Candidate content is visibly labelled and never rendered as accepted
knowledge. Redirecting old deep links prevents the user from needing to
remember which generation of screen is safe to use.
