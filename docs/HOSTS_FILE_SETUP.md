# IntelliCare Local Domain Setup

## 🌐 Setting up intellicare.health for Local Development

### 1. Edit Windows Hosts File

**Location**: `C:\Windows\System32\drivers\etc\hosts`

**Open as Administrator**:
1. Open Notepad as Administrator (Right-click → Run as administrator)
2. File → Open → Navigate to `C:\Windows\System32\drivers\etc\`
3. Change file type dropdown to "All Files (*.*)"
4. Open `hosts` file

### 2. Add These Lines

```
# IntelliCare Local Development
127.0.0.1       intellicare.health
127.0.0.1       gross-practice.intellicare.health
127.0.0.1       developer.intellicare.health
127.0.0.1       testclinic.intellicare.health

# Add more practice subdomains as needed
# 127.0.0.1       [your-practice].intellicare.health
```

### 3. Save and Test

1. Save the hosts file
2. Open Command Prompt and run: `ipconfig /flushdns`
3. Test by pinging: `ping intellicare.health`

### 4. Access Your Application

**Frontend**:
- Main: http://intellicare.health:3000
- Practice: http://gross-practice.intellicare.health:3000
- Developer: http://developer.intellicare.health:3000

**Backend API**:
- http://intellicare.health:5000

### 5. Email Verification Links

Now your verification emails will show:
```
http://intellicare.health:3000/verify-email?token=xxx&userId=xxx
```

Instead of:
```
http://localhost:3000/verify-email?token=xxx&userId=xxx
```

## ✅ Configuration Checklist

- [x] Backend `.env` updated: `FRONTEND_URL=http://intellicare.health:3000`
- [x] CORS configured to allow `intellicare.health` and subdomains
- [x] Frontend works with custom domain
- [x] Email links use proper domain

## 🔧 Troubleshooting

### If domain doesn't resolve:
1. Make sure you saved hosts file as Administrator
2. Flush DNS cache: `ipconfig /flushdns`
3. Restart browser
4. Try incognito/private mode

### If CORS errors occur:
- Check backend console for CORS messages
- Verify origin is listed in `securityHeaders.js`

### To revert to localhost:
1. Comment out hosts file entries with `#`
2. Update `.env`: `FRONTEND_URL=http://localhost:3000`
3. Restart backend server

## 🚀 Benefits

1. **Professional URLs**: Looks like production
2. **Multi-tenant Testing**: Test real subdomain routing
3. **Email Testing**: Verification links work properly
4. **Production-like**: Closer to real deployment

---
*Note: This is for local development only. In production, DNS records will point to actual servers.*