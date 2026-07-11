#!/bin/bash

# Add IntelliCare domains to /etc/hosts for local development

echo "🔧 Setting up IntelliCare domain resolution..."
echo ""
echo "This will add the following entries to /etc/hosts:"
echo "  127.0.0.1 intellicare.health"
echo "  127.0.0.1 stanford.intellicare.health"
echo "  127.0.0.1 www.intellicare.health"
echo ""

# Check if entries already exist
if grep -q "intellicare.health" /etc/hosts; then
    echo "⚠️  IntelliCare entries already exist in /etc/hosts"
    echo "To remove them, edit /etc/hosts and delete the IntelliCare section"
else
    # Add entries to /etc/hosts
    echo "" | sudo tee -a /etc/hosts > /dev/null
    echo "# IntelliCare local development" | sudo tee -a /etc/hosts > /dev/null
    echo "127.0.0.1 intellicare.health" | sudo tee -a /etc/hosts > /dev/null
    echo "127.0.0.1 stanford.intellicare.health" | sudo tee -a /etc/hosts > /dev/null
    echo "127.0.0.1 www.intellicare.health" | sudo tee -a /etc/hosts > /dev/null
    echo "# Add more subdomains as needed:" | sudo tee -a /etc/hosts > /dev/null
    echo "# 127.0.0.1 [practice-name].intellicare.health" | sudo tee -a /etc/hosts > /dev/null
    echo "" | sudo tee -a /etc/hosts > /dev/null

    echo "✅ Entries added to /etc/hosts successfully!"
fi

echo ""
echo "Testing domain resolution..."
echo "----------------------------"
ping -c 1 intellicare.health | head -n 2
echo ""
ping -c 1 stanford.intellicare.health | head -n 2

echo ""
echo "----------------------------"
echo "✅ Setup complete! You can now access:"
echo "   • http://intellicare.health:3000 (frontend)"
echo "   • http://intellicare.health:5000 (backend)"
echo "   • http://stanford.intellicare.health:3000 (practice subdomain)"
echo ""
echo "Note: For additional subdomains, add them to /etc/hosts following the same pattern."