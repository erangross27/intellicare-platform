#!/bin/bash

echo "🔧 Installing Additional Free Debugging Tools"
echo "============================================"

# Memory profiling for Node.js
echo -e "\n💾 Installing Node.js Memory Tools..."
npm install -g heapdump
npm install -g node-memwatch
npm install -g v8-profiler-next

# HTTP debugging
echo -e "\n🌐 Installing HTTP Tools..."
npm install -g whistle
npm install -g http-server
npm install -g json-server

# Log parsing and monitoring
echo -e "\n📋 Installing Log Tools..."
sudo apt install -y ccze  # Colorize logs
sudo apt install -y logwatch
npm install -g bunyan-cli
npm install -g log4js

# Process monitoring
echo -e "\n⚡ Installing Process Tools..."
sudo apt install -y atop
sudo apt install -y glances
npm install -g forever
npm install -g supervisor

# Database tools
echo -e "\n🗄️ Installing Database Tools..."
pip3 install mycli  # MySQL CLI with autocomplete
pip3 install pgcli  # PostgreSQL CLI with autocomplete
npm install -g mongo-hacker  # MongoDB shell enhancements

# Network analysis
echo -e "\n🔌 Installing Network Analysis..."
sudo apt install -y iperf3
sudo apt install -y mtr
sudo apt install -y traceroute
sudo apt install -y whois
sudo apt install -y dnsutils

# Code analysis
echo -e "\n🔍 Installing Code Analysis..."
npm install -g jscpd  # Duplicate code detector
npm install -g plato  # Code complexity reports
npm install -g dependency-cruiser
npm install -g webpack-bundle-analyzer

# Docker tools (if Docker is installed)
if command -v docker &> /dev/null; then
    echo -e "\n🐳 Installing Docker Tools..."
    sudo apt install -y ctop
    wget https://github.com/wagoodman/dive/releases/download/v0.11.0/dive_0.11.0_linux_amd64.deb
    sudo dpkg -i dive_0.11.0_linux_amd64.deb
    rm dive_0.11.0_linux_amd64.deb
    npm install -g dockerfile-language-server-nodejs
fi

# Performance tools
echo -e "\n📊 Installing Performance Tools..."
sudo apt install -y sysbench
sudo apt install -y stress-ng
npm install -g loadtest
npm install -g artillery

# File watchers
echo -e "\n👁️ Installing File Watchers..."
sudo apt install -y inotify-tools
npm install -g nodemon
npm install -g chokidar-cli
npm install -g onchange

# JSON/YAML tools
echo -e "\n📄 Installing Data Format Tools..."
sudo apt install -y yamllint
npm install -g js-yaml
npm install -g prettier
npm install -g jsonlint

# Security scanning
echo -e "\n🔐 Installing Security Tools..."
npm install -g snyk
npm install -g npm-audit-resolver
npm install -g better-npm-audit

# Create extended aliases
echo -e "\n📌 Adding more debugging aliases..."
cat >> ~/.bashrc << 'EOF'

# Extended IntelliCare Debugging
alias logs-color='ccze -A < '
alias logs-json='bunyan'
alias mongo-pretty='mongo --quiet --eval "DBQuery.prototype._prettyShell = true"'
alias http-serve='http-server -c-1 -o'
alias watch-file='inotifywait -m'
alias json-pretty='python3 -m json.tool'
alias yaml-validate='yamllint'
alias npm-security='better-npm-audit audit'
alias code-complexity='plato -r -d report'
alias find-duplicates='jscpd'
alias deps-graph='dependency-cruiser --output-type dot . | dot -T svg > deps.svg'
alias load-test='loadtest -n 1000 -c 10'
alias stress-cpu='stress-ng --cpu 4 --timeout 60s'
alias docker-size='docker images --format "table {{.Repository}}\t{{.Tag}}\t{{.Size}}" | sort -k3 -h'

# Functions for advanced debugging
function watch-logs() {
    multitail -cT ansi -i "$1" -i "$2"
}

function json-query() {
    cat "$1" | jq "$2"
}

function monitor-all() {
    glances
}

function trace-route() {
    mtr -r "$1"
}

function analyze-bundle() {
    webpack-bundle-analyzer stats.json
}

EOF

echo -e "\n✅ Additional tools installed! Run 'source ~/.bashrc' to activate"
echo -e "\n🚀 New capabilities:"
echo "  - Memory profiling: heapdump, node-memwatch"
echo "  - HTTP debugging: whistle (proxy), http-server"
echo "  - Advanced monitoring: glances, atop"
echo "  - Code analysis: jscpd (duplicates), plato (complexity)"
echo "  - Security scanning: snyk, better-npm-audit"
echo "  - Load testing: artillery, loadtest"