#!/usr/bin/env python3
"""
Dev Platform Backup Manager
Backs up MongoDB, Redis, and encrypted databases without encryption
Creates ZIP archives for easy restoration
"""

import os
import sys
import json
import shutil
import zipfile
import argparse
import subprocess
import tempfile
from datetime import datetime
from pathlib import Path
import logging

logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

class BackupManager:
    def __init__(self, backup_dir=None, config_file=None):
        self.timestamp = datetime.now().strftime('%Y%m%d_%H%M%S')
        self.backup_dir = backup_dir or Path.home() / 'backups'
        self.backup_dir = Path(self.backup_dir)
        self.backup_dir.mkdir(parents=True, exist_ok=True)

        self.temp_dir = None
        self.config = self.load_config(config_file) if config_file else {}

    def load_config(self, config_file):
        """Load configuration from JSON file"""
        try:
            with open(config_file, 'r') as f:
                return json.load(f)
        except Exception as e:
            logger.warning(f"Could not load config file: {e}")
            return {}

    def run_command(self, command, shell=True, check=True):
        """Execute shell command and return output"""
        try:
            result = subprocess.run(
                command,
                shell=shell,
                check=check,
                capture_output=True,
                text=True
            )
            return result.stdout.strip()
        except subprocess.CalledProcessError as e:
            logger.error(f"Command failed: {command}")
            logger.error(f"Error: {e.stderr}")
            if check:
                raise
            return None

    def backup_mongodb(self):
        """Backup MongoDB databases"""
        logger.info("Starting MongoDB backup...")
        mongo_backup_dir = self.temp_dir / 'mongodb'
        mongo_backup_dir.mkdir(parents=True, exist_ok=True)

        # Get MongoDB connection info
        mongo_host = self.config.get('mongodb', {}).get('host', 'localhost')
        mongo_port = self.config.get('mongodb', {}).get('port', 27017)
        mongo_user = self.config.get('mongodb', {}).get('username')
        mongo_pass = self.config.get('mongodb', {}).get('password')
        mongo_auth_db = self.config.get('mongodb', {}).get('authdb', 'admin')

        # Build mongodump command
        cmd = f"mongodump --host {mongo_host}:{mongo_port} --out {mongo_backup_dir}"

        if mongo_user and mongo_pass:
            cmd += f" --username {mongo_user} --password {mongo_pass} --authenticationDatabase {mongo_auth_db}"

        # Check if encryption is enabled and handle it
        if self.config.get('mongodb', {}).get('encrypted'):
            logger.info("MongoDB encryption detected, exporting as plain text...")
            # Export collections as JSON for decrypted backup
            self.export_mongodb_json(mongo_backup_dir)
        else:
            # Regular mongodump
            self.run_command(cmd)

        logger.info("MongoDB backup completed")
        return mongo_backup_dir

    def export_mongodb_json(self, backup_dir):
        """Export MongoDB collections as JSON (decrypted)"""
        mongo_host = self.config.get('mongodb', {}).get('host', 'localhost')
        mongo_port = self.config.get('mongodb', {}).get('port', 27017)

        # Get specific databases to backup from config, or use defaults
        databases_to_backup = self.config.get('mongodb', {}).get('databases_to_backup', [])

        if not databases_to_backup:
            # Try to get list of databases (fallback method without mongosh)
            try:
                # Use mongo command or mongoexport to list databases
                databases = ['intellicare_practice_global', 'intellicare_practice_yale']
            except:
                databases = []
        else:
            databases = databases_to_backup

        for db in databases:
            if db and db not in ['admin', 'config', 'local']:
                db_dir = backup_dir / db
                db_dir.mkdir(parents=True, exist_ok=True)

                # Export each database completely using mongodump (works with encryption)
                logger.info(f"Exporting database: {db}")
                dump_cmd = f"mongodump --host {mongo_host}:{mongo_port} --db {db} --out {backup_dir}"

                try:
                    self.run_command(dump_cmd, check=False)
                except Exception as e:
                    logger.warning(f"Could not export {db}: {e}")

                    # Try alternative: export as JSON using mongoexport for important collections
                    important_collections = [
                        'users', 'patients', 'appointments', 'documents',
                        'practices', 'serviceaccounts', 'chat_messages'
                    ]

                    for collection in important_collections:
                        try:
                            output_file = db_dir / f"{collection}.json"
                            export_cmd = f"mongoexport --host {mongo_host}:{mongo_port} --db {db} --collection {collection} --out {output_file} 2>/dev/null"
                            result = self.run_command(export_cmd, check=False)
                            if result:
                                logger.info(f"  Exported {db}.{collection}")
                        except:
                            pass

    def backup_redis(self):
        """Backup Redis data"""
        logger.info("Starting Redis backup...")
        redis_backup_dir = self.temp_dir / 'redis'
        redis_backup_dir.mkdir(parents=True, exist_ok=True)

        redis_host = self.config.get('redis', {}).get('host', 'localhost')
        redis_port = self.config.get('redis', {}).get('port', 6379)
        redis_pass = self.config.get('redis', {}).get('password')

        # Force Redis to save current state
        auth_part = f"-a {redis_pass}" if redis_pass else ""
        self.run_command(f"redis-cli -h {redis_host} -p {redis_port} {auth_part} BGSAVE", check=False)

        # Wait for save to complete
        import time
        time.sleep(2)

        # Find Redis dump file
        redis_dir_cmd = f"redis-cli -h {redis_host} -p {redis_port} {auth_part} CONFIG GET dir"
        redis_dir = self.run_command(redis_dir_cmd, check=False)

        if redis_dir:
            # Parse the output to get the directory path
            lines = redis_dir.split('\n')
            if len(lines) >= 2:
                dump_dir = lines[1]
                dump_file = Path(dump_dir) / 'dump.rdb'

                if dump_file.exists():
                    # Try to copy with sudo if regular copy fails
                    try:
                        shutil.copy2(dump_file, redis_backup_dir / 'dump.rdb')
                        logger.info("Redis backup completed")
                    except PermissionError:
                        # Use sudo to copy the file
                        sudo_cmd = f"sudo cp {dump_file} {redis_backup_dir / 'dump.rdb'}"
                        self.run_command(sudo_cmd)
                        # Change ownership to current user
                        chown_cmd = f"sudo chown {os.getenv('USER')}:{os.getenv('USER')} {redis_backup_dir / 'dump.rdb'}"
                        self.run_command(chown_cmd)
                        logger.info("Redis backup completed (with sudo)")
                else:
                    logger.warning(f"Redis dump file not found at {dump_file}")

        # Also export Redis keys as JSON for better portability
        self.export_redis_json(redis_backup_dir)

        return redis_backup_dir

    def export_redis_json(self, backup_dir):
        """Export Redis keys as JSON"""
        redis_host = self.config.get('redis', {}).get('host', 'localhost')
        redis_port = self.config.get('redis', {}).get('port', 6379)
        redis_pass = self.config.get('redis', {}).get('password')

        auth_part = f"-a {redis_pass}" if redis_pass else ""

        try:
            # Get all keys
            keys_cmd = f"redis-cli -h {redis_host} -p {redis_port} {auth_part} --scan"
            keys_output = self.run_command(keys_cmd, check=False)

            if keys_output:
                keys_data = {}
                for key in keys_output.split('\n'):
                    if key:
                        try:
                            # Get key type and value
                            type_cmd = f"redis-cli -h {redis_host} -p {redis_port} {auth_part} TYPE {key}"
                            key_type = self.run_command(type_cmd, check=False)

                            if key_type == 'string':
                                value_cmd = f"redis-cli -h {redis_host} -p {redis_port} {auth_part} GET {key}"
                                value = self.run_command(value_cmd, check=False)
                                keys_data[key] = {'type': 'string', 'value': value}
                            elif key_type == 'list':
                                value_cmd = f"redis-cli -h {redis_host} -p {redis_port} {auth_part} LRANGE {key} 0 -1"
                                value = self.run_command(value_cmd, check=False)
                                keys_data[key] = {'type': 'list', 'value': value.split('\n') if value else []}
                            elif key_type == 'hash':
                                value_cmd = f"redis-cli -h {redis_host} -p {redis_port} {auth_part} HGETALL {key}"
                                value = self.run_command(value_cmd, check=False)
                                keys_data[key] = {'type': 'hash', 'value': value}
                        except Exception as e:
                            logger.debug(f"Could not export key {key}: {e}")
                            continue

                # Save as JSON
                with open(backup_dir / 'redis_keys.json', 'w', encoding='utf-8') as f:
                    json.dump(keys_data, f, indent=2, ensure_ascii=False)

                logger.info(f"Exported {len(keys_data)} Redis keys")
        except Exception as e:
            logger.warning(f"Could not export Redis keys as JSON: {e}")
            # Continue with backup even if JSON export fails

    def backup_files(self):
        """Backup additional files and directories"""
        logger.info("Backing up additional files...")
        files_backup_dir = self.temp_dir / 'files'
        files_backup_dir.mkdir(parents=True, exist_ok=True)

        # Default important directories to backup
        backup_paths = self.config.get('files', {}).get('paths', [])

        if not backup_paths:
            # Use some common development directories
            common_paths = [
                '/etc/mongod.conf',
                '/etc/redis/redis.conf',
                '/etc/redis.conf',
                str(Path.home() / '.env'),
                str(Path.home() / '.bashrc'),
                str(Path.home() / '.profile'),
            ]
            backup_paths = [p for p in common_paths if Path(p).exists()]

        for path in backup_paths:
            path = Path(path)
            if path.exists():
                if path.is_file():
                    dest = files_backup_dir / path.name
                    shutil.copy2(path, dest)
                    logger.info(f"Backed up file: {path}")
                elif path.is_dir():
                    dest = files_backup_dir / path.name
                    shutil.copytree(path, dest, ignore_dangling_symlinks=True)
                    logger.info(f"Backed up directory: {path}")

        return files_backup_dir

    def backup_code(self):
        """Backup application code directories"""
        logger.info("Backing up application code...")
        code_backup_dir = self.temp_dir / 'code'
        code_backup_dir.mkdir(parents=True, exist_ok=True)

        code_dirs = self.config.get('code', {}).get('directories', [])
        exclude_patterns = self.config.get('code', {}).get('exclude_patterns', [])

        # Create exclude function for shutil.copytree
        def ignore_patterns(dir_path, filenames):
            ignored = set()
            for pattern in exclude_patterns:
                for filename in filenames:
                    full_path = Path(dir_path) / filename
                    # Check if it's a directory that should be excluded
                    if pattern in ['node_modules', '.git', 'dist', 'build', '.cache', 'coverage', '.next', '.nuxt', '.vscode', '.idea']:
                        if filename == pattern:
                            ignored.add(filename)
                    # Check file patterns
                    elif pattern.startswith('*'):
                        if filename.endswith(pattern[1:]):
                            ignored.add(filename)
                    elif pattern in filename:
                        ignored.add(filename)
            return ignored

        for code_dir in code_dirs:
            code_path = Path(code_dir)
            if code_path.exists() and code_path.is_dir():
                dest_name = code_path.name
                dest_path = code_backup_dir / dest_name

                logger.info(f"Backing up code directory: {code_path}")
                logger.info(f"Excluding: {', '.join(exclude_patterns)}")

                # Calculate approximate size before backup
                total_size = 0
                file_count = 0
                for root, dirs, files in os.walk(code_path):
                    # Skip excluded directories
                    dirs[:] = [d for d in dirs if d not in ['node_modules', '.git', 'dist', 'build', '.cache']]
                    for file in files:
                        if not any(file.endswith(ext) for ext in ['.log', '.tmp']):
                            file_count += 1
                            file_path = Path(root) / file
                            if file_path.exists():
                                total_size += file_path.stat().st_size

                size_mb = total_size / (1024 * 1024)
                logger.info(f"Estimated backup size: {size_mb:.2f} MB, {file_count} files")

                # Copy with exclusions
                shutil.copytree(
                    code_path,
                    dest_path,
                    ignore=ignore_patterns,
                    ignore_dangling_symlinks=True
                )

                # Calculate actual backed up size
                actual_size = sum(
                    f.stat().st_size for f in dest_path.rglob('*') if f.is_file()
                )
                actual_mb = actual_size / (1024 * 1024)
                actual_files = sum(1 for _ in dest_path.rglob('*') if _.is_file())

                logger.info(f"Backed up {actual_files} files ({actual_mb:.2f} MB) from {code_path}")

        return code_backup_dir

    def backup_postgresql(self):
        """Backup PostgreSQL databases if present"""
        # Check if PostgreSQL is installed and running
        pg_check = self.run_command("which pg_dump", check=False)
        if not pg_check:
            logger.info("PostgreSQL not found, skipping...")
            return None

        logger.info("Starting PostgreSQL backup...")
        pg_backup_dir = self.temp_dir / 'postgresql'
        pg_backup_dir.mkdir(parents=True, exist_ok=True)

        pg_host = self.config.get('postgresql', {}).get('host', 'localhost')
        pg_port = self.config.get('postgresql', {}).get('port', 5432)
        pg_user = self.config.get('postgresql', {}).get('username', 'postgres')
        pg_pass = self.config.get('postgresql', {}).get('password')

        # Set password in environment if provided
        env = os.environ.copy()
        if pg_pass:
            env['PGPASSWORD'] = pg_pass

        # Get list of databases
        list_db_cmd = f"psql -h {pg_host} -p {pg_port} -U {pg_user} -t -c 'SELECT datname FROM pg_database WHERE datistemplate = false;'"
        databases = self.run_command(list_db_cmd, check=False)

        if databases:
            for db in databases.split('\n'):
                db = db.strip()
                if db and db not in ['postgres']:
                    logger.info(f"Backing up PostgreSQL database: {db}")
                    dump_file = pg_backup_dir / f"{db}.sql"
                    dump_cmd = f"pg_dump -h {pg_host} -p {pg_port} -U {pg_user} -d {db} -f {dump_file} --no-owner --no-privileges"

                    subprocess.run(dump_cmd, shell=True, env=env, check=False)

        logger.info("PostgreSQL backup completed")
        return pg_backup_dir

    def backup_mysql(self):
        """Backup MySQL/MariaDB databases if present"""
        # Check if MySQL is installed
        mysql_check = self.run_command("which mysqldump", check=False)
        if not mysql_check:
            logger.info("MySQL not found, skipping...")
            return None

        logger.info("Starting MySQL backup...")
        mysql_backup_dir = self.temp_dir / 'mysql'
        mysql_backup_dir.mkdir(parents=True, exist_ok=True)

        mysql_host = self.config.get('mysql', {}).get('host', 'localhost')
        mysql_port = self.config.get('mysql', {}).get('port', 3306)
        mysql_user = self.config.get('mysql', {}).get('username', 'root')
        mysql_pass = self.config.get('mysql', {}).get('password')

        # Build connection string
        conn_str = f"-h {mysql_host} -P {mysql_port} -u {mysql_user}"
        if mysql_pass:
            conn_str += f" -p{mysql_pass}"

        # Get list of databases
        list_db_cmd = f"mysql {conn_str} -e 'SHOW DATABASES;' -s -N"
        databases = self.run_command(list_db_cmd, check=False)

        if databases:
            for db in databases.split('\n'):
                if db and db not in ['information_schema', 'mysql', 'performance_schema', 'sys']:
                    logger.info(f"Backing up MySQL database: {db}")
                    dump_file = mysql_backup_dir / f"{db}.sql"
                    dump_cmd = f"mysqldump {conn_str} --databases {db} --single-transaction --routines --triggers > {dump_file}"
                    self.run_command(dump_cmd, check=False)

        logger.info("MySQL backup completed")
        return mysql_backup_dir

    def create_zip_archive(self):
        """Create final ZIP archive of all backups"""
        archive_name = f"backup_{self.timestamp}.zip"
        archive_path = self.backup_dir / archive_name

        logger.info(f"Creating ZIP archive: {archive_path}")

        with zipfile.ZipFile(archive_path, 'w', zipfile.ZIP_DEFLATED) as zipf:
            for root, dirs, files in os.walk(self.temp_dir):
                for file in files:
                    file_path = Path(root) / file
                    arcname = file_path.relative_to(self.temp_dir)
                    zipf.write(file_path, arcname)
                    logger.debug(f"Added to archive: {arcname}")

        # Calculate archive size
        size_mb = archive_path.stat().st_size / (1024 * 1024)
        logger.info(f"Archive created: {archive_path} ({size_mb:.2f} MB)")

        return archive_path

    def create_restore_script(self):
        """Create a restore script for the backup"""
        restore_script = self.temp_dir / 'restore.sh'

        script_content = f'''#!/bin/bash
# Restore script for backup created on {self.timestamp}
# Usage: ./restore.sh [backup.zip] [--test|--production]
#
# SAFETY: By default restores to TEST databases with _test suffix
# Use --production flag ONLY if you want to restore to production

set -e

BACKUP_FILE=${{1:-backup_{self.timestamp}.zip}}
MODE=${{2:-"--test"}}
TEMP_DIR=$(mktemp -d)

echo "============================================"
if [ "$MODE" = "--production" ]; then
    echo "⚠️  WARNING: PRODUCTION RESTORE MODE"
    echo "This will OVERWRITE production databases!"
    read -p "Type 'YES RESTORE PRODUCTION' to continue: " confirm
    if [ "$confirm" != "YES RESTORE PRODUCTION" ]; then
        echo "Aborted."
        exit 1
    fi
    DB_SUFFIX=""
    REDIS_DB=0
else
    echo "✅ SAFE TEST MODE - Restoring to test databases"
    DB_SUFFIX="_test"
    REDIS_DB=1  # Use Redis database 1 for testing
fi
echo "============================================"

echo "Extracting backup from $BACKUP_FILE..."
unzip -q "$BACKUP_FILE" -d "$TEMP_DIR"

# Restore MongoDB
if [ -d "$TEMP_DIR/mongodb" ]; then
    echo "Restoring MongoDB to databases with suffix: $DB_SUFFIX"
    if [ -f "$TEMP_DIR/mongodb/*/dump.json" ]; then
        # Restore from JSON exports
        for db_dir in "$TEMP_DIR"/mongodb/*/; do
            db_name=$(basename "$db_dir")
            target_db="${{db_name}}${{DB_SUFFIX}}"
            echo "Restoring to database: $target_db"
            for json_file in "$db_dir"/*.json; do
                if [ -f "$json_file" ]; then
                    collection=$(basename "$json_file" .json)
                    echo "  Importing collection: $collection"
                    mongoimport --db "$target_db" --collection "$collection" --file "$json_file" --drop
                fi
            done
        done
    else
        # Restore from mongodump
        if [ "$MODE" = "--test" ]; then
            # For test mode, restore with different database names
            for db_dir in "$TEMP_DIR"/mongodb/*/; do
                if [ -d "$db_dir" ]; then
                    db_name=$(basename "$db_dir")
                    target_db="${{db_name}}${{DB_SUFFIX}}"
                    echo "Restoring $db_name to $target_db..."
                    mongorestore --db "$target_db" --drop "$db_dir"
                fi
            done
        else
            # Production restore
            mongorestore --drop "$TEMP_DIR/mongodb"
        fi
    fi
fi

# Restore Redis
if [ -d "$TEMP_DIR/redis" ]; then
    echo "Restoring Redis to database: $REDIS_DB"

    if [ "$MODE" = "--production" ]; then
        # Production Redis restore
        if [ -f "$TEMP_DIR/redis/dump.rdb" ]; then
            echo "Restoring Redis dump to production..."
            sudo systemctl stop redis
            sudo cp "$TEMP_DIR/redis/dump.rdb" /var/lib/redis/dump.rdb
            sudo chown redis:redis /var/lib/redis/dump.rdb
            sudo systemctl start redis
        fi
    else
        # Test Redis restore - use separate database
        if [ -f "$TEMP_DIR/redis/redis_keys.json" ]; then
            echo "Restoring Redis keys to test database $REDIS_DB..."
            python3 -c "
import json
import redis
r = redis.Redis(db=$REDIS_DB)
r.flushdb()  # Clear test database
with open('$TEMP_DIR/redis/redis_keys.json') as f:
    data = json.load(f)
    for key, info in data.items():
        if info['type'] == 'string':
            r.set(key, info['value'])
        # Add more type handling as needed
    print(f'Restored {{len(data)}} keys to Redis database $REDIS_DB')
"
        fi
    fi
fi

# Restore PostgreSQL
if [ -d "$TEMP_DIR/postgresql" ]; then
    echo "Restoring PostgreSQL..."
    for sql_file in "$TEMP_DIR"/postgresql/*.sql; do
        if [ -f "$sql_file" ]; then
            db_name=$(basename "$sql_file" .sql)
            echo "Restoring database: $db_name"
            psql -U postgres -c "DROP DATABASE IF EXISTS $db_name;"
            psql -U postgres -c "CREATE DATABASE $db_name;"
            psql -U postgres -d "$db_name" < "$sql_file"
        fi
    done
fi

# Restore MySQL
if [ -d "$TEMP_DIR/mysql" ]; then
    echo "Restoring MySQL..."
    for sql_file in "$TEMP_DIR"/mysql/*.sql; do
        if [ -f "$sql_file" ]; then
            echo "Restoring from: $(basename "$sql_file")"
            mysql < "$sql_file"
        fi
    done
fi

# Restore application code
if [ -d "$TEMP_DIR/code" ]; then
    echo "Restoring application code..."
    if [ "$MODE" = "--production" ]; then
        echo "WARNING: Restoring code to production location"
        read -p "Backup location for existing code (or 'skip' to skip): " backup_loc
        if [ "$backup_loc" != "skip" ]; then
            # Backup existing code first
            for code_dir in "$TEMP_DIR"/code/*/; do
                if [ -d "$code_dir" ]; then
                    app_name=$(basename "$code_dir")
                    target_path="/home/erangross/Development/$app_name"
                    if [ -d "$target_path" ]; then
                        echo "Backing up existing $target_path to $backup_loc/$app_name.bak"
                        mkdir -p "$backup_loc"
                        cp -r "$target_path" "$backup_loc/$app_name.bak"
                    fi
                    echo "Restoring $app_name..."
                    rm -rf "$target_path"
                    cp -r "$code_dir" "$target_path"
                fi
            done
        fi
    else
        # Test mode - restore to separate location
        TEST_CODE_DIR="/home/erangross/Development_TEST"
        echo "Restoring code to TEST location: $TEST_CODE_DIR"
        mkdir -p "$TEST_CODE_DIR"
        cp -r "$TEMP_DIR"/code/* "$TEST_CODE_DIR/"
        echo "Test code restored to $TEST_CODE_DIR"
    fi
fi

# Clean up
rm -rf "$TEMP_DIR"

echo "Restore completed successfully!"
'''

        with open(restore_script, 'w') as f:
            f.write(script_content)

        restore_script.chmod(0o755)
        logger.info("Created restore script")
        return restore_script

    def run_backup(self):
        """Main backup execution"""
        logger.info("=" * 60)
        logger.info(f"Starting backup at {datetime.now()}")
        logger.info("=" * 60)

        # Create temporary directory for backup files
        self.temp_dir = Path(tempfile.mkdtemp(prefix='backup_'))

        try:
            # Backup MongoDB
            self.backup_mongodb()

            # Backup Redis
            self.backup_redis()

            # Backup PostgreSQL if present
            self.backup_postgresql()

            # Backup MySQL if present
            self.backup_mysql()

            # Backup additional files
            self.backup_files()

            # Backup application code
            self.backup_code()

            # Create restore script
            self.create_restore_script()

            # Create metadata file
            metadata = {
                'timestamp': self.timestamp,
                'created_at': datetime.now().isoformat(),
                'hostname': os.uname().nodename,
                'components': {
                    'mongodb': (self.temp_dir / 'mongodb').exists(),
                    'redis': (self.temp_dir / 'redis').exists(),
                    'postgresql': (self.temp_dir / 'postgresql').exists(),
                    'mysql': (self.temp_dir / 'mysql').exists(),
                    'files': (self.temp_dir / 'files').exists(),
                    'code': (self.temp_dir / 'code').exists(),
                }
            }

            with open(self.temp_dir / 'metadata.json', 'w') as f:
                json.dump(metadata, f, indent=2)

            # Create ZIP archive
            archive_path = self.create_zip_archive()

            logger.info("=" * 60)
            logger.info("Backup completed successfully!")
            logger.info(f"Archive location: {archive_path}")
            logger.info("=" * 60)

            return archive_path

        except Exception as e:
            logger.error(f"Backup failed: {e}")
            raise
        finally:
            # Clean up temp directory
            if self.temp_dir and self.temp_dir.exists():
                shutil.rmtree(self.temp_dir)

def main():
    parser = argparse.ArgumentParser(description='Dev Platform Backup Manager')
    parser.add_argument('-d', '--dir', help='Backup directory', default='~/backups')
    parser.add_argument('-c', '--config', help='Configuration file (JSON)')
    parser.add_argument('--mongodb-only', action='store_true', help='Backup only MongoDB')
    parser.add_argument('--redis-only', action='store_true', help='Backup only Redis')

    args = parser.parse_args()

    # Expand user path
    backup_dir = os.path.expanduser(args.dir)

    try:
        backup_manager = BackupManager(backup_dir=backup_dir, config_file=args.config)

        if args.mongodb_only:
            backup_manager.temp_dir = Path(tempfile.mkdtemp(prefix='backup_'))
            backup_manager.backup_mongodb()
            backup_manager.create_zip_archive()
        elif args.redis_only:
            backup_manager.temp_dir = Path(tempfile.mkdtemp(prefix='backup_'))
            backup_manager.backup_redis()
            backup_manager.create_zip_archive()
        else:
            backup_manager.run_backup()

    except KeyboardInterrupt:
        logger.info("\nBackup interrupted by user")
        sys.exit(1)
    except Exception as e:
        logger.error(f"Backup failed: {e}")
        sys.exit(1)

if __name__ == '__main__':
    main()