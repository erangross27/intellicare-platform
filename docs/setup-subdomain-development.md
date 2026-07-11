# Setting Up Subdomain Development

## Option 1: Use *.localhost (Chrome/Firefox Support)

Modern browsers support `*.localhost` automatically:

```
http://developer.localhost:3000
http://testclinic.localhost:3000
```

### Frontend Changes Needed:

1. **Update CORS in backend/server.js:**
```javascript
app.use(cors({
  origin: [
    'http://localhost:3000', 
    'http://*.localhost:3000',  // Add wildcard support
    /^http:\/\/[\w-]+\.localhost:3000$/  // Regex pattern
  ],
  credentials: true
}));
```

2. **Update Login/Signup Flow:**
After successful practice selection, redirect to subdomain:
```javascript
// In ClinicSelector.js
const handleClinicSelect = (subdomain) => {
  // Redirect to subdomain URL
  window.location.href = `http://${subdomain}.localhost:3000/login`;
};
```

## Option 2: Use /etc/hosts (All Browsers)

Add to `/etc/hosts` (Windows: `C:\Windows\System32\drivers\etc\hosts`):

```
127.0.0.1 developer.localhost
127.0.0.1 testclinic.localhost
127.0.0.1 drsmith.localhost
```

## Option 3: Production Setup

For production with `intellicare.com`:

1. **DNS Wildcard Record:**
```
*.intellicare.com → Your server IP
```

2. **SSL Certificate:**
```
Wildcard SSL: *.intellicare.com
```

3. **Frontend Build:**
```javascript
// Detect subdomain and redirect if needed
const currentHost = window.location.hostname;
if (currentHost === 'intellicare.com') {
  // Redirect to practice selector or default practice
}
```

## Benefits of True Subdomain Routing:

✅ **Better SEO** - Each practice has unique URL
✅ **Cleaner URLs** - No headers/storage needed  
✅ **Better UX** - Users see practice in URL
✅ **Easier sharing** - Practice-specific links
✅ **Security** - Natural tenant isolation
