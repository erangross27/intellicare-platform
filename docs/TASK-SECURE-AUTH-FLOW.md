# 🔐 SECURE AUTHENTICATION FLOW - IMPLEMENTATION TASK

## 📅 Created: August 24, 2025
## 👤 For: Eran Gross
## 🎯 Priority: HIGH - Complete in next session

---

## ✅ WHAT WE ACCOMPLISHED TODAY:

1. **Practice Creation Flow**: Working with auto-redirect to subdomain
2. **Email Verification**: Sends emails successfully 
3. **Wildcard DNS**: `*.intellicare.health → 127.0.0.1` configured
4. **Auto-redirect**: After practice creation, redirects to subdomain

## 🚀 WHAT NEEDS TO BE DONE:

### **MAIN GOAL: Implement Secure One-Click Verification + Auto-Login**

User flow should be:
1. Create practice at `intellicare.health`
2. Get email → Click verification link
3. Backend verifies + creates session + redirects
4. User arrives at their practice subdomain already logged in

---

## 📋 IMPLEMENTATION TASKS:

### 1️⃣ **Backend: Update Email Verification Endpoint**

**File:** `backend/routes/passwordlessAuth.js`

```javascript
// TASK: Modify the /verify-email endpoint to:
router.post('/verify-email', async (req, res) => {
  const { token, userId, practice } = req.body;
  
  // 1. Verify the token
  const verification = await EmailVerification.findOne({ token, userId });
  
  if (verification && verification.isValid()) {
    // 2. Mark user as verified
    const user = await User.findByIdAndUpdate(userId, {
      emailVerified: true,
      verifiedAt: new Date()
    });
    
    // 3. Get practice information
    const clinicDoc = await Practice.findOne({ 
      subdomain: practice,
      users: userId 
    });
    
    // 4. CREATE SESSION (This is the KEY part)
    const sessionToken = crypto.randomBytes(32).toString('hex');
    const session = await Session.create({
      token: sessionToken,
      userId: user._id,
      practiceId: clinicDoc._id,
      practiceSubdomain: clinicDoc.subdomain,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
    });
    
    // 5. Set httpOnly cookie
    res.cookie('sessionToken', sessionToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000,
      domain: '.intellicare.health' // Allow subdomain access
    });
    
    // 6. Delete the verification token
    await EmailVerification.deleteOne({ _id: verification._id });
    
    // 7. Redirect to main domain (will auto-redirect to subdomain)
    return res.redirect(`http://intellicare.health:3000?verified=true&welcome=${user.firstName}`);
  }
  
  // If verification fails
  res.redirect(`http://intellicare.health:3000?error=invalid-verification`);
});
```

### 2️⃣ **Backend: Update Session Check Endpoint**

**File:** `backend/routes/practiceAuth.js`

```javascript
// TASK: Ensure session-check returns practice subdomain
router.get('/session-check', async (req, res) => {
  const sessionToken = req.cookies.sessionToken;
  
  if (!sessionToken) {
    return res.status(401).json({ success: false });
  }
  
  const session = await Session.findOne({ 
    token: sessionToken,
    expiresAt: { $gt: new Date() }
  });
  
  if (session) {
    const user = await User.findById(session.userId);
    const practice = await Practice.findById(session.practiceId);
    
    return res.json({
      success: true,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        emailVerified: user.emailVerified
      },
      practice: {
        id: practice._id,
        name: practice.name,
        subdomain: practice.subdomain  // CRITICAL: Include subdomain
      }
    });
  }
  
  res.status(401).json({ success: false });
});
```

### 3️⃣ **Frontend: Handle Auto-Redirect After Verification**

**File:** `frontend-vite/src/context/AuthContext.js`

```javascript
// TASK: Add to the initialization useEffect
useEffect(() => {
  const initializeAuth = async () => {
    try {
      // Check for verification success
      const urlParams = new URLSearchParams(window.location.search);
      const isVerified = urlParams.get('verified');
      const welcomeName = urlParams.get('welcome');
      
      // Check session with backend
      const response = await authAPI.getCurrentUserAndClinic();
      
      if (response?.data?.user) {
        setUser(response.data.user);
        setClinic(response.data.practice);
        
        // If just verified and on main domain, redirect to subdomain
        if (isVerified && response.data.practice?.subdomain) {
          // Show welcome message briefly
          console.log(`Welcome ${welcomeName}! Redirecting to your practice...`);
          
          setTimeout(() => {
            const subdomain = response.data.practice.subdomain;
            const protocol = window.location.protocol;
            const port = window.location.port ? `:${window.location.port}` : '';
            window.location.href = `${protocol}//${subdomain}.intellicare.health${port}/dashboard`;
          }, 2000);
        }
      }
    } catch (error) {
      // No session - this is normal for first visit
      console.log('No active session');
    } finally {
      setLoading(false);
    }
  };
  
  initializeAuth();
}, []);
```

### 4️⃣ **Frontend: Update ChatAuthAI for Better UX**

**File:** `frontend-vite/src/components/ChatAuthAI.js`

```javascript
// TASK: Show appropriate message based on state
useEffect(() => {
  const urlParams = new URLSearchParams(window.location.search);
  const verified = urlParams.get('verified');
  const error = urlParams.get('error');
  
  if (verified) {
    setMessages([{
      type: 'agent',
      content: '✅ Email verified and you are now logged in! Redirecting to your practice...',
      timestamp: new Date().toISOString()
    }]);
  } else if (error === 'invalid-verification') {
    setMessages([{
      type: 'agent',
      content: '❌ Invalid or expired verification link. Please request a new one.',
      timestamp: new Date().toISOString()
    }]);
  }
}, []);
```

### 5️⃣ **Database: Create Session Model**

**File:** `backend/models/Session.js`

```javascript
// TASK: Create new Session model
const mongoose = require('mongoose');

