#!/bin/bash

# IntelliCare DNS Configuration for Ubuntu
# Handles local development with intellicare.health domain
# Replaces Windows Acrylic DNS functionality

set -e

echo "================================================"
echo "IntelliCare DNS Configuration for Ubuntu"
echo "================================================"

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo "This script must be run as root (use sudo)"
   exit 1
fi

echo "Choose DNS solution:"
echo "1. systemd-resolved (Recommended - Built into Ubuntu)"
echo "2. dnsmasq (More features, like Acrylic)"
echo "3. bind9 (Full DNS server - most powerful)"
echo "4. Simple /etc/hosts (Basic, no wildcard support)"
read -p "Enter choice (1-4): " DNS_CHOICE

case $DNS_CHOICE in
    1)
        echo -e "\n=== Setting up systemd-resolved (Recommended) ==="

        # Enable systemd-resolved if not already
        systemctl enable systemd-resolved
        systemctl start systemd-resolved

        # Create custom configuration for intellicare.health
        cat > /etc/systemd/resolved.conf.d/intellicare.conf <<EOF
# IntelliCare DNS Configuration
[Resolve]
DNS=127.0.0.1 8.8.8.8 8.8.4.4
Domains=~intellicare.health
DNSStubListener=yes
Cache=yes
DNSOverTLS=no
EOF

        # Create NetworkManager configuration to resolve *.intellicare.health
        mkdir -p /etc/NetworkManager/dnsmasq.d/
        cat > /etc/NetworkManager/dnsmasq.d/intellicare.conf <<EOF
# IntelliCare local development
address=/intellicare.health/127.0.0.1
address=/.intellicare.health/127.0.0.1
EOF

        # Update /etc/hosts for specific entries
        cat >> /etc/hosts <<EOF

# IntelliCare Development
127.0.0.1    intellicare.health
127.0.0.1    www.intellicare.health
127.0.0.1    api.intellicare.health
127.0.0.1    stanford.intellicare.health
# Add more practice subdomains as needed
EOF

        # Restart services
        systemctl restart systemd-resolved
        systemctl restart NetworkManager

        echo "✅ systemd-resolved configured!"
        echo "Test with: nslookup intellicare.health"
        ;;

    2)
        echo -e "\n=== Setting up dnsmasq (Like Acrylic) ==="

        # Install dnsmasq
        apt update
        apt install -y dnsmasq

        # Disable systemd-resolved to avoid conflicts
        systemctl disable systemd-resolved
        systemctl stop systemd-resolved

        # Remove symlink and create new resolv.conf
        rm -f /etc/resolv.conf
        cat > /etc/resolv.conf <<EOF
nameserver 127.0.0.1
nameserver 8.8.8.8
nameserver 8.8.4.4
EOF

        # Configure dnsmasq for IntelliCare
        cat > /etc/dnsmasq.d/intellicare.conf <<EOF
# IntelliCare DNS Configuration
# Listen on localhost
listen-address=127.0.0.1
bind-interfaces

# Upstream DNS servers
server=8.8.8.8
server=8.8.4.4

# IntelliCare domain resolution
# Wildcard for all subdomains
address=/intellicare.health/127.0.0.1

# Specific subdomain overrides if needed
address=/production.intellicare.health/YOUR_PRODUCTION_IP

# Cache settings (like Acrylic)
cache-size=10000
no-negcache

# Log queries (for debugging)
log-queries
log-facility=/var/log/dnsmasq.log

# Additional local domains
local=/intellicare.local/
domain=intellicare.local

# Enable DNSSEC validation
dnssec
trust-anchor=.,20326,8,2,E06D44B80B8F1D39A95C0B0D7C65D08458E880409BBC683457104237C7F8EC8D

# Performance tuning
dns-forward-max=150
min-cache-ttl=3600
EOF

        # Create log file
        touch /var/log/dnsmasq.log
        chown dnsmasq:nogroup /var/log/dnsmasq.log

        # Enable and restart dnsmasq
        systemctl enable dnsmasq
        systemctl restart dnsmasq

        echo "✅ dnsmasq configured with Acrylic-like features!"
        echo "Wildcard support: ✓"
        echo "Cache: ✓ (10000 entries)"
        echo "Query logging: ✓ (/var/log/dnsmasq.log)"
        echo ""
        echo "Test with: dig intellicare.health @127.0.0.1"
        echo "View cache stats: sudo killall -USR1 dnsmasq && tail /var/log/syslog"
        ;;

    3)
        echo -e "\n=== Setting up BIND9 (Full DNS Server) ==="

        # Install BIND9
        apt update
        apt install -y bind9 bind9-utils bind9-doc

        # Configure BIND9 for IntelliCare
        cat > /etc/bind/named.conf.local <<EOF
// IntelliCare local zone
zone "intellicare.health" {
    type master;
    file "/etc/bind/zones/db.intellicare.health";
};

// Reverse lookup zone
zone "1.0.0.127.in-addr.arpa" {
    type master;
    file "/etc/bind/zones/db.127.0.0.1";
};
EOF

        # Create zones directory
        mkdir -p /etc/bind/zones

        # Create forward zone file
        cat > /etc/bind/zones/db.intellicare.health <<EOF
\$TTL    604800
@       IN      SOA     intellicare.health. admin.intellicare.health. (
                              2         ; Serial
                         604800         ; Refresh
                          86400         ; Retry
                        2419200         ; Expire
                         604800 )       ; Negative Cache TTL
;
@       IN      NS      localhost.
@       IN      A       127.0.0.1
@       IN      AAAA    ::1

; Wildcard for all subdomains
*       IN      A       127.0.0.1

