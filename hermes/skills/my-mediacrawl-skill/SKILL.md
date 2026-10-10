---
name: my-mediacrawl-skill
description: Compatibility entry for the media collection workflow. It delegates all guidance to owner-guided-media-workflow.
---

# Compatibility entry — no independent workflow

This skill contains no workflow rules of its own. The sole canonical guide is
[`owner-guided-media-workflow`](../owner-guided-media-workflow/SKILL.md).

Immediately load and follow `$owner-guided-media-workflow` for every request.
Do not combine this compatibility entry with legacy Hermes, Cron, old Vault,
Knowledge Space, or old taxonomy instructions. If any material conflicts with
the canonical skill, the canonical skill wins.
