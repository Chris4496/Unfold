#!/bin/bash
# log-event.sh <sequence> <step_id> <action> <expected> <observed> <evidence_ref> [handoff_id] [artifact_id]
# Appends one event object to events/ua-supp.json (NDJSON-style appended into a JSON array maintained via jq)
SEQ="$1"; STEP="$2"; ACTION="$3"; EXPECTED="$4"; OBSERVED="$5"; EVID="$6"; HANDOFF="${7:-}"; ARTIFACT="${8:-}"
TS=$(date -u +%Y-%m-%dT%H:%M:%SZ)
EVFILE="$(dirname "$0")/events/ua-supp.json"
[ -f "$EVFILE" ] || echo "[]" > "$EVFILE"
TMP=$(mktemp)
jq --argjson seq "$SEQ" --arg step "$STEP" --arg action "$ACTION" --arg expected "$EXPECTED" --arg observed "$OBSERVED" --arg evid "$EVID" --arg ts "$TS" --arg handoff "$HANDOFF" --arg artifact "$ARTIFACT" '
  . + [{
    run_id: "run-001",
    journey_version: "v2-approved",
    role_id: "UA-SUPP",
    task_id: "timeouts-capacity",
    step_id: $step,
    sequence: $seq,
    actor: "UA-SUPP",
    action: $action,
    channel: "API",
    expected: $expected,
    observed: $observed,
    evidence_ref: $evid,
    timestamp: $ts,
    data_classification: "synthetic",
    gate_status: "proceed"
  } + (if $handoff != "" then {
    handoff_id: $handoff,
    artifact_id: $artifact,
    artifact_version: "1",
    consent_ref: "cloudOrg (supp-device)",
    sender_role_id: "system-sweeper",
    recipient_role_id: "UA-W2"
  } else {} end)]' "$EVFILE" > "$TMP" && mv "$TMP" "$EVFILE"