const sessionSchema = new mongoose.Schema({
  token: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  practiceId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Practice',
    required: true
  },
  practiceSubdomain: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  },
  expiresAt: {
    type: Date,
    required: true,
    index: true
  },
  lastActivity: {
    type: Date,
    default: Date.now
  }
});

// Auto-delete expired sessions
sessionSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

module.exports = mongoose.model('Session', sessionSchema);
```

---

## 🧪 TEST PLAN:

### Test Script: `backend/test-complete-auth-flow.js`

```javascript
const { chromium } = require('playwright');

async function testCompleteAuthFlow() {
  // 1. Create practice
  // 2. Wait for email
  // 3. Click verification link
  // 4. Verify auto-login and redirect to subdomain
  // 5. Confirm user is logged in at subdomain
}
```

---

## 🎯 SUCCESS CRITERIA:

1. ✅ User clicks ONE link in email
2. ✅ Automatically logged in (no separate login step)
3. ✅ Redirected to correct subdomain
4. ✅ Session persists across page refreshes
5. ✅ All authentication handled server-side
6. ✅ No tokens in client-side storage

---

## 🔒 SECURITY CHECKLIST:

- [ ] All sessions stored in database (not JWT)
- [ ] httpOnly cookies only
- [ ] CSRF protection on mutations
- [ ] Session expiry implemented
- [ ] Rate limiting on verification endpoint
- [ ] Audit logging for all auth events

---

## 📝 NOTES FOR NEXT SESSION:

1. **Current Status**: 
   - Practice creation ✅
   - Email verification ✅
   - Auto-redirect after creation ✅
   - Need: Auto-login after verification

2. **Key Files to Modify**:
   - `backend/routes/passwordlessAuth.js` - Main change here
   - `backend/models/Session.js` - Create this
   - `frontend-vite/src/context/AuthContext.js` - Handle redirect
   - `frontend-vite/src/components/ChatAuthAI.js` - Show messages

3. **Testing**:
   - Use email: `eran@gross.support`
   - Test practice creation → verification → auto-login flow
   - Verify session persists

4. **Remember**:
   - Wildcard DNS is set up: `*.intellicare.health → 127.0.0.1`
   - Backend knows which practice user belongs to
   - Frontend just follows backend's instructions

---

## 💡 QUICK START FOR NEXT SESSION:

```bash
# 1. Start backend
cd backend && npm run dev

# 2. Start frontend
cd frontend-vite && npm run dev

# 3. Open this file and continue implementation
# Start with Task 1: Update Email Verification Endpoint
```

---

**END OF TASK DOCUMENT**
*Save this for next conversation*