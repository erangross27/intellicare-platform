# IntelliCare Complete Debugging Toolkit

## 🍃 MongoDB MCP Tools (Already Integrated)
Direct database access without shell commands:
- `mcp__MongoDB-IntelliCare__find` - Query documents
- `mcp__MongoDB-IntelliCare__aggregate` - Complex queries
- `mcp__MongoDB-IntelliCare__count` - Count documents
- `mcp__MongoDB-IntelliCare__collection-schema` - Analyze schema
- `mcp__MongoDB-IntelliCare__collection-indexes` - Check indexes
- `mcp__MongoDB-IntelliCare__insert-many` - Insert documents
- `mcp__MongoDB-IntelliCare__update-many` - Update documents
- `mcp__MongoDB-IntelliCare__delete-many` - Delete documents

## 📊 System Monitoring (Installed)
- **htop** - Interactive process viewer
- **iotop** - I/O usage by process
- **iftop** - Network bandwidth monitoring
- **dstat** - System resource statistics
- **ncdu** - Disk usage analyzer

## 📝 Log Analysis (Installed)
- **lnav** - SQL queries on logs, auto-parsing
- **multitail** - Monitor multiple logs
- **grc** - Colorized log output
- **bunyan** - JSON log pretty-printer
- **pino-pretty** - Pino log formatter

## 🟢 Node.js Debugging (Installed)
- **clinic** - Performance profiling suite
- **0x** - Flame graph generation
- **madge** - Dependency/circular ref analysis
- **depcheck** - Find unused dependencies
- **why-is-node-running** - Find hanging processes
- **autocannon** - Load testing
- **pm2** - Process management

## 🌐 Network Tools (Installed)
- **tcpdump** - Packet capture
- **nmap** - Port scanning
- **httpie** - HTTP client
- **netstat/ss** - Connection monitoring
- **curl** - API testing

## 🔍 Fast Search (Installed)
- **ripgrep (rg)** - 10x faster than grep
- **fd** - Fast file finder
- **bat** - Syntax-highlighted cat
- **tree** - Directory visualization

## 🚀 Custom IntelliCare Aliases
```bash
ic-logs          # Tail all logs
ic-errors        # Watch error logs
ic-mongo         # Connect to MongoDB
ic-ports         # Check listening ports
ic-node          # Show Node processes
ic-memory        # Top memory users
ic-cpu           # Top CPU users
ic-connections   # Active connections to port 5000
ic-watch-logs    # Interactive log viewer (lnav)
ic-trace         # Trace backend process
```

## 🔧 Debug Helper Functions
```bash
source debug-helpers.sh

ic-status                    # Check all services
whats-on-port 5000          # Find process on port
mongo-watch                 # Monitor MongoDB queries
node-heap-snapshot          # Trigger heap dump
api-monitor                 # Watch API health
check-deps                  # Analyze dependencies
redis-monitor               # Monitor Redis
profile-endpoint /api/path  # Load test endpoint
flame-graph                 # Generate performance graph
find-large-logs            # Find large log files
clear-logs                 # Safely truncate logs
```

## 💡 Debugging Workflow

### 1. Quick Health Check
```bash
ic-status  # See all services at once
```

### 2. Performance Issues
```bash
# CPU/Memory analysis
htop
ic-memory

# Node.js profiling
clinic doctor -- node apps/backend-api/server.js
flame-graph

# API load testing
profile-endpoint /api/agent/chat
```

### 3. Database Issues
Use MCP tools directly:
```javascript
// Check slow queries
mcp__MongoDB-IntelliCare__aggregate
pipeline: [
  { $currentOp: { allUsers: true } },
  { $match: { 'secs_running': { $gt: 1 } } }
]

// Analyze collection
mcp__MongoDB-IntelliCare__collection-schema
mcp__MongoDB-IntelliCare__collection-indexes
```

### 4. Log Investigation
```bash
# Interactive log search with SQL
lnav /home/erangross/Development/IntelliCare/apps/backend-api/logs/

# In lnav:
# :filter-in error
# :filter-out "GET /api/health"
# SELECT * FROM logs WHERE log_level = 'ERROR'
```

### 5. Dependency Analysis
```bash
cd apps/backend-api
check-deps  # Find unused/circular dependencies
madge --circular .
madge --image deps.svg .  # Visualize dependencies
```

### 6. Network Debugging
```bash
# Monitor API traffic
sudo tcpdump -i lo port 5000 -A

# Check connections
ss -tunap | grep :5000
netstat -tulpn | grep LISTEN
```

## 🎯 Common Debugging Scenarios

### High Memory Usage
1. `ic-memory` - Identify process
2. `node-heap-snapshot` - Capture heap
3. `clinic heap` - Analyze memory

### Slow API Response
1. `profile-endpoint /api/path` - Load test
2. `clinic bubbleprof` - Find bottlenecks
3. Check MongoDB: `mcp__MongoDB-IntelliCare__explain`

### Database Performance
1. `mcp__MongoDB-IntelliCare__collection-indexes` - Check indexes
2. `mcp__MongoDB-IntelliCare__explain` - Query analysis
3. `mongo-watch` - Real-time monitoring

### Hanging Requests
1. `why-is-node-running` - Find blockers
2. `ic-trace` - System call trace
3. `lnav` - Check for timeouts

## 📌 Quick Reference
- MongoDB MCP: Direct DB access, no shell needed
- Logs: `lnav` for powerful search/filter
- Performance: `clinic` suite for Node.js
- Search: `rg` for blazing fast code search
- Monitor: `htop`, `iotop`, `iftop` trinity