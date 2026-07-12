#!/bin/bash

echo "=== Installing Final Set of Debug Tools ==="

# System tools via apt
echo "Installing system tools..."
sudo apt-get update
sudo apt-get install -y \
    apache2-utils \
    siege \
    wrk \
    mongodb-database-tools \
    jq \
    tree \
    multitail \
    grc \
    tcpdump \
    nmap \
    httpie \
    dstat

# Node.js tools
echo "Installing Node.js debugging tools..."
npm install -g \
    pm2 \
    nodemon \
    webpack-bundle-analyzer \
    source-map-explorer \
    why-is-node-running \
    node-inspect

echo "=== Installation Complete ==="
echo "New tools available:"
echo "- ab (Apache Bench) - Simple load testing"
echo "- siege - Advanced load testing"
echo "- wrk - Modern HTTP benchmarking"
echo "- mongotop/mongostat - MongoDB monitoring"
echo "- jq - JSON processor"
echo "- tree - Directory tree viewer"
echo "- multitail - Monitor multiple logs"
echo "- grc - Colorize log output"
echo "- tcpdump - Network packet analysis"
echo "- nmap - Network discovery"
echo "- httpie - User-friendly HTTP client"
echo "- dstat - System resource stats"
echo "- pm2 - Production process manager"
echo "- nodemon - Auto-restart on changes"
echo "- webpack-bundle-analyzer - Bundle size analysis"
echo "- source-map-explorer - Visualize bundle content"
echo "- why-is-node-running - Find hanging processes"
echo "- node-inspect - Node.js debugger"