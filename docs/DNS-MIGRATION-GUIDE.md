# DNS & Proxy Configuration Guide for Ubuntu

## 🌐 DNS Solutions Comparison

### Current Windows Setup
- **Acrylic DNS Proxy**: Local DNS server with wildcard support
- **Features**: Caching, wildcard domains, custom rules
- **Usage**: Resolves *.intellicare.health to 127.0.0.1

### Ubuntu Alternatives

| Solution | Complexity | Features | Best For |
|----------|------------|----------|----------|
| **systemd-resolved** | ⭐ Easy | Built-in, basic wildcard via NetworkManager | Quick setup, Ubuntu defaults |
| **dnsmasq** | ⭐⭐ Medium | Like Acrylic, full wildcard, caching, logging | Most similar to Windows setup |
| **BIND9** | ⭐⭐⭐ Complex | Full DNS server, zones, DNSSEC | Production environments |
| **/etc/hosts** | ⭐ Simplest | No wildcard, manual entries only | Testing specific domains |

## 🚀 Quick Setup Guide

### Option 1: dnsmasq (Recommended - Most Like Acrylic)

```bash
# Run the setup script
sudo chmod +x UBUNTU-DNS-SETUP.sh
sudo ./UBUNTU-DNS-SETUP.sh

# Choose option 2 (dnsmasq)
```

**Features you get:**
- ✅ Wildcard support (*.intellicare.health)
- ✅ DNS caching (10,000 entries)
- ✅ Query logging
- ✅ Custom domain rules
- ✅ Production domain overrides

**Configuration location:** `/etc/dnsmasq.d/intellicare.conf`

### Option 2: systemd-resolved (Ubuntu Default)

```bash
# Run setup and choose option 1
sudo ./UBUNTU-DNS-SETUP.sh
```

**Features:**
- ✅ Native Ubuntu integration
- ✅ Works with NetworkManager
- ✅ Basic wildcard support
- ⚠️ Less flexible than dnsmasq

## 🔧 Nginx Proxy Configuration

The Windows setup uses the browser to handle port routing. On Ubuntu, we use Nginx:

```bash
# Setup Nginx proxy
sudo chmod +x NGINX-PROXY-SETUP.sh
sudo ./NGINX-PROXY-SETUP.sh
```

### What Nginx Handles
- **intellicare.health** → Frontend (port 3000)
- **intellicare.health:5000** → Backend API
- **stanford.intellicare.health** → Same app, different tenant (practice)
- **All practice subdomains** automatically routed

### Port Mapping
```
Public (Nginx) → Internal (Apps)
Port 80 → Port 3000 (Frontend)
Port 3000 → Port 3001 (Frontend direct)
Port 5000 → Port 5001 (Backend API)
Port 80/api → Port 5001 (API via proxy)
```

## 📝 Complete Migration Steps

### 1. Setup DNS
```bash
# Install and configure DNS
sudo ./UBUNTU-DNS-SETUP.sh

# Choose option 2 (dnsmasq) for Acrylic-like features
# Test DNS resolution
test-intellicare-dns
```

### 2. Setup Nginx Proxy
```bash
# Install and configure Nginx
sudo ./NGINX-PROXY-SETUP.sh

# Adjust application ports
cd ~/IntelliCare
./adjust-ports.sh
```

### 3. Update Application Configuration
```bash
# Backend .env
echo "PORT=5001" >> apps/backend-api/.env

# Frontend vite.config.js
# Change server.port from 3000 to 3001
```

### 4. Start Services
```bash
# Start all services
./manage-services.sh start

# Test endpoints
curl http://intellicare.health          # Frontend
curl http://intellicare.health:5000/api # Backend API
curl http://testclinic.intellicare.health # Subdomain
```

## 🔍 Testing & Verification

### Test DNS Resolution
```bash
# Test main domain
nslookup intellicare.health
# Should return: 127.0.0.1

# Test wildcard subdomain
nslookup randomclinic.intellicare.health
# Should return: 127.0.0.1

# Test all configured domains
test-intellicare-dns
```

### Test Nginx Proxy
```bash
# Test routing
intellicare-nginx test

# View logs
intellicare-nginx logs

# Check status
intellicare-nginx status
```

### Test Application Access
```bash
# Frontend
curl -I http://intellicare.health

# API
curl http://intellicare.health:5000/api/health

# Subdomain
curl -I http://testclinic.intellicare.health
```

## 🛠️ Troubleshooting

### DNS Not Resolving
```bash
# Check DNS service
sudo systemctl status dnsmasq  # or systemd-resolved

# Flush DNS cache
sudo systemd-resolve --flush-caches

# Check resolv.conf
cat /etc/resolv.conf
# Should show: nameserver 127.0.0.1

# Restart DNS
sudo systemctl restart dnsmasq
```

### Nginx Issues
```bash
# Test configuration
sudo nginx -t

# Check error logs
sudo tail -f /var/log/nginx/intellicare_error.log

# Reload config
sudo intellicare-nginx reload
```

### Port Conflicts
```bash
# Check what's using ports
sudo lsof -i :3000
sudo lsof -i :5000

# Kill conflicting process
sudo kill -9 <PID>
```

## 🔐 Production Considerations

### SSL Setup (Let's Encrypt)
```bash
# Automatic SSL setup
sudo intellicare-nginx ssl-setup

# Manual setup
sudo certbot --nginx -d intellicare.health -d *.intellicare.health
```

### DNS for Production
- Point real intellicare.health domain to server IP
- Keep local DNS for development subdomains
- Use split-horizon DNS if needed

### Firewall Rules
```bash
# Open necessary ports
sudo ufw allow 80/tcp   # HTTP
sudo ufw allow 443/tcp  # HTTPS
sudo ufw allow 3000/tcp # Development
sudo ufw allow 5000/tcp # API
```

## 📊 Comparison Table: Windows vs Ubuntu

| Feature | Windows (Acrylic) | Ubuntu (dnsmasq) |
|---------|------------------|------------------|
| Wildcard domains | ✅ *.intellicare.health | ✅ *.intellicare.health |
| DNS caching | ✅ Yes | ✅ Yes (10,000 entries) |
| Query logging | ✅ Yes | ✅ /var/log/dnsmasq.log |
| GUI configuration | ✅ Yes | ❌ Config files only |
| Custom rules | ✅ Yes | ✅ Yes |
| DNSSEC | ⚠️ Limited | ✅ Full support |
| Performance | Good | Better (native) |
| Resource usage | Higher | Lower |

## 🚦 Quick Commands Reference

```bash
# DNS Management
test-intellicare-dns              # Test all domains
sudo systemctl restart dnsmasq    # Restart DNS
sudo nano /etc/dnsmasq.d/intellicare.conf  # Edit config

# Nginx Management
intellicare-nginx status          # Check status
intellicare-nginx reload          # Reload config
intellicare-nginx logs            # View logs
intellicare-nginx test            # Test endpoints

# Application Management
./manage-services.sh start        # Start all
./manage-services.sh stop         # Stop all
./manage-services.sh status       # Check status

# Cleanup (if needed)
sudo uninstall-intellicare-dns    # Remove DNS config
```

## ✅ Success Checklist

- [ ] DNS resolver installed (dnsmasq/systemd-resolved)
- [ ] intellicare.health resolves to 127.0.0.1
- [ ] Wildcard subdomains work
- [ ] Nginx proxy configured
- [ ] Ports adjusted (3001/5001 internal)
- [ ] Applications accessible on standard ports
- [ ] Subdomains route correctly
- [ ] API endpoints reachable
- [ ] Logs accessible for debugging