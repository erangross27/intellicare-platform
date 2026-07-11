# Starting Redis (Memurai) for IntelliCare

## Quick Start Options

### Option 1: Manual Start (Immediate)
Double-click: `START_MEMURAI.bat`
- Starts Memurai immediately
- Shows connection status
- Good for development

### Option 2: Auto-Start Setup (Permanent)
Right-click `Setup-Memurai-AutoStart.ps1` → Run as Administrator
- Sets up Windows Task Scheduler
- Memurai starts automatically with Windows
- Survives reboots
- Runs as background service

## Why Not a Windows Service?

Memurai Developer Edition doesn't support Windows service installation. The checkbox is disabled because:
- Developer Edition limitation
- Service feature requires Pro/Enterprise license

## Our Workaround

We use Windows Task Scheduler instead:
- Same effect as a service
- Starts automatically
- Runs in background
- Restarts on failure
- No license restrictions

## Verify Redis is Running

```bash
# From backend-api directory
node test-redis.js

# Or use Memurai CLI
"C:\Program Files\Memurai\memurai-cli.exe" ping
```

## Connection Details

- **Host**: localhost
- **Port**: 6379
- **URL**: redis://localhost:6379

## Troubleshooting

### Port 6379 Already in Use
```bash
# Find what's using port 6379
netstat -ano | findstr :6379

# Kill the process
taskkill /PID [process_id] /F
```

### Task Scheduler Commands
```powershell
# Check status
Get-ScheduledTask -TaskName "Memurai-Redis-Server"

# Stop
Stop-ScheduledTask -TaskName "Memurai-Redis-Server"

# Start
Start-ScheduledTask -TaskName "Memurai-Redis-Server"

# Remove (if needed)
Unregister-ScheduledTask -TaskName "Memurai-Redis-Server"
```