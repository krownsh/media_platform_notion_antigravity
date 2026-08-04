"""Hermes Cron pre-check for one safe media post workflow.

The script never receives a database credential. It delegates the read to the
project's allowlisted Node CLI and emits Hermes's final-line wakeAgent contract.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
import subprocess
import sys


def main() -> int:
    project_root_value = os.environ.get("MEDIA_PLATFORM_PROJECT_ROOT", "").strip()
    if not project_root_value:
        print("MEDIA_PLATFORM_PROJECT_ROOT is not configured", file=sys.stderr)
        return 2

    project_root = Path(project_root_value).expanduser().resolve()
    workflow_script = project_root / "scripts" / "agent-sdk" / "next-workflow.js"
    if not workflow_script.is_file():
        print(f"Hermes workflow CLI not found: {workflow_script}", file=sys.stderr)
        return 2

    result = subprocess.run(
        ["node", str(workflow_script)],
        cwd=project_root,
        check=False,
        capture_output=True,
        text=True,
        timeout=60,
    )
    if result.returncode != 0:
        print(result.stderr.strip() or "Hermes workflow pre-check failed", file=sys.stderr)
        return result.returncode

    lines = [line.strip() for line in result.stdout.splitlines() if line.strip()]
    if not lines:
        print("Hermes workflow pre-check returned no JSON", file=sys.stderr)
        return 3

    try:
        payload = json.loads(lines[-1])
    except json.JSONDecodeError as error:
        print(f"Hermes workflow pre-check returned invalid JSON: {error}", file=sys.stderr)
        return 3

    workflow = payload.get("workflow") if isinstance(payload, dict) else None
    gate_result = {
        "wakeAgent": bool(payload.get("ok") and workflow),
        "workflowId": workflow.get("workflow_id") if workflow else None,
        "stage": workflow.get("stage") if workflow else None,
        "sourceType": workflow.get("source_type") if workflow else None,
    }
    print(json.dumps(gate_result, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
