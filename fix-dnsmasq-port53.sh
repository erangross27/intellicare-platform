#!/bin/bash

echo "🔧 Fixing port 53 conflict between systemd-resolved and dnsmasq..."

# Check if running with sudo
if [ "$EUID" -ne 0 ]; then
   echo "❌ Please run this script with sudo: sudo bash fix-dnsmasq-port53.sh"
   exit 1
fi

echo "📝 Stopping dnsmasq temporarily..."
systemctl stop dnsmasq 2>/dev/null

echo "🔄 Configuring systemd-resolved to free up port 53..."

# Disable the stub listener to free port 53
mkdir -p /etc/systemd/resolved.conf.d/

cat > /etc/systemd/resolved.conf.d/intellicare.conf << 'EOF'
[Resolve]
DNS=127.0.0.1
DNSStubListener=no
Domains=~intellicare.health ~intellicare.local
EOF

echo "📝 Updating main resolved.conf to disable stub listener..."
if [ -f /etc/systemd/resolved.conf ]; then
    # Check if DNSStubListener line exists
    if grep -q "^#*DNSStubListener=" /etc/systemd/resolved.conf; then
        # Replace the line (whether commented or not)
        sed -i 's/^#*DNSStubListener=.*/DNSStubListener=no/' /etc/systemd/resolved.conf
    else
        # Add the line if it doesn't exist
        echo "DNSStubListener=no" >> /etc/systemd/resolved.conf
    fi
fi

echo "🔄 Restarting systemd-resolved..."
systemctl restart systemd-resolved

# Wait a moment for systemd-resolved to restart
sleep 2

echo "📝 Updating /etc/resolv.conf symlink..."
rm -f /etc/resolv.conf
ln -sf /run/systemd/resolve/resolv.conf /etc/resolv.conf

echo "✅ Checking what's using port 53..."
lsof -i :53 2>/dev/null || netstat -tulpn | grep :53

echo "🚀 Starting dnsmasq..."
systemctl start dnsmasq

# Check if dnsmasq started successfully
if systemctl is-active --quiet dnsmasq; then
    echo "✅ dnsmasq started successfully!"

    echo ""
    echo "🧪 Testing DNS resolution..."
    sleep 2

    # Test resolution
    if host stanford.intellicare.health 127.0.0.1 &>/dev/null; then
        echo "✅ Wildcard DNS is working! stanford.intellicare.health resolves to localhost"

        # Also test with dig
        echo ""
        echo "📊 Detailed test with dig:"
        dig +short stanford.intellicare.health @127.0.0.1
    else
        echo "⚠️ DNS resolution test failed. Checking dnsmasq logs..."
        journalctl -u dnsmasq --no-pager -n 10
    fi
else
    echo "❌ dnsmasq failed to start. Checking status..."
    systemctl status dnsmasq --no-pager
    echo ""
    echo "📝 Recent logs:"
    journalctl -u dnsmasq --no-pager -n 20
fi

echo ""
echo "🎉 Configuration complete!"
echo ""
echo "You should now be able to access:"
echo "  - http://stanford.intellicare.health:3000"
echo "  - http://yale.intellicare.health:3000"
echo "  - http://boston.intellicare.health:3000"
echo "  - Any subdomain: http://anypractice.intellicare.health:3000"