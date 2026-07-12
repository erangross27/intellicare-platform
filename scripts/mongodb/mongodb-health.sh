#!/bin/bash
# MongoDB Health Monitor for WSL2

LOG_FILE="/home/erangross/IntelliCare/.mongodb/health.log"
PID_FILE="/home/erangross/IntelliCare/.mongodb/mongod.pid"

check_mongodb() {
    if mongosh --eval "db.adminCommand('ping')" --quiet 2>/dev/null | grep -q 'ok: 1'; then
        echo "$(date): MongoDB is healthy"
        return 0
    else
        echo "$(date): MongoDB is down - restarting..."
        return 1
    fi
}

restart_mongodb() {
    # Kill any existing mongod
    pkill -x mongod 2>/dev/null
    sleep 2
    
    # Clean up socket file if exists
    rm -f /tmp/mongodb-27017.sock
    
    # Start MongoDB with specific settings for WSL2
    cd /home/erangross/IntelliCare/.mongodb
    nohup mongod --dbpath /home/erangross/IntelliCare/.mongodb \
        --bind_ip 127.0.0.1 \
        --logpath /home/erangross/IntelliCare/.mongodb/mongod.log \
        --logappend \
        --wiredTigerCacheSizeGB 1 \
        --maxConns 500 \
        --slowOpSampleRate 0.1 \
        --setParameter heartbeatIntervalMillis=2000 \
        > /dev/null 2>&1 &
    
    sleep 3
    
    if check_mongodb; then
        echo "$(date): MongoDB restarted successfully (PID: $(pgrep -x mongod))"
    else
        echo "$(date): FAILED to restart MongoDB"
    fi
}

# Main
echo "$(date): Health check started" >> "$LOG_FILE"
if ! check_mongodb; then
    restart_mongodb >> "$LOG_FILE" 2>&1
fi
