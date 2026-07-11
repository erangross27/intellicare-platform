#!/bin/bash

# IntelliCare Debug Helper Functions
# Source this file: source debug-helpers.sh

# Find which process is using a port
function whats-on-port() {
    sudo lsof -i :$1
}

# Monitor MongoDB queries in real-time
function mongo-watch() {
    echo "Watching MongoDB operations..."
    mongosh mongodb://intellicare_app:<DB_PASSWORD>@localhost:27017/admin?authSource=admin --eval "
    db.getSiblingDB('admin').aggregate([
        { \$currentOp: { allUsers: true } },
        { \$match: { 'command.find': { \$exists: true } } }
    ])"
}

# Analyze Node.js memory leak
function node-heap-snapshot() {
    local PID=$(pgrep -f "node.*backend" | head -1)
    if [ -z "$PID" ]; then
        echo "Backend process not found"
        return 1
    fi
    kill -USR2 $PID
    echo "Heap snapshot triggered for PID $PID"
    echo "Check: /home/erangross/Development/IntelliCare/apps/backend-api/"
}

# Watch API endpoint performance
function api-monitor() {
    echo "Monitoring API endpoints..."
    watch -n 2 'curl -s -o /dev/null -w "%{http_code} %{time_total}s\n" http://localhost:5000/api/health'
}

# Find large log files
function find-large-logs() {
    find /home/erangross/Development/IntelliCare -name "*.log" -size +10M -exec ls -lh {} \;
}

# Clear all logs safely
function clear-logs() {
    echo "Clearing log files..."
    find /home/erangross/Development/IntelliCare/apps/backend-api/logs -name "*.log" -exec truncate -s 0 {} \;
    echo "Logs cleared"
}

# Check for memory leaks in Node
function check-node-memory() {
    local PID=$(pgrep -f "node.*backend" | head -1)
    if [ -z "$PID" ]; then
        echo "Backend process not found"
        return 1
    fi
    while true; do
        ps -p $PID -o pid,vsz,rss,comm
        sleep 5
    done
}

# Analyze dependencies
function check-deps() {
    cd /home/erangross/Development/IntelliCare/apps/backend-api
    echo "Checking for unused dependencies..."
    depcheck
    echo -e "\nChecking for circular dependencies..."
    madge --circular .
    echo -e "\nChecking for outdated packages..."
    npm outdated
}

# Monitor Redis
function redis-monitor() {
    redis-cli monitor
}

# Check all services status
function ic-status() {
    echo "🔍 IntelliCare Services Status"
    echo "=============================="

    echo -e "\n📡 Backend API:"
    curl -s http://localhost:5000/api/health || echo "❌ Not responding"

    echo -e "\n🖥️ Frontend:"
    curl -s http://localhost:3000 > /dev/null && echo "✅ Running" || echo "❌ Not running"

    echo -e "\n🍃 MongoDB:"
    mongosh mongodb://intellicare_app:<DB_PASSWORD>@localhost:27017/admin?authSource=admin --eval "db.adminCommand('ping')" > /dev/null 2>&1 && echo "✅ Connected" || echo "❌ Not connected"

    echo -e "\n🔴 Redis:"
    redis-cli ping > /dev/null 2>&1 && echo "✅ Running" || echo "❌ Not running"

    echo -e "\n📊 Port Usage:"
    sudo lsof -i :3000 -i :5000 -i :27017 -i :6379 | grep LISTEN
}

# Profile API endpoint
function profile-endpoint() {
    local ENDPOINT=$1
    local REQUESTS=${2:-100}
    echo "Profiling $ENDPOINT with $REQUESTS requests..."
    autocannon -c 10 -d 10 http://localhost:5000$ENDPOINT
}

# Generate flame graph for Node process
function flame-graph() {
    local PID=$(pgrep -f "node.*backend" | head -1)
    if [ -z "$PID" ]; then
        echo "Backend process not found"
        return 1
    fi
    echo "Generating flame graph for PID $PID..."
    0x -p $PID
}

echo "Debug helper functions loaded! Available commands:"
echo "  whats-on-port <port>     - Check what's using a port"
echo "  mongo-watch              - Monitor MongoDB queries"
echo "  node-heap-snapshot       - Trigger heap snapshot"
echo "  api-monitor              - Watch API health"
echo "  find-large-logs          - Find large log files"
echo "  clear-logs               - Safely clear logs"
echo "  check-node-memory        - Monitor Node.js memory"
echo "  check-deps               - Analyze dependencies"
echo "  redis-monitor            - Monitor Redis commands"
echo "  ic-status                - Check all services"
echo "  profile-endpoint <path>  - Load test an endpoint"
echo "  flame-graph              - Generate performance flame graph"