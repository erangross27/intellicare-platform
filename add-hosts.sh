#!/bin/bash
# Check if entries already exist
if grep -q "intellicare.health" /etc/hosts; then
    echo "IntelliCare entries already exist in /etc/hosts"
else
    echo "Mk!p300Mk!p300" | sudo -S bash -c 'echo "" >> /etc/hosts && echo "# IntelliCare local development" >> /etc/hosts && echo "127.0.0.1 intellicare.health" >> /etc/hosts && echo "127.0.0.1 stanford.intellicare.health" >> /etc/hosts && echo "127.0.0.1 www.intellicare.health" >> /etc/hosts'
    echo "✅ IntelliCare domains added to /etc/hosts"
fi

# Test resolution
echo "Testing domain resolution..."
ping -c 1 intellicare.health 2>/dev/null | head -n 1