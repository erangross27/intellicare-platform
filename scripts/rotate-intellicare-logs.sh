#!/bin/bash
#
# Rotate IntelliCare dev logs when they exceed MAX_BYTES, keeping ONE compressed
# archive per log. Uses copy-truncate (cp then `: > file`) instead of rename, so
# it works with the open file descriptors held by launchd / nodemon / vite —
# a plain rename would leave those processes writing to the moved file and free
# nothing. Truncating in place keeps the same inode, so the open fds keep working
# and the disk space is actually reclaimed.
#
# Result per log: current file (grows up to MAX, then resets) + one .1.gz archive.
# So each log is bounded to roughly MAX + (compressed MAX) on disk.
#
set -uo pipefail

MAX_BYTES=$((5 * 1024 * 1024))   # rotate a log once it passes 5 MB

LOGS=(
  "$HOME/Library/Logs/intellicare-backend.out.log"
  "$HOME/Library/Logs/intellicare-backend.err.log"
  "$HOME/Library/Logs/intellicare-frontend.out.log"
  "$HOME/Library/Logs/intellicare-frontend.err.log"
  "$HOME/Library/Logs/intellicare-metro.out.log"
  "$HOME/Library/Logs/intellicare-metro.err.log"
  "$HOME/dev/IntelliCare/apps/backend-api/logs/server.log"
  "$HOME/dev/IntelliCare/apps/backend-api/logs/server-errors.log"
)

STATUS_LOG="$HOME/Library/Logs/intellicare-logrotate.log"

for log in "${LOGS[@]}"; do
  [ -f "$log" ] || continue
  size=$(stat -f%z "$log" 2>/dev/null || echo 0)
  if [ "$size" -gt "$MAX_BYTES" ]; then
    cp "$log" "$log.1" 2>/dev/null && gzip -f "$log.1"   # -> $log.1.gz (overwrites previous archive)
    : > "$log"                                            # truncate in place, keep inode + open fds
    printf '%s  rotated %s (was %s bytes)\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$log" "$size" >> "$STATUS_LOG"
  fi
done
