#!/usr/bin/env bash
# QFAT-013L2 runner safety contract and executable regression tests.
# Linux only. No D-Bus, Secret Service, QFAT DB, or real credentials are used.
# This file is a test harness, not production application code.

set -uo pipefail

declare -gA QFAT_DISPOSABLE_PIDS=()
declare -ga QFAT_NOT_RUN_SUBTESTS=()
QFAT_CLEANUP_FAILURES=0
QFAT_BASE_DIR="${QFAT_BASE_DIR:-}"
declare -ga QFAT_HARNESS_PIDS=()
declare -ga QFAT_HARNESS_PIDFILES=()

qfat_harness_track_pid() {
  local pid="$1" start
  start="$(qfat_get_proc_starttime "$pid")" || return 1
  QFAT_HARNESS_PIDS+=("$pid:$start")
}
qfat_harness_forget_pid() {
  local target="$1" entry
  local -a kept=()
  for entry in "${QFAT_HARNESS_PIDS[@]}"; do [[ "$entry" == "$target:"* ]] || kept+=("$entry"); done
  QFAT_HARNESS_PIDS=("${kept[@]}")
}
qfat_harness_cleanup() {
  local entry pid start pidfile
  trap - EXIT
  for pidfile in "${QFAT_HARNESS_PIDFILES[@]}"; do
    if [[ -f "$pidfile" ]]; then
      read -r pid start < "$pidfile" || true
      if [[ "${pid:-}" =~ ^[0-9]+$ && "${start:-}" =~ ^[0-9]+$ ]] && qfat_verify_proc_identity "$pid" "$start"; then
        command kill -KILL "$pid" 2>/dev/null || true
      fi
      rm -f "$pidfile"
    fi
  done
  for entry in "${QFAT_HARNESS_PIDS[@]}"; do
    pid="${entry%%:*}"; start="${entry#*:}"
    if qfat_verify_proc_identity "$pid" "$start"; then command kill -KILL "$pid" 2>/dev/null || true; fi
  done
}

qfat_parse_proc_starttime_line() {
  local stat_line="$1" rest
  local -a fields=()
  rest="${stat_line##*) }"
  [[ "$rest" != "$stat_line" ]] || return 1
  read -r -a fields <<< "$rest"
  [[ ${#fields[@]} -ge 20 && "${fields[19]}" =~ ^[0-9]+$ ]] || return 1
  printf '%s\n' "${fields[19]}"
}

qfat_get_proc_starttime() {
  local pid="$1" stat_line
  [[ "$pid" =~ ^[0-9]+$ && -r "/proc/$pid/stat" ]] || return 1
  IFS= read -r stat_line < "/proc/$pid/stat" || return 1
  qfat_parse_proc_starttime_line "$stat_line"
}

qfat_verify_proc_identity() {
  local pid="$1" expected="$2" actual
  [[ "$pid" =~ ^[0-9]+$ && "$expected" =~ ^[0-9]+$ ]] || return 1
  if [[ "${QFAT_TEST_FORCE_MISMATCH_BEFORE_KILL_PID:-}" == "$pid" ]]; then return 1; fi
  actual="$(qfat_get_proc_starttime "$pid")" || return 1
  [[ "$actual" == "$expected" ]]
}

qfat_verify_disposable_provenance() {
  local pid="$1" expected_bus="$2" expected_home="$3" env_text
  [[ "$pid" =~ ^[0-9]+$ && -r "/proc/$pid/environ" ]] || return 1
  env_text="$(tr '\0' '\n' < "/proc/$pid/environ" 2>/dev/null)" || return 1
  grep -Fqx "DBUS_SESSION_BUS_ADDRESS=$expected_bus" <<< "$env_text" || return 1
  grep -Fqx "HOME=$expected_home" <<< "$env_text" || return 1
}

qfat_record_disposable_pid() {
  local pid="$1" name="$2" starttime
  starttime="$(qfat_get_proc_starttime "$pid")" || {
    printf 'ERROR: cannot record %s PID %s: starttime unavailable\n' "$name" "$pid" >&2
    return 1
  }
  QFAT_DISPOSABLE_PIDS["$pid"]="$starttime"
  printf 'TRACKED: %s pid=%s starttime=%s\n' "$name" "$pid" "$starttime"
}

qfat_unrecord_disposable_pid() { unset "QFAT_DISPOSABLE_PIDS[$1]"; }

qfat_kill() {
  local signal="$1" pid="$2"
  if [[ "${QFAT_TEST_IGNORE_TERM_PID:-}" == "$pid" && "$signal" == "-TERM" ]]; then
    QFAT_TEST_FORCE_MISMATCH_BEFORE_KILL_PID="$pid"
    return 0
  fi
  if [[ "${QFAT_TEST_KILL_FAIL_PID:-}" == "$pid" && "$signal" == "-TERM" ]]; then
    printf 'TEST SEAM: injected %s failure for PID %s\n' "$signal" "$pid" >&2
    return 1
  fi
  command kill "$signal" "$pid"
}

qfat_terminate_pid() {
  local pid="$1" name="$2" expected current waited=0
  [[ "$pid" =~ ^[0-9]+$ ]] || return 1
  expected="${QFAT_DISPOSABLE_PIDS[$pid]:-}"
  [[ -n "$expected" ]] || { printf 'REFUSED: %s PID %s is not tracked\n' "$name" "$pid"; return 1; }
  if ! qfat_verify_proc_identity "$pid" "$expected"; then
    current="$(qfat_get_proc_starttime "$pid" 2>/dev/null || printf 'unavailable')"
    printf 'IDENTITY MISMATCH: %s PID %s expected=%s actual=%s; refusing to signal\n' "$name" "$pid" "$expected" "$current"
    return 1
  fi
  if ! qfat_kill -0 "$pid" 2>/dev/null; then
    qfat_unrecord_disposable_pid "$pid"
    printf 'ALREADY STOPPED: %s PID %s\n' "$name" "$pid"
    return 0
  fi
  if ! qfat_kill -TERM "$pid" 2>/dev/null && qfat_verify_proc_identity "$pid" "$expected"; then
    printf 'ERROR: SIGTERM failed for the same live process %s PID %s\n' "$name" "$pid"
    return 1
  fi
  while qfat_kill -0 "$pid" 2>/dev/null && [[ "$waited" -lt 30 ]]; do
    sleep 0.05
    waited=$((waited + 1))
  done
  if qfat_kill -0 "$pid" 2>/dev/null; then
    if ! qfat_verify_proc_identity "$pid" "$expected"; then
      current="$(qfat_get_proc_starttime "$pid" 2>/dev/null || printf 'unavailable')"
      printf 'IDENTITY MISMATCH before SIGKILL: %s PID %s expected=%s actual=%s; refusing escalation\n' "$name" "$pid" "$expected" "$current"
      return 1
    fi
    if ! qfat_kill -KILL "$pid" 2>/dev/null && qfat_verify_proc_identity "$pid" "$expected"; then
      printf 'ERROR: SIGKILL failed for the same live process %s PID %s\n' "$name" "$pid"
      return 1
    fi
    sleep 0.05
  fi
  if qfat_kill -0 "$pid" 2>/dev/null; then
    printf 'ERROR: %s PID %s remains alive after termination\n' "$name" "$pid"
    return 1
  fi
  wait "$pid" 2>/dev/null || true
  qfat_unrecord_disposable_pid "$pid"
  printf 'TERMINATED: %s PID %s\n' "$name" "$pid"
}

qfat_remove_disposable_dir() {
  local dir="$1"
  if [[ "${QFAT_TEST_RM_FAIL:-0}" == "1" ]]; then
    printf 'TEST SEAM: injected rm failure for %s\n' "$dir" >&2
    return 1
  fi
  command rm -rf -- "$dir"
}

qfat_cleanup_all() {
  local original_status=$? cleanup_rc=0 remaining=0 pid
  local -a pids=()
  printf 'CLEANUP_BEGIN status=%s\n' "$original_status"
  [[ -z "${QFAT_CLEANUP_MARKER:-}" ]] || printf 'cleanup\n' >> "$QFAT_CLEANUP_MARKER" || cleanup_rc=1
  for pid in "${!QFAT_DISPOSABLE_PIDS[@]}"; do pids+=("$pid"); done
  for pid in "${pids[@]}"; do
    if ! qfat_terminate_pid "$pid" "tracked-disposable"; then
      cleanup_rc=1
      QFAT_CLEANUP_FAILURES=$((QFAT_CLEANUP_FAILURES + 1))
    fi
  done
  for pid in "${!QFAT_DISPOSABLE_PIDS[@]}"; do
    qfat_kill -0 "$pid" 2>/dev/null && remaining=$((remaining + 1))
  done
  if [[ "$remaining" -gt 0 || "$cleanup_rc" -ne 0 ]]; then
    printf 'cleanup_disposable_dir_removed=NOT_RUN (remaining=%s cleanup_rc=%s)\n' "$remaining" "$cleanup_rc"
    cleanup_rc=1
  elif [[ -n "$QFAT_BASE_DIR" && -d "$QFAT_BASE_DIR" ]]; then
    if qfat_remove_disposable_dir "$QFAT_BASE_DIR" && [[ ! -e "$QFAT_BASE_DIR" ]]; then
      printf 'cleanup_disposable_dir_removed=true\n'
    else
      printf 'cleanup_disposable_dir_removed=false\n'
      cleanup_rc=1
      QFAT_CLEANUP_FAILURES=$((QFAT_CLEANUP_FAILURES + 1))
    fi
  fi
  if [[ "$cleanup_rc" -ne 0 ]]; then
    printf 'CLEANUP_STATUS: FAILURE (cleanup_failures=%s)\n' "$QFAT_CLEANUP_FAILURES"
    exit 1
  elif [[ "$original_status" -eq 2 || ${#QFAT_NOT_RUN_SUBTESTS[@]} -gt 0 ]]; then
    printf 'NOT_RUN_SUBTESTS: %s\n' "${QFAT_NOT_RUN_SUBTESTS[*]}"
    printf 'CLEANUP_STATUS: NOT_RUN\n'
    exit 2
  elif [[ "$original_status" -eq 130 || "$original_status" -eq 143 ]]; then
    printf 'CLEANUP_STATUS: SIGNALLED (runner_status=%s)\n' "$original_status"
    exit "$original_status"
  elif [[ "$original_status" -ne 0 ]]; then
    printf 'CLEANUP_STATUS: FAILURE (runner_status=%s)\n' "$original_status"
    exit 1
  else
    printf 'CLEANUP_STATUS: SUCCESS\n'
    exit 0
  fi
}

qfat_signal_handler() {
  case "$1" in INT) exit 130 ;; TERM) exit 143 ;; *) exit 1 ;; esac
}
qfat_install_traps() {
  trap qfat_cleanup_all EXIT
  trap 'qfat_signal_handler INT' INT
  trap 'qfat_signal_handler TERM' TERM
}
qfat_finish_test_run() {
  if [[ ${#QFAT_NOT_RUN_SUBTESTS[@]} -gt 0 ]]; then
    printf 'ALL_TESTS_COMPLETED_SUCCESSFULLY=false (NOT_RUN: %s)\n' "${QFAT_NOT_RUN_SUBTESTS[*]}"
    exit 2
  fi
  printf 'ALL_TESTS_COMPLETED_SUCCESSFULLY=true\n'
  exit 0
}

qfat_fail() { printf 'FAIL: %s\n' "$*" >&2; exit 1; }
qfat_assert_contains() { [[ "$1" == *"$2"* ]] || qfat_fail "expected output to contain: $2"; }
qfat_assert_not_contains() { [[ "$1" != *"$2"* ]] || qfat_fail "unexpected output: $2"; }

qfat_run_child_scenario() {
  local scenario="$1" base="$2" output_file="$3" pid_file="$4" marker="$5" script
  script=$(cat <<'CHILD'
set -uo pipefail
source "$QFAT_TEST_SCRIPT"
QFAT_BASE_DIR="$QFAT_SCENARIO_BASE"
QFAT_CLEANUP_MARKER="$QFAT_SCENARIO_MARKER"
mkdir -p "$QFAT_BASE_DIR"
qfat_install_traps
case "$QFAT_SCENARIO" in
  kill-failure)
    nohup sleep 60 >/dev/null 2>&1 & child=$!
    printf '%s %s\n' "$child" "$(qfat_get_proc_starttime "$child")" > "$QFAT_SCENARIO_PID_FILE"
    qfat_record_disposable_pid "$child" "kill-failure-child" || exit 1
    QFAT_TEST_KILL_FAIL_PID="$child"
    exit 0
    ;;
  provenance-failure)
    expected_bus="unix:path=$QFAT_SCENARIO_BASE/run/bus"
    expected_home="$QFAT_SCENARIO_BASE/home"
    nohup env HOME=/tmp/qfat-wrong-home DBUS_SESSION_BUS_ADDRESS=unix:path=/tmp/qfat-wrong-bus sleep 60 >/dev/null 2>&1 & child=$!
    printf '%s %s\n' "$child" "$(qfat_get_proc_starttime "$child")" > "$QFAT_SCENARIO_PID_FILE"
    if qfat_verify_disposable_provenance "$child" "$expected_bus" "$expected_home"; then
      printf 'ERROR: wrong provenance unexpectedly accepted\n'
      exit 1
    fi
    QFAT_NOT_RUN_SUBTESTS+=("auto_activated_daemon_provenance_unverified")
    qfat_finish_test_run
    ;;
  rm-failure)
    QFAT_TEST_RM_FAIL=1
    exit 0
    ;;
  combined-failure)
    QFAT_NOT_RUN_SUBTESTS+=("forced_not_run")
    QFAT_TEST_RM_FAIL=1
    exit 2
    ;;
esac
CHILD
)
  if QFAT_TEST_SCRIPT="$0" QFAT_SCENARIO="$scenario" QFAT_SCENARIO_BASE="$base" QFAT_SCENARIO_MARKER="$marker" QFAT_SCENARIO_PID_FILE="$pid_file" bash -c "$script" >"$output_file" 2>&1; then return 0; else return $?; fi
}

qfat_test_pid_and_parser() {
  local line expected pid start guard_output guard_rc
  line='4242 (proc name (with ) parens)) S 1 2 3 4 5 6 7 8 9 10 11 12 13 14 15 16 17 18 987654'
  expected="$(qfat_parse_proc_starttime_line "$line")" || qfat_fail 'parser rejected comm fixture'
  [[ "$expected" == '987654' ]] || qfat_fail "parser returned $expected instead of 987654"
  sleep 60 & pid=$!
  qfat_harness_track_pid "$pid" || qfat_fail 'could not track test child'
  qfat_record_disposable_pid "$pid" 'pid-mismatch-test' >/dev/null || qfat_fail 'could not record child'
  start="${QFAT_DISPOSABLE_PIDS[$pid]}"
  QFAT_DISPOSABLE_PIDS["$pid"]='999999999999'
  if qfat_terminate_pid "$pid" 'mismatch-test'; then qfat_fail 'identity mismatch unexpectedly signalled process'; fi
  command kill -0 "$pid" 2>/dev/null || qfat_fail 'process died despite identity mismatch refusal'
  QFAT_DISPOSABLE_PIDS["$pid"]="$start"
  qfat_terminate_pid "$pid" 'mismatch-test' >/dev/null || qfat_fail 'valid tracked process did not terminate'
  [[ -z "${QFAT_DISPOSABLE_PIDS[$pid]:-}" ]] || qfat_fail 'terminated PID remained tracked'
  qfat_harness_forget_pid "$pid"
  sleep 60 & pid=$!
  qfat_harness_track_pid "$pid" || qfat_fail 'could not track SIGKILL guard child'
  qfat_record_disposable_pid "$pid" 'sigkill-guard-test' >/dev/null || qfat_fail 'could not record SIGKILL guard child'
  QFAT_TEST_IGNORE_TERM_PID="$pid"
  if guard_output="$(qfat_terminate_pid "$pid" 'sigkill-guard-test' 2>&1)"; then guard_rc=0; else guard_rc=$?; fi
  [[ "$guard_rc" -eq 1 ]] || qfat_fail "SIGKILL identity guard returned $guard_rc, expected 1"
  qfat_assert_contains "$guard_output" 'IDENTITY MISMATCH before SIGKILL'
  command kill -0 "$pid" 2>/dev/null || qfat_fail 'SIGKILL guard failed to preserve target process'
  command kill -KILL "$pid" 2>/dev/null || true
  wait "$pid" 2>/dev/null || true
  unset "QFAT_DISPOSABLE_PIDS[$pid]" QFAT_TEST_IGNORE_TERM_PID QFAT_TEST_FORCE_MISMATCH_BEFORE_KILL_PID
  printf 'PASS F-09: parser fixture, TERM mismatch refusal, pre-KILL mismatch refusal, PID cleanup\n'
}

qfat_test_not_run() {
  local base out marker pidfile pid rc content
  base="$(mktemp -d /tmp/qfat-013l2-notrun.XXXXXX)"
  out="$(mktemp)"; marker="$(mktemp)"; pidfile="$(mktemp)"; : > "$marker"
  QFAT_HARNESS_PIDFILES+=("$pidfile")
  if qfat_run_child_scenario provenance-failure "$base" "$out" "$pidfile" "$marker"; then rc=0; else rc=$?; fi
  [[ "$rc" -eq 2 ]] || qfat_fail "NOT RUN scenario exit=$rc, expected 2"
  content="$(cat "$out")"
  qfat_assert_contains "$content" 'ALL_TESTS_COMPLETED_SUCCESSFULLY=false'
  qfat_assert_not_contains "$content" 'ALL_TESTS_COMPLETED_SUCCESSFULLY=true'
  qfat_assert_contains "$content" 'CLEANUP_STATUS: NOT_RUN'
  [[ ! -d "$base" ]] || qfat_fail 'NOT RUN cleanup did not remove disposable directory'
  [[ "$(wc -l < "$marker")" -eq 1 ]] || qfat_fail 'NOT RUN cleanup did not run exactly once'
  pid="$(cat "$pidfile")"; command kill -KILL "$pid" 2>/dev/null || true
  rm -f "$out" "$marker" "$pidfile"
  printf 'PASS F-10: real provenance mismatch path, exit 2, no false success, cleanup once\n'
}

qfat_test_cleanup_failures() {
  local base out marker pid rc content
  base="$(mktemp -d /tmp/qfat-013l2-killfail.XXXXXX)"; out="$(mktemp)"; marker="$(mktemp)"; : > "$marker"
  QFAT_HARNESS_PIDFILES+=("/tmp/qfat-013l2-childpid")
  if qfat_run_child_scenario kill-failure "$base" "$out" /tmp/qfat-013l2-childpid "$marker"; then rc=0; else rc=$?; fi
  [[ "$rc" -eq 1 ]] || qfat_fail "termination failure exit=$rc, expected 1"
  content="$(cat "$out")"
  qfat_assert_contains "$content" 'CLEANUP_STATUS: FAILURE'
  qfat_assert_contains "$content" 'cleanup_disposable_dir_removed=NOT_RUN'
  [[ -d "$base" ]] || qfat_fail 'directory removed while tracked process remained alive'
  read -r pid start < /tmp/qfat-013l2-childpid
  command kill -0 "$pid" 2>/dev/null || qfat_fail 'injected termination failure did not leave child alive'
  if qfat_verify_proc_identity "$pid" "$start"; then command kill -KILL "$pid" 2>/dev/null || true; fi
  rm -f /tmp/qfat-013l2-childpid; rm -rf "$base"
  [[ "$(wc -l < "$marker")" -eq 1 ]] || qfat_fail 'termination-failure cleanup did not run exactly once'
  rm -f "$out" "$marker"
  base="$(mktemp -d /tmp/qfat-013l2-rmfail.XXXXXX)"; out="$(mktemp)"; marker="$(mktemp)"; : > "$marker"
  if qfat_run_child_scenario rm-failure "$base" "$out" /dev/null "$marker"; then rc=0; else rc=$?; fi
  [[ "$rc" -eq 1 ]] || qfat_fail "rm failure exit=$rc, expected 1"
  content="$(cat "$out")"; qfat_assert_contains "$content" 'CLEANUP_STATUS: FAILURE'
  [[ -d "$base" ]] || qfat_fail 'directory disappeared despite injected rm failure'
  [[ "$(wc -l < "$marker")" -eq 1 ]] || qfat_fail 'rm-failure cleanup did not run exactly once'
  rm -rf "$base"; rm -f "$out" "$marker"

  base="$(mktemp -d /tmp/qfat-013l2-combined.XXXXXX)"; out="$(mktemp)"; marker="$(mktemp)"; : > "$marker"
  if qfat_run_child_scenario combined-failure "$base" "$out" /dev/null "$marker"; then rc=0; else rc=$?; fi
  [[ "$rc" -eq 1 ]] || qfat_fail "combined cleanup+NOT RUN exit=$rc, expected 1"
  content="$(cat "$out")"
  qfat_assert_contains "$content" 'CLEANUP_STATUS: FAILURE'
  qfat_assert_not_contains "$content" 'CLEANUP_STATUS: NOT_RUN'
  [[ -d "$base" ]] || qfat_fail 'combined failure did not preserve directory'
  rm -rf "$base"; rm -f "$out" "$marker"
  printf 'PASS F-11: real cleanup path reports kill/rm failures, preserves directory, FAILURE outranks NOT RUN\n'
}

qfat_test_signals() {
  python3 - "$0" <<'PY'
import os, signal, subprocess, sys, tempfile, time
script = sys.argv[1]
for sig, expected in ((signal.SIGINT, 130), (signal.SIGTERM, 143)):
    base = tempfile.mkdtemp(prefix='qfat-013l2-signal-')
    marker = tempfile.mktemp(prefix='qfat-013l2-cleanup-marker-')
    ready = tempfile.mktemp(prefix='qfat-013l2-ready-')
    child = r'''source "$1"
QFAT_BASE_DIR="$2"; QFAT_CLEANUP_MARKER="$3"
mkdir -p "$QFAT_BASE_DIR"
qfat_install_traps
: > "$4"
while :; do sleep 0.05; done'''
    proc = subprocess.Popen(['bash', '-c', child, '_', script, base, marker, ready], stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True, start_new_session=True)
    deadline = time.time() + 5
    while not os.path.exists(ready) and time.time() < deadline and proc.poll() is None: time.sleep(0.02)
    if not os.path.exists(ready): os.killpg(proc.pid, signal.SIGKILL); proc.wait(); raise SystemExit('FAIL: signal test child did not become ready')
    os.kill(proc.pid, sig)
    try: output, _ = proc.communicate(timeout=5)
    except subprocess.TimeoutExpired: proc.kill(); raise SystemExit('FAIL: signal test child did not exit')
    if proc.returncode != expected: raise SystemExit(f'FAIL: {sig.name} exit={proc.returncode}, expected {expected}; output={output}')
    with open(marker, encoding='utf-8') as f: lines = f.readlines()
    if len(lines) != 1: raise SystemExit(f'FAIL: {sig.name} cleanup count={len(lines)}, expected 1')
    if os.path.exists(base): raise SystemExit(f'FAIL: {sig.name} cleanup left disposable directory')
    os.unlink(marker); os.unlink(ready)
print('PASS SIGNAL: actual SIGINT=130 and SIGTERM=143 delivered to live runner; EXIT cleanup exactly once')
PY
}

qfat_main() {
  trap qfat_harness_cleanup EXIT
  [[ "${BASH_VERSINFO[0]}" -ge 4 ]] || qfat_fail 'Bash 4+ required'
  command -v python3 >/dev/null || qfat_fail 'python3 required for real signal delivery test'
  qfat_test_pid_and_parser
  qfat_test_not_run
  qfat_test_cleanup_failures
  qfat_test_signals
  printf '\nALL RUNNER SAFETY TESTS PASSED\n'
}

if [[ "${BASH_SOURCE[0]}" == "$0" ]]; then qfat_main "$@"; fi
