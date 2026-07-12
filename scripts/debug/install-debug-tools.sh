#!/bin/bash

echo "🔧 Installing Essential Debugging Tools for IntelliCare Development"
echo "=================================================================="

# System Monitoring Tools
echo -e "\n📊 Installing System Monitoring Tools..."
sudo apt update
sudo apt install -y htop iotop iftop dstat sysstat
sudo apt install -y ncdu tree bat fd-find ripgrep

# Log Analysis Tools
echo -e "\n📝 Installing Log Analysis Tools..."
sudo apt install -y lnav multitail grc
npm install -g bunyan pino-pretty

# Network Debugging Tools
echo -e "\n🌐 Installing Network Debugging Tools..."
sudo apt install -y netcat-openbsd tcpdump nmap curl httpie jq
sudo apt install -y net-tools iproute2

# Process Management
echo -e "\n⚙️ Installing Process Management Tools..."
sudo apt install -y lsof strace ltrace

# Node.js Debugging Tools
echo -e "\n🟢 Installing Node.js Debugging Tools..."
npm install -g node-inspector clinic nodemon pm2
npm install -g why-is-node-running
npm install -g 0x # flame graphs
npm install -g autocannon # load testing

# MongoDB Tools
echo -e "\n🍃 Installing MongoDB Analysis Tools..."
npm install -g @mongosh/cli
pip3 install mongotail mtools

# Code Quality & Analysis
echo -e "\n✨ Installing Code Quality Tools..."
npm install -g eslint prettier npm-check-updates
npm install -g depcheck madge # dependency analysis

# Performance Profiling
echo -e "\n🚀 Installing Performance Tools..."
sudo apt install -y linux-tools-common linux-tools-generic
npm install -g lighthouse chrome-launcher

# Redis Tools
echo -e "\n🔴 Installing Redis Tools..."
sudo apt install -y redis-tools

# Docker Tools (if using containers)
echo -e "\n🐳 Installing Docker Tools..."
sudo apt install -y docker-compose ctop

# Create helper aliases
echo -e "\n📌 Creating debugging aliases..."
cat >> ~/.bashrc << 'EOF'

# IntelliCare Debugging Aliases
alias ic-logs='tail -f /home/erangross/Development/IntelliCare/apps/backend-api/logs/*.log'
alias ic-errors='tail -f /home/erangross/Development/IntelliCare/apps/backend-api/logs/server-errors.log'
alias ic-mongo='mongosh mongodb://intellicare_app:<DB_PASSWORD>@localhost:27017/intellicare_practice_global?authSource=admin'
alias ic-ports='sudo lsof -i -P -n | grep LISTEN'
alias ic-node='ps aux | grep node'
alias ic-memory='ps aux --sort=-%mem | head -20'
alias ic-cpu='ps aux --sort=-%cpu | head -20'
alias ic-connections='ss -tunap | grep :5000'
alias ic-watch-logs='lnav /home/erangross/Development/IntelliCare/apps/backend-api/logs/'
alias ic-trace='strace -p $(pgrep -f "node.*backend")'

# Colored logs
alias logs='grc tail -f'
alias netstat='grc netstat'
alias ps='grc ps'

EOF

echo -e "\n✅ Installation complete! Run 'source ~/.bashrc' to activate aliases"
echo -e "\n📚 Quick Reference:"
echo "  - htop: Interactive process viewer"
echo "  - iotop: I/O usage by process"
echo "  - iftop: Network bandwidth monitoring"
echo "  - lnav: Advanced log file viewer with search/filter"
echo "  - clinic: Node.js performance profiling"
echo "  - 0x: Generate flame graphs for Node.js"
echo "  - madge: Visualize module dependencies"
echo "  - ic-*: IntelliCare specific shortcuts"