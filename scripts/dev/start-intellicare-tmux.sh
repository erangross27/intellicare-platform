#!/bin/bash

# IntelliCare Auto-Start Script with tmux
# This script starts backend, frontend, and Claude in a tmux session

SESSION="intellicare"

# Check if tmux is installed
if ! command -v tmux &> /dev/null; then
    echo "tmux is not installed. Please install it first: sudo apt install tmux"
    exit 1
fi

# Kill existing session if it exists
tmux has-session -t $SESSION 2>/dev/null
if [ $? == 0 ]; then
    echo "Killing existing IntelliCare session..."
    tmux kill-session -t $SESSION
fi

echo "🚀 Starting IntelliCare Development Environment with tmux..."
echo "=========================================="

# Create new tmux session
tmux new-session -d -s $SESSION -n backend

# Backend window
tmux send-keys -t $SESSION:backend "cd /home/erangross/Development/IntelliCare/apps/backend-api" C-m
tmux send-keys -t $SESSION:backend "echo '🔧 Backend Server Starting on port 5000...'" C-m
tmux send-keys -t $SESSION:backend "npm run dev" C-m

# Frontend window
tmux new-window -t $SESSION -n frontend
tmux send-keys -t $SESSION:frontend "cd /home/erangross/Development/IntelliCare/apps/frontend-vite" C-m
tmux send-keys -t $SESSION:frontend "echo '⚛️ Frontend Server Starting on port 3000...'" C-m
tmux send-keys -t $SESSION:frontend "npm run dev" C-m

# Claude window
tmux new-window -t $SESSION -n claude
tmux send-keys -t $SESSION:claude "cd /home/erangross/Development/IntelliCare" C-m
tmux send-keys -t $SESSION:claude "claude" C-m

# Main control window
tmux new-window -t $SESSION -n main
tmux send-keys -t $SESSION:main "cd /home/erangross/Development/IntelliCare" C-m
tmux send-keys -t $SESSION:main "clear" C-m
tmux send-keys -t $SESSION:main "echo '=========================================='" C-m
tmux send-keys -t $SESSION:main "echo '✅ IntelliCare Development Environment Started!'" C-m
tmux send-keys -t $SESSION:main "echo ''" C-m
tmux send-keys -t $SESSION:main "echo '📍 Backend:  http://localhost:5000 (window 0)'" C-m
tmux send-keys -t $SESSION:main "echo '📍 Frontend: http://localhost:3000 (window 1)'" C-m
tmux send-keys -t $SESSION:main "echo '📍 Claude:   Ready (window 2)'" C-m
tmux send-keys -t $SESSION:main "echo ''" C-m
tmux send-keys -t $SESSION:main "echo 'Shortcuts:'" C-m
tmux send-keys -t $SESSION:main "echo '  Ctrl+B then 0-3: Switch between windows'" C-m
tmux send-keys -t $SESSION:main "echo '  Ctrl+B then d:   Detach from session'" C-m
tmux send-keys -t $SESSION:main "echo '  Ctrl+B then [:   Scroll mode (q to exit)'" C-m
tmux send-keys -t $SESSION:main "echo '=========================================='" C-m

# Select the main window
tmux select-window -t $SESSION:main

# Attach to the session
tmux attach-session -t $SESSION