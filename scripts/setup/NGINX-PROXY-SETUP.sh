#!/bin/bash

# IntelliCare Nginx Reverse Proxy Setup
# Handles subdomain routing like Windows setup

set -e

echo "================================================"
echo "IntelliCare Nginx Proxy Configuration"
echo "================================================"

if [[ $EUID -ne 0 ]]; then
   echo "This script must be run as root (use sudo)"
   exit 1
fi

# Install Nginx
echo "Installing Nginx..."
apt update
apt install -y nginx

# Create IntelliCare Nginx configuration
cat > /etc/nginx/sites-available/intellicare <<'EOF'
# IntelliCare Multi-Tenant Proxy Configuration

# Main application (catch-all for *.intellicare.health)
server {
    listen 80;
    listen [::]:80;

    # Handle all subdomains
    server_name intellicare.health *.intellicare.health;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Client body size for file uploads
    client_max_body_size 100M;

    # Proxy timeouts
    proxy_connect_timeout 600;
    proxy_send_timeout 600;
    proxy_read_timeout 600;
    send_timeout 600;

    # WebSocket support
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection 'upgrade';
    proxy_cache_bypass $http_upgrade;

    # Main frontend (port 3000)
    location / {
        proxy_pass http://localhost:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;

        # CORS headers for development
        add_header 'Access-Control-Allow-Origin' '*' always;
        add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS, PUT, DELETE' always;
        add_header 'Access-Control-Allow-Headers' 'Origin, Content-Type, Accept, Authorization' always;
    }

    # Backend API (port 5000)
    location /api {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host;

        # Don't forward /api prefix if backend doesn't expect it
        # rewrite ^/api/(.*)$ /$1 break;

        # CORS for API
        if ($request_method = 'OPTIONS') {
            add_header 'Access-Control-Allow-Origin' '*';
            add_header 'Access-Control-Allow-Methods' 'GET, POST, OPTIONS, PUT, DELETE';
            add_header 'Access-Control-Allow-Headers' 'Origin, Content-Type, Accept, Authorization';
            add_header 'Access-Control-Max-Age' 1728000;
            add_header 'Content-Type' 'text/plain charset=UTF-8';
            add_header 'Content-Length' 0;
            return 204;
        }
    }

    # Health check endpoints
    location /health {
        proxy_pass http://localhost:5000/health;
        access_log off;
    }

    # Static files with caching
    location /static {
        proxy_pass http://localhost:3000;
        expires 30d;
        add_header Cache-Control "public, immutable";
    }

    # Error pages
    error_page 502 503 504 /50x.html;
    location = /50x.html {
        root /usr/share/nginx/html;
        internal;
    }

    # Access logs with subdomain info
    access_log /var/log/nginx/intellicare_access.log combined;
    error_log /var/log/nginx/intellicare_error.log warn;
}

# Port 3000 direct access (for development compatibility)
server {
    listen 3000;
    listen [::]:3000;

    server_name intellicare.health *.intellicare.health;

    location / {
        proxy_pass http://localhost:3001;  # Frontend runs on 3001 internally
        proxy_set_header Host $host:3000;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_set_header X-Forwarded-Host $host:3000;
    }
}

# Port 5000 direct access (API)
server {
    listen 5000;
    listen [::]:5000;

    server_name intellicare.health *.intellicare.health;

    location / {
        proxy_pass http://localhost:5001;  # Backend runs on 5001 internally
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

# Create SSL configuration template
cat > /etc/nginx/sites-available/intellicare-ssl <<'EOF'
# IntelliCare SSL Configuration (Production)
# Uncomment and configure when SSL certificates are ready

# Redirect HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name intellicare.health *.intellicare.health;
    return 301 https://$host$request_uri;
}

# HTTPS Server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;

    server_name intellicare.health *.intellicare.health;

    # SSL Configuration
    ssl_certificate /etc/letsencrypt/live/intellicare.health/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/intellicare.health/privkey.pem;

    # Modern SSL configuration
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES256-GCM-SHA384:ECDHE-ECDSA-AES256-GCM-SHA384:DHE-RSA-AES128-GCM-SHA256:DHE-DSS-AES128-GCM-SHA256:kEDH+AESGCM:ECDHE-RSA-AES128-SHA256:ECDHE-ECDSA-AES128-SHA256:ECDHE-RSA-AES128-SHA:ECDHE-ECDSA-AES128-SHA:ECDHE-RSA-AES256-SHA384:ECDHE-ECDSA-AES256-SHA384:ECDHE-RSA-AES256-SHA:ECDHE-ECDSA-AES256-SHA:DHE-RSA-AES128-SHA256:DHE-RSA-AES128-SHA:DHE-DSS-AES128-SHA256:DHE-RSA-AES256-SHA256:DHE-DSS-AES256-SHA:DHE-RSA-AES256-SHA:!aNULL:!eNULL:!EXPORT:!DES:!RC4:!3DES:!MD5:!PSK;
    ssl_prefer_server_ciphers on;

    # HSTS
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains; preload" always;

    # Rest of configuration same as HTTP version...
    # (Copy location blocks from above)
}
EOF

# Enable the site
ln -sf /etc/nginx/sites-available/intellicare /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration
nginx -t

# Reload Nginx
systemctl reload nginx
systemctl enable nginx

# Create utility scripts
cat > /usr/local/bin/intellicare-nginx <<'EOF'
#!/bin/bash

case "$1" in
    status)
        systemctl status nginx
        ;;
    reload)
        nginx -t && systemctl reload nginx
        ;;
    logs)
        tail -f /var/log/nginx/intellicare_*.log
        ;;
    errors)
        tail -f /var/log/nginx/intellicare_error.log
        ;;
    access)
        tail -f /var/log/nginx/intellicare_access.log
        ;;
    test)
        echo "Testing IntelliCare proxy endpoints..."
        curl -s -o /dev/null -w "%{http_code}" http://intellicare.health/health && echo " ✅ Health check OK" || echo " ❌ Health check failed"
        curl -s -o /dev/null -w "%{http_code}" http://testclinic.intellicare.health && echo " ✅ Subdomain routing OK" || echo " ❌ Subdomain routing failed"
        ;;
    ssl-setup)
        echo "Setting up SSL with Let's Encrypt..."
        apt install -y certbot python3-certbot-nginx
        certbot --nginx -d intellicare.health -d *.intellicare.health
        ;;
    *)
        echo "Usage: intellicare-nginx {status|reload|logs|errors|access|test|ssl-setup}"
        exit 1
        ;;
esac
EOF

chmod +x /usr/local/bin/intellicare-nginx

# Create port adjustment script for applications
cat > /home/$SUDO_USER/IntelliCare/adjust-ports.sh <<'EOF'
#!/bin/bash

# Adjust application ports to work with Nginx proxy
echo "Adjusting application ports for Nginx proxy..."

# Update backend to run on 5001 (proxied from 5000)
if [ -f apps/backend-api/.env ]; then
    sed -i 's/PORT=5000/PORT=5001/' apps/backend-api/.env
    echo "PORT=5001" >> apps/backend-api/.env
fi

# Update frontend to run on 3001 (proxied from 3000)
if [ -f apps/frontend-vite/vite.config.js ]; then
    sed -i 's/port: 3000/port: 3001/' apps/frontend-vite/vite.config.js
fi

echo "✅ Ports adjusted:"
echo "  - Frontend: Internal 3001 → Public 3000"
echo "  - Backend: Internal 5001 → Public 5000"
echo ""
echo "Nginx will handle the routing on standard ports"
EOF

chmod +x /home/$SUDO_USER/IntelliCare/adjust-ports.sh
chown $SUDO_USER:$SUDO_USER /home/$SUDO_USER/IntelliCare/adjust-ports.sh

echo ""
echo "================================================"
echo "✅ Nginx Proxy Configuration Complete!"
echo "================================================"
echo ""
echo "Nginx is configured to handle:"
echo "  - All *.intellicare.health subdomains"
echo "  - Frontend on port 3000 (and 80)"
echo "  - Backend API on port 5000 (and 80/api)"
echo "  - WebSocket connections"
echo "  - File uploads up to 100MB"
echo ""
echo "Useful commands:"
echo "  intellicare-nginx status    - Check Nginx status"
echo "  intellicare-nginx reload    - Reload configuration"
echo "  intellicare-nginx logs      - View all logs"
echo "  intellicare-nginx test      - Test endpoints"
echo "  intellicare-nginx ssl-setup - Setup SSL certificates"
echo ""
echo "Next steps:"
echo "1. Run: ~/IntelliCare/adjust-ports.sh"
echo "2. Start your applications"
echo "3. Test: curl http://intellicare.health"
echo ""
echo "For SSL (production):"
echo "  sudo intellicare-nginx ssl-setup"
echo ""