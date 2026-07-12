#!/bin/bash

# Setup script for wildcard DNS resolution for IntelliCare development
# This allows *.intellicare.health to resolve to localhost

echo "🌐 Setting up wildcard DNS for IntelliCare development..."

# Check if running with sudo
if [ "$EUID" -ne 0 ]; then
   echo "❌ Please run this script with sudo: sudo bash setup-wildcard-dns.sh"
   exit 1
fi

echo "📦 Installing dnsmasq..."
apt-get update
apt-get install -y dnsmasq

# Stop dnsmasq temporarily
systemctl stop dnsmasq

echo "🔧 Configuring dnsmasq for wildcard domains..."

# Create dnsmasq configuration for IntelliCare
cat > /etc/dnsmasq.d/intellicare.conf << 'EOF'
# Wildcard DNS for IntelliCare development
# This makes all *.intellicare.health domains resolve to localhost

# Listen on localhost only
listen-address=127.0.0.1

# Don't read /etc/hosts
no-hosts

# Don't read /etc/resolv.conf
no-resolv

# Upstream DNS servers (Google DNS as fallback)
server=8.8.8.8
server=8.8.4.4

# Wildcard domain for intellicare.health and all subdomains
address=/intellicare.health/127.0.0.1

# Also support .local version for testing
address=/intellicare.local/127.0.0.1

# Log DNS queries (optional, comment out in production)
log-queries

# Cache size
cache-size=1000
EOF

echo "🔄 Configuring systemd-resolved to work with dnsmasq..."

# Check if systemd-resolved is running
if systemctl is-active --quiet systemd-resolved; then
    echo "📝 Configuring systemd-resolved..."

    # Create a configuration to forward intellicare domains to dnsmasq
    mkdir -p /etc/systemd/resolved.conf.d/
    cat > /etc/systemd/resolved.conf.d/intellicare.conf << 'EOF'
[Resolve]
DNS=127.0.0.1
Domains=~intellicare.health ~intellicare.local
EOF

    # Restart systemd-resolved
    systemctl restart systemd-resolved

    # Disable systemd-resolved's stub listener to free port 53
    sed -i 's/#DNSStubListener=yes/DNSStubListener=no/' /etc/systemd/resolved.conf

    # Create symlink for resolv.conf
    rm -f /etc/resolv.conf
    ln -s /run/systemd/resolve/resolv.conf /etc/resolv.conf
else
    echo "⚠️ systemd-resolved not running, configuring NetworkManager..."

    # Configure NetworkManager to use dnsmasq
    if [ -f /etc/NetworkManager/NetworkManager.conf ]; then
        # Add dns=dnsmasq to NetworkManager
        if ! grep -q "dns=dnsmasq" /etc/NetworkManager/NetworkManager.conf; then
            sed -i '/\[main\]/a dns=dnsmasq' /etc/NetworkManager/NetworkManager.conf
        fi

        # Create NetworkManager dnsmasq configuration
        cat > /etc/NetworkManager/dnsmasq.d/intellicare.conf << 'EOF'
address=/intellicare.health/127.0.0.1
address=/intellicare.local/127.0.0.1
EOF

        # Restart NetworkManager
        systemctl restart NetworkManager
    fi
fi

echo "🚀 Starting dnsmasq..."
systemctl start dnsmasq
systemctl enable dnsmasq

echo "✅ Testing DNS resolution..."
sleep 2

# Test resolution
if host stanford.intellicare.health 127.0.0.1 &>/dev/null; then
    echo "✅ Wildcard DNS is working! stanford.intellicare.health resolves to localhost"
else
    echo "⚠️ DNS resolution test failed. Checking dnsmasq status..."
    systemctl status dnsmasq --no-pager
fi

echo ""
echo "🎉 Setup complete!"
echo ""
echo "You can now access IntelliCare with any subdomain:"
echo "  - http://stanford.intellicare.health:3000"
echo "  - http://yale.intellicare.health:3000"
echo "  - http://boston.intellicare.health:3000"
echo "  - http://anypractice.intellicare.health:3000"
echo ""
echo "All subdomains will resolve to localhost (127.0.0.1)"
echo ""
echo "To test: dig stanford.intellicare.health"
echo "To check logs: sudo journalctl -u dnsmasq -f"