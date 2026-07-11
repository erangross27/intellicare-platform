#!/usr/bin/env bash
# Daily MongoDB backup for IntelliCare.
# Produces an UNENCRYPTED zip at ~/mongodb-backup.zip (overwrites the previous
# day's backup) containing a full mongodump of all databases plus
# RESTORE_INSTRUCTIONS.md. Scheduled via cron (crontab -l).
set -euo pipefail

DEST_ZIP="$HOME/mongodb-backup.zip"
WORK_DIR="$(mktemp -d /tmp/mongodb-backup.XXXXXX)"
trap 'rm -rf "$WORK_DIR"' EXIT

DUMP_DIR="$WORK_DIR/dump"
TIMESTAMP="$(date '+%Y-%m-%d %H:%M:%S %Z')"

# Dump every database (mongodump skips the replica-set-internal "local" DB
# automatically; "admin" is included so user accounts survive a restore).
# Auth is not enforced on this mongod, so no credentials are needed.
mongodump --host 127.0.0.1 --port 27017 --out "$DUMP_DIR" --quiet

cat > "$WORK_DIR/RESTORE_INSTRUCTIONS.md" <<EOF
# IntelliCare MongoDB Backup — Restore Instructions

Backup created: $TIMESTAMP
Source machine: $(hostname) (Ubuntu)
Contents: full \`mongodump\` of all databases (admin, claude_memory,
intellicare_billing_codes, intellicare_drug_data, intellicare_practice_global,
intellicare_practice_yale) under \`dump/\`. NOT encrypted.

## Note for Claude (or anyone restoring)

This MongoDB instance is special in two ways — handle both BEFORE restoring:

1. **Replica set**: mongod runs as single-node replica set \`rs0\` bound to
   127.0.0.1. mongod.conf must have \`replication.replSetName: rs0\`. On a
   brand-new instance, initialize it once with:
   \`mongosh --eval 'rs.initiate({_id:"rs0", members:[{_id:0, host:"127.0.0.1:27017"}]})'\`
   (the app and MCP servers use replica-set features like change streams/transactions).

2. **rseq crash workaround (Ubuntu, MongoDB 8.2.x)**: mongod segfaults
   30–75s after start without this systemd override. Create
   \`/etc/systemd/system/mongod.service.d/glibc-rseq.conf\`:
   \`\`\`ini
   [Service]
   SystemCallFilter=~rseq
   SystemCallErrorNumber=ENOSYS
   \`\`\`
   then \`sudo systemctl daemon-reload && sudo systemctl restart mongod\`.
   Verify mongod stays up past ~90 seconds before restoring.

Auth note: user accounts exist in the admin DB but \`security.authorization\`
is NOT enabled in mongod.conf, so mongorestore needs no credentials.

## Restore steps

\`\`\`bash
# 1. Unzip
cd ~ && unzip -o mongodb-backup.zip -d mongodb-backup-restore

# 2. Make sure mongod is running (see the two notes above first)
systemctl status mongod

# 3. Restore everything, replacing existing collections
mongorestore --host 127.0.0.1 --port 27017 --drop mongodb-backup-restore/dump

# 4. Verify
mongosh --quiet --eval 'db.adminCommand({listDatabases:1}).databases.forEach(d=>print(d.name))'
\`\`\`

To restore a single database only:
\`mongorestore --host 127.0.0.1 --port 27017 --drop --nsInclude='intellicare_practice_yale.*' mongodb-backup-restore/dump\`

After restore, restart the backend (\`npm run dev\`) so it reconnects, and the
MCP servers (intellicare-mongodb, mongodb-memory) pick up data on next session.
EOF

# Build the zip in the work dir, then move it into place atomically so a
# failed run never clobbers the previous good backup.
cd "$WORK_DIR"
zip -r -q backup.zip dump RESTORE_INSTRUCTIONS.md
mv backup.zip "$DEST_ZIP"

echo "Backup written to $DEST_ZIP ($(du -h "$DEST_ZIP" | cut -f1)) at $TIMESTAMP"
