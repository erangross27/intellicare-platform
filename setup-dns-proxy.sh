#!/bin/bash

# Setup DNS proxy for IntelliCare development
# This script configures dnsmasq and NetworkManager to resolve intellicare.health to 127.0.0.1

echo "🔧 Setting up DNS proxy for IntelliCare..."
echo ""
echo "This script will:"
echo "1. Configure dnsmasq to resolve intellicare.health domains to 127.0.0.1"
echo "2. Set your system to use 127.0.0.1 as the primary DNS server"
echo "3. Ensure the configuration persists across reboots"
echo ""
echo "You'll need to enter your sudo password to continue."
echo ""

# Copy dnsmasq config to system directory
sudo cp intellicare-dns.conf /etc/dnsmasq.d/intellicare.conf

# Disable systemd-resolved if it's running (conflicts with dnsmasq on port 53)
echo "📍 Configuring DNS services..."
sudo systemctl stop systemd-resolved 2>/dev/null
sudo systemctl disable systemd-resolved 2>/dev/null

# Create a backup of resolv.conf
sudo cp /etc/resolv.conf /etc/resolv.conf.backup.$(date +%Y%m%d)

# Set up NetworkManager to use dnsmasq
echo "📡 Configuring NetworkManager..."
sudo tee /etc/NetworkManager/conf.d/dns.conf > /dev/null << 'EOF'
[main]
dns=dnsmasq
EOF

# Configure dnsmasq for NetworkManager
sudo tee /etc/NetworkManager/dnsmasq.d/intellicare.conf > /dev/null << 'EOF'
# IntelliCare local development
address=/intellicare.health/127.0.0.1
address=/.intellicare.health/127.0.0.1
EOF

# Restart NetworkManager and dnsmasq
echo "🔄 Restarting services..."
sudo systemctl restart NetworkManager
sudo systemctl enable dnsmasq
sudo systemctl restart dnsmasq

# Update resolv.conf to use local DNS
echo "nameserver 127.0.0.1" | sudo tee /etc/resolv.conf > /dev/null
echo "nameserver 8.8.8.8" | sudo tee -a /etc/resolv.conf > /dev/null

# Make resolv.conf immutable so NetworkManager doesn't overwrite it
sudo chattr +i /etc/resolv.conf

echo ""
echo "✅ DNS proxy setup complete!"
echo ""
echo "Testing DNS resolution..."
echo "----------------------------"

# Test the setup
nslookup intellicare.health 127.0.0.1
echo ""
nslookup stanford.intellicare.health 127.0.0.1

echo ""
echo "----------------------------"
echo "✅ Setup complete! You can now access:"
echo "   • http://intellicare.health:3000 (frontend)"
echo "   • http://intellicare.health:5000 (backend)"
echo "   • http://stanford.intellicare.health:3000 (practice subdomain)"
echo ""
echo "To undo these changes later, run:"
echo "   sudo chattr -i /etc/resolv.conf"
echo "   sudo systemctl enable systemd-resolved"
echo "   sudo systemctl start systemd-resolved"
echo ""