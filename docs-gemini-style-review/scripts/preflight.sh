#!/usr/bin/env bash
# Preflight for the docs-gemini-style-review skill.
#
# Every failure mode this checks for presents identically at the call site — the
# review command exits with no output — so run this before blaming the prompt.
#
# Usage: preflight.sh [--model <id>] [--skip-smoke]
# Exit:  0 ready, 1 something is broken (each check prints its own remedy)

set -u

MODEL="gemini-3.8-flash-high"
RUN_SMOKE=1
FAILED=0

while [ $# -gt 0 ]; do
  case "$1" in
    --model) MODEL="${2:?--model needs a value}"; shift 2 ;;
    --skip-smoke) RUN_SMOKE=0; shift ;;
    -h|--help) sed -n '2,10p' "$0"; exit 0 ;;
    *) echo "unknown argument: $1" >&2; exit 2 ;;
  esac
done

ok()   { printf '  OK    %s\n' "$1"; }
warn() { printf '  WARN  %s\n' "$1"; }
fail() { printf '  FAIL  %s\n' "$1"; FAILED=1; }
hint() { printf '        → %s\n' "$1"; }

REPO_ROOT="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
GUIDES="$REPO_ROOT/.ai/resources/styleguides"

echo "docs-gemini-style-review preflight"
echo

echo "agy CLI"
AGY_PATH="$(command -v agy || true)"
if [ -n "$AGY_PATH" ]; then
  ok "on PATH at $AGY_PATH"
else
  fail "agy not found on PATH"
  hint "expected at ~/.local/bin/agy — check that ~/.local/bin is on PATH, or run 'agy install'"
  echo
  echo "Cannot continue without the CLI."
  exit 1
fi

# 'agy models' round-trips to the service, so it fails on an expired login as
# well as on a bad model id. That makes it the cheapest auth check available.
MODELS="$(agy models 2>&1)"
if printf '%s' "$MODELS" | grep -q "$MODEL"; then
  ok "model '$MODEL' is available"
else
  fail "model '$MODEL' not offered by 'agy models'"
  hint "available ids:"
  printf '%s\n' "$MODELS" | sed 's/^/          /'
fi
echo

echo "Style guides"
if [ -d "$GUIDES" ]; then
  ok "$GUIDES"
  for f in docs-style-guide.md guides-style-guide.md word-list.md typography.md; do
    if [ -r "$GUIDES/$f" ]; then
      ok "$f ($(wc -c < "$GUIDES/$f" | tr -d ' ') bytes)"
    else
      fail "$f missing or unreadable"
      hint "refresh the vendored style materials per .ai/resources/README.md"
    fi
  done
else
  fail "styleguides directory not found at $GUIDES"
  hint "run from inside the kentico-docs repo, or refresh per .ai/resources/README.md"
fi
echo

if [ "$RUN_SMOKE" -eq 1 ]; then
  echo "Headless round trip"
  # The real trap this catches: in print mode agy cannot display a permission
  # prompt, so any tool call is auto-denied and the run ends with no output at
  # all. A prompt that needs no tools proves the transport works, which tells
  # you an empty review is a permissions problem rather than a dead CLI.
  SMOKE="$(agy -p 'Reply with exactly the two characters: OK' --model "$MODEL" --print-timeout 90s 2>&1)"
  if printf '%s' "$SMOKE" | grep -q 'OK'; then
    ok "print mode answered on $MODEL"
  elif [ -z "$SMOKE" ]; then
    fail "print mode returned nothing"
    hint "the model produced no output — retry, and if it persists try a lower tier such as ${MODEL%-*}-medium"
  else
    fail "print mode returned an unexpected answer"
    printf '%s\n' "$SMOKE" | sed 's/^/          /'
  fi
  echo

  echo "Tool permissions"
  # Reading a file is the smallest possible tool call, so this isolates the
  # permission layer from everything else the review does.
  PERM="$(agy -p "Read the file .ai/resources/styleguides/word-list.md and reply with only its first heading line." \
    --model "$MODEL" --mode plan --dangerously-skip-permissions --print-timeout 120s 2>&1)"
  if printf '%s' "$PERM" | grep -qi 'terminology'; then
    ok "file reads work with --mode plan --dangerously-skip-permissions"
  elif printf '%s' "$PERM" | grep -qi 'permission'; then
    fail "tool calls are being denied"
    hint "headless mode cannot prompt — pass --dangerously-skip-permissions on every run, pasted-in prompts included"
    printf '%s\n' "$PERM" | sed 's/^/          /'
  elif printf '%s' "$PERM" | grep -qi 'timeout'; then
    warn "file-read probe timed out after 120s"
    hint "slowness, not permissions — run the review with --print-timeout 30m in the background; the flags above are still right"
    printf '%s\n' "$PERM" | sed 's/^/          /'
  else
    fail "could not confirm file reads"
    hint "paste the material into the prompt per SKILL.md and keep --mode plan --dangerously-skip-permissions"
    printf '%s\n' "$PERM" | sed 's/^/          /'
  fi
  echo
fi

if [ "$FAILED" -eq 0 ]; then
  echo "Ready. Review with:"
  echo "  agy -p '<prompt>' --model $MODEL --mode plan --dangerously-skip-permissions"
  exit 0
fi

echo "Not ready — see the remedies above. A timed-out probe is slowness, not a"
echo "blocker: the review still runs with the flags above and a longer --print-timeout."
exit 1
