#!/bin/bash
# IntelliCare Health Check Script
# Generated: $(date)

echo "╔════════════════════════════════════════════════════╗"
echo "║       IntelliCare Backend Health Report           ║"
echo "╚════════════════════════════════════════════════════╝"

LOG_DIR="/home/erangross/Development/IntelliCare/apps/backend-api/logs"

echo -e "\n🏥 SYSTEM HEALTH OVERVIEW"
echo "=========================="

# Performance Check
echo -e "\n⚡ PERFORMANCE METRICS:"
PERF_DATA=$(rg "took: (\d+)ms" $LOG_DIR/server.log -o -r '$1' 2>/dev/null | sort -n)
if [ ! -z "$PERF_DATA" ]; then
    echo "$PERF_DATA" | awk '{all[NR]=$1} END{
        if(NR>0) {
            print "  • Operations analyzed: " NR
            print "  • Median response: " all[int(NR*0.5)] "ms"
            print "  • 90th percentile: " all[int(NR*0.9)] "ms"
            print "  • Slowest: " all[NR] "ms"
            if(all[int(NR*0.9)] > 1000) print "  ⚠️  WARNING: p90 > 1 second!"
        }
    }'
else
    echo "  • No performance data found"
fi

# Error Check
echo -e "\n❌ ERROR ANALYSIS:"
ERROR_COUNT=$(rg "ERROR|FAIL" $LOG_DIR/server.log -c 2>/dev/null || echo "0")
echo "  • Total errors: $ERROR_COUNT"
if [ "$ERROR_COUNT" -gt 0 ]; then
    echo "  • Recent errors:"
    rg "ERROR" $LOG_DIR/server.log --no-filename 2>/dev/null | tail -3 | sed 's/^/    - /'
fi

# Cache Performance
echo -e "\n💾 CACHE PERFORMANCE:"
CACHE_HITS=$(rg "CACHE HIT" $LOG_DIR/server.log -c 2>/dev/null || echo "0")
CACHE_MISSES=$(rg "CACHE MISS" $LOG_DIR/server.log -c 2>/dev/null || echo "0")
CACHE_FAILURES=$(rg "CACHE FAILURE" $LOG_DIR/server.log -c 2>/dev/null || echo "0")
TOTAL_CACHE=$((CACHE_HITS + CACHE_MISSES + CACHE_FAILURES))
if [ "$TOTAL_CACHE" -gt 0 ]; then
    HIT_RATE=$((CACHE_HITS * 100 / TOTAL_CACHE))
    echo "  • Cache hit rate: ${HIT_RATE}%"
    echo "  • Hits: $CACHE_HITS, Misses: $CACHE_MISSES, Failures: $CACHE_FAILURES"
    if [ "$HIT_RATE" -lt 50 ]; then
        echo "  ⚠️  WARNING: Low cache hit rate!"
    fi
else
    echo "  • No cache operations found"
fi

# Service Health
echo -e "\n🔧 SERVICE STATUS:"
SERVICE_ERRORS=$(rg "Service.*not found|No loader" $LOG_DIR/server.log -c 2>/dev/null || echo "0")
if [ "$SERVICE_ERRORS" -gt 0 ]; then
    echo "  ⚠️  Service loading issues detected: $SERVICE_ERRORS"
    rg "Service.*not found" $LOG_DIR/server.log --no-filename 2>/dev/null | head -2 | sed 's/^/    - /'
else
    echo "  ✅ All services loading correctly"
fi

# Database Health
echo -e "\n🗄️ DATABASE STATUS:"
DB_WARNINGS=$(rg "MONGOOSE.*Warning|Duplicate.*index|slow query" $LOG_DIR/server.log -c 2>/dev/null || echo "0")
if [ "$DB_WARNINGS" -gt 0 ]; then
    echo "  ⚠️  Database warnings: $DB_WARNINGS"
    rg "Duplicate.*index" $LOG_DIR/server.log --no-filename 2>/dev/null | head -1 | sed 's/^/    - /'
else
    echo "  ✅ No database issues detected"
fi

# Memory & AI Usage
echo -e "\n🤖 AI & MEMORY SYSTEM:"
MEMORY_OPS=$(rg "Memory saved|Pattern saved" $LOG_DIR/server.log -c 2>/dev/null || echo "0")
TOKENS=$(rg '"tokens": (\d+)' $LOG_DIR/server.log -o -r '$1' 2>/dev/null | awk '{sum+=$1} END {print sum}')
echo "  • Memory operations: $MEMORY_OPS"
echo "  • Total tokens used: ${TOKENS:-0}"
LATEST_COST=$(rg "costDisplay.*₪" $LOG_DIR/server.log 2>/dev/null | tail -1 | rg "₪[\d.]+" -o || echo "₪0")
echo "  • Latest cost: $LATEST_COST"

# Active Sessions
echo -e "\n👥 USER ACTIVITY:"
SESSIONS=$(rg "session_[a-z]+_\d+" $LOG_DIR/server.log -o 2>/dev/null | sort -u | wc -l)
echo "  • Active sessions: $SESSIONS"
USERS=$(rg "User fetched: (\S+)" $LOG_DIR/server.log -o -r '$1' 2>/dev/null | sort -u | wc -l)
echo "  • Unique users: $USERS"

# Summary
echo -e "\n📋 HEALTH SUMMARY"
echo "=================="
CRITICAL=0
WARNINGS=0

if [ "$ERROR_COUNT" -gt 10 ]; then
    echo "  🔴 CRITICAL: High error rate ($ERROR_COUNT errors)"
    CRITICAL=$((CRITICAL + 1))
elif [ "$ERROR_COUNT" -gt 0 ]; then
    echo "  🟡 WARNING: Some errors detected ($ERROR_COUNT)"
    WARNINGS=$((WARNINGS + 1))
fi

if [ "$SERVICE_ERRORS" -gt 0 ]; then
    echo "  🟡 WARNING: Service loading issues"
    WARNINGS=$((WARNINGS + 1))
fi

if [ "$DB_WARNINGS" -gt 0 ]; then
    echo "  🟡 WARNING: Database configuration issues"
    WARNINGS=$((WARNINGS + 1))
fi

if [ "$TOTAL_CACHE" -gt 0 ] && [ "$HIT_RATE" -lt 50 ]; then
    echo "  🟡 WARNING: Poor cache performance"
    WARNINGS=$((WARNINGS + 1))
fi

if [ "$CRITICAL" -eq 0 ] && [ "$WARNINGS" -eq 0 ]; then
    echo "  ✅ HEALTHY: All systems operational"
else
    echo -e "\n  Total: $CRITICAL critical, $WARNINGS warnings"
fi

echo -e "\n🕒 Report generated: $(date '+%Y-%m-%d %H:%M:%S')"
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"