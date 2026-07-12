#!/bin/bash

# IntelliCare Auto-Start Script
# This script starts backend, frontend, and Claude for the IntelliCare project

echo "🚀 Starting IntelliCare Development Environment..."
echo "=========================================="

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Change to project directory
cd /home/erangross/Development/IntelliCare

# Function to open a new terminal tab and run a command
open_tab() {
    local title="$1"
    local command="$2"

    # Using gnome-terminal (adjust if using different terminal)
    gnome-terminal --tab --title="$title" -- bash -c "$command; exec bash"
}

# Start Backend
echo -e "${GREEN}✓ Starting Backend Server on port 5000...${NC}"
gnome-terminal --tab --title="IntelliCare Backend" -- bash -c "cd /home/erangross/Development/IntelliCare/apps/backend-api && echo '🔧 Backend Server Starting...' && npm run dev; exec bash" &

sleep 2

# Start Frontend
echo -e "${BLUE}✓ Starting Frontend Server on port 3000...${NC}"
gnome-terminal --tab --title="IntelliCare Frontend" -- bash -c "cd /home/erangross/Development/IntelliCare/apps/frontend-vite && echo '⚛️ Frontend Server Starting...' && npm run dev; exec bash" &

sleep 2

# Start Claude
echo -e "${YELLOW}✓ Starting Claude CLI...${NC}"
gnome-terminal --tab --title="Claude Assistant" -- bash -c "cd /home/erangross/Development/IntelliCare && claude; exec bash" &

echo ""
echo "=========================================="
echo "✅ IntelliCare Development Environment Started!"
echo ""
echo "📍 Backend:  http://localhost:5000"
echo "📍 Frontend: http://localhost:3000"
echo "📍 Claude:   Ready for assistance"
echo "=========================================="
echo ""
echo "Press any key to continue..."
read -n 1

# Keep this terminal open as the main control terminal
cd /home/erangross/Development/IntelliCare
exec bash