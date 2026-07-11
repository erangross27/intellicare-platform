# IntelliCare Login Test Guide

## 🧪 Test 1: Magic Link Login (Existing User)

### Prerequisites
- Server running: `cd backend && DISABLE_RATE_LIMITS=true node server.js`
- Frontend running: `cd frontend-vite && npm run dev`

### Steps to Test Login:

1. **Go to the chat interface**
   - Navigate to: `http://localhost:3000`
   - Or if testing specific practice: `http://medical-center.localhost:3000`

2. **In the chat, type:**
   - "login" or "התחבר" (Hebrew)
   - When asked for practice: Enter your practice subdomain (e.g., "medical-center")
   - When asked for email: Enter your registered email

3. **Check your email**
   - You should receive a magic login link
   - The link should look like:
     ```
     http://medical-center.localhost:3000/magic-login?token=xxx&userId=xxx&practice=medical-center
     ```
   - ✅ **FIXED**: No more hardcoded "developer" - it uses your actual practice

4. **Click the magic link**
   - You'll be taken to the login page
   - After verification, you'll see session duration options:
     - 1 Day (High Security)
     - 7 Days (Balanced)
     - 30 Days (Stay Logged In)

5. **Choose session duration**
   - Select based on your security needs
   - You'll be redirected to your practice subdomain

### What to Verify:

✅ **Email Link Contains:**
- Correct subdomain (not parent domain)
- Practice parameter in URL
- Valid token and userId

✅ **After Login:**
- Redirected to practice subdomain (e.g., `medical-center.localhost:3000`)
- Session persists based on your choice
- Can close browser and reopen (if chose 7 or 30 days)

---

## 🧪 Test 2: New User Registration (After Login Test)

### Steps:

1. **In chat, type:**
   - "signup" or "הרשמה"
   - Choose "Join existing practice"
   - Enter practice subdomain
   - Enter your name
   - Enter new email address

2. **Verification Email:**
   - Should contain link to practice subdomain
   - After clicking, choose session duration
   - Redirected to practice subdomain

---

## 🔍 Quick Checks:

### Check if session persists:
```javascript
// In browser console:
console.log('Token:', sessionStorage.getItem('token') ? 'Present' : 'Missing');
console.log('Persistent:', localStorage.getItem('authToken') ? 'Yes' : 'No');
console.log('Remember Me:', localStorage.getItem('rememberMe'));
console.log('Session Expiry:', new Date(parseInt(localStorage.getItem('sessionExpiry'))));
```

### Check current practice:
```javascript
// In browser console:
console.log('Practice:', JSON.parse(localStorage.getItem('practice')));
console.log('User:', JSON.parse(sessionStorage.getItem('user')));
```

---

## 🐛 Troubleshooting:

### If email doesn't arrive:
1. Check backend console for SendGrid errors
2. Verify `SENDGRID_API_KEY` in `.env`
3. Check spam folder

### If redirect fails:
1. Ensure hosts file has entries:
   ```
   127.0.0.1 medical-center.localhost
   127.0.0.1 developer.localhost
   ```

2. Clear browser cache and cookies

### If session doesn't persist:
1. Check browser allows localStorage
2. Verify token generation in backend logs
3. Check browser console for errors

---

## 📝 Expected Success Flow:

1. Request login → ✅ Email sent with correct subdomain
2. Click magic link → ✅ Taken to verify page
3. Choose session duration → ✅ Options shown (1/7/30 days)
4. Complete login → ✅ Redirected to `your-practice.localhost:3000`
5. Close & reopen browser → ✅ Still logged in (if chose 7/30 days)

---

## 🔒 Security Notes:

- **1 Day**: Token expires in 24 hours, cleared on browser close
- **7 Days**: Token persists for 7 days, survives browser restart
- **30 Days**: Maximum persistence, for trusted personal devices only
- All sessions respect HIPAA compliance requirements

Let me know which part you want to test first!