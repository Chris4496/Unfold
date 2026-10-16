#!/usr/bin/env python3
"""Optional, offline validator for synthetic journey event JSON files.

Only reads the path explicitly supplied by the operator and prints diagnostics.
No network calls, file changes, package installs, or implicit traversal.
"""

import json
import sys
from pathlib import Path

REQUIRED_FIELDS = {
    "run_id", "journey_version", "role_id", "task_id", "step_id",
    "sequence", "actor", "action", "channel", "expected", "observed",
    "evidence_ref", "timestamp", "data_classification", "gate_status",
}
ALLOWED_CHANNELS = {"UI", "API", "MCP"}


def validate(events):
    problems = []
    if not isinstance(events, list):
        return ["Root value must be a JSON array of event objects."]
    for index, event in enumerate(events, 1):
        if not isinstance(event, dict):
            problems.append(f"Event {index} must be an object.")
            continue
        missing = REQUIRED_FIELDS - set(event)
        if missing:
            problems.append(f"Event {index} missing: {', '.join(sorted(missing))}")
        if event.get("channel") not in ALLOWED_CHANNELS:
            problems.append(f"Event {index} has invalid channel.")
        if event.get("data_classification") != "synthetic":
            problems.append(f"Event {index} classification must be synthetic; contents are not inspected.")
        if event.get("handoff_id"):
            handoff_fields = {
                "artifact_id", "artifact_version", "consent_ref",
                "sender_role_id", "recipient_role_id",
            }
            absent = handoff_fields - set(event)
            if absent:
                problems.append(f"Event {index} handoff missing: {', '.join(sorted(absent))}")
    return problems


def main():
    if len(sys.argv) != 2:
        print("Usage: python example.py <synthetic-events.json>")
        return 2
    path = Path(sys.argv[1]).expanduser()
    try:
        events = json.loads(path.read_text(encoding="utf-8"))
    except (OSError, UnicodeError, json.JSONDecodeError) as error:
        print(f"Cannot read JSON events: {error}")
        return 2
    problems = validate(events)
    for problem in problems:
        print(problem)
    if problems:
        return 1
    print(f"Valid synthetic event records: {len(events)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