; Specific entries
www     IN      A       127.0.0.1
api     IN      A       127.0.0.1
testclinic IN   A       127.0.0.1
stanford IN     A       127.0.0.1
demo    IN      A       127.0.0.1
EOF

        # Create reverse zone file
        cat > /etc/bind/zones/db.127.0.0.1 <<EOF
\$TTL    604800
@       IN      SOA     intellicare.health. admin.intellicare.health. (
                              1         ; Serial
                         604800         ; Refresh
                          86400         ; Retry
                        2419200         ; Expire
                         604800 )       ; Negative Cache TTL
;
@       IN      NS      localhost.
1       IN      PTR     intellicare.health.
EOF

        # Configure BIND options
        cat > /etc/bind/named.conf.options <<EOF
options {
    directory "/var/cache/bind";

    // Forwarding to public DNS
    forwarders {
        8.8.8.8;
        8.8.4.4;
    };

    // Security
    dnssec-validation auto;
    auth-nxdomain no;

    // Listen on localhost
    listen-on { 127.0.0.1; };
    listen-on-v6 { ::1; };

    // Allow queries from localhost
    allow-query { localhost; };

    // Hide version
    version "not disclosed";
};
EOF

        # Check configuration
        named-checkconf
        named-checkzone intellicare.health /etc/bind/zones/db.intellicare.health

        # Update resolv.conf
        cat > /etc/resolv.conf <<EOF
nameserver 127.0.0.1
nameserver 8.8.8.8
EOF

        # Restart BIND9
        systemctl enable bind9
        systemctl restart bind9

        echo "✅ BIND9 configured as full DNS server!"
        echo "Features:"
        echo "- Full DNS server with zone management"
        echo "- Wildcard support for *.intellicare.health"
        echo "- Reverse DNS lookups"
        echo "- DNSSEC support"
        echo ""
        echo "Test with: nslookup testclinic.intellicare.health"
        echo "Check status: systemctl status bind9"
        ;;

    4)
        echo -e "\n=== Setting up /etc/hosts (Basic) ==="

        # Backup existing hosts file
        cp /etc/hosts /etc/hosts.backup

        # Add IntelliCare entries
        cat >> /etc/hosts <<EOF

# IntelliCare Development Environment
127.0.0.1    intellicare.health
127.0.0.1    www.intellicare.health
127.0.0.1    api.intellicare.health
127.0.0.1    testclinic.intellicare.health
127.0.0.1    stanford.intellicare.health
127.0.0.1    demo.intellicare.health
127.0.0.1    admin.intellicare.health
127.0.0.1    staging.intellicare.health

# Add more subdomains as needed
# Note: No wildcard support with /etc/hosts
EOF

        echo "✅ /etc/hosts configured!"
        echo "⚠️ Warning: No wildcard support - must add each subdomain manually"
        echo ""
        echo "To add new subdomain:"
        echo "echo '127.0.0.1    newclinic.intellicare.health' >> /etc/hosts"
        ;;

    *)
        echo "Invalid choice"
        exit 1
        ;;
esac

# Create DNS testing script
cat > /usr/local/bin/test-intellicare-dns <<'EOF'
#!/bin/bash
echo "Testing IntelliCare DNS Configuration..."
echo "========================================"

DOMAINS=(
    "intellicare.health"
    "www.intellicare.health"
    "api.intellicare.health"
    "stanford.intellicare.health"
    "randompractice.intellicare.health"
)

for domain in "${DOMAINS[@]}"; do
    result=$(nslookup $domain 2>/dev/null | grep -A1 "Name:" | grep "Address:" | awk '{print $2}')
    if [ "$result" = "127.0.0.1" ]; then
        echo "✅ $domain → 127.0.0.1"
    else
        echo "❌ $domain → Failed to resolve"
    fi
done

echo ""
echo "Active DNS resolver:"
systemd-resolve --status 2>/dev/null | grep "DNS Servers" || cat /etc/resolv.conf
EOF

chmod +x /usr/local/bin/test-intellicare-dns

# Create uninstall script
cat > /usr/local/bin/uninstall-intellicare-dns <<'EOF'
#!/bin/bash
echo "Removing IntelliCare DNS configuration..."

# Remove dnsmasq config
rm -f /etc/dnsmasq.d/intellicare.conf
rm -f /etc/NetworkManager/dnsmasq.d/intellicare.conf

# Remove systemd-resolved config
rm -f /etc/systemd/resolved.conf.d/intellicare.conf

# Remove BIND configs
rm -f /etc/bind/zones/db.intellicare.health
rm -f /etc/bind/zones/db.127.0.0.1

# Clean hosts file
sed -i '/# IntelliCare/,/^$/d' /etc/hosts

# Restart services
systemctl restart systemd-resolved 2>/dev/null
systemctl restart NetworkManager 2>/dev/null
systemctl restart dnsmasq 2>/dev/null
systemctl restart bind9 2>/dev/null

echo "✅ IntelliCare DNS configuration removed"
EOF

chmod +x /usr/local/bin/uninstall-intellicare-dns

echo ""
echo "================================================"
echo "✅ DNS Configuration Complete!"
echo "================================================"
echo ""
echo "Test your configuration:"
echo "  test-intellicare-dns"
echo ""
echo "To uninstall later:"
echo "  sudo uninstall-intellicare-dns"
echo ""
echo "Troubleshooting:"
echo "  - Clear DNS cache: sudo systemd-resolve --flush-caches"
echo "  - Check DNS status: systemd-resolve --status"
echo "  - Test specific domain: nslookup testclinic.intellicare.health"
echo ""

# Run test
test-intellicare-dns