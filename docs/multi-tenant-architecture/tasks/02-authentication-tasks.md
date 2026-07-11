# Authentication Tasks - Phase 1

## Overview
Multi-tenant authentication system with practice-aware sessions and secure token management.

## Task 2.1: Update JWT Token Structure
**Estimated Time**: 25 minutes
**Priority**: HIGH

### Checklist:
- [ ] Add practice context to JWT payload
- [ ] Include user roles per practice
- [ ] Add current practice selection
- [ ] Update token generation logic
- [ ] Test token validation

### Implementation:
```javascript
// Enhanced JWT payload
const payload = {
  userId: user._id,
  email: user.email,
  practices: user.practices.map(c => ({
    practiceId: c.practiceId,
    roles: c.roles,
    status: c.status
  })),
  currentClinicId: user.currentClinicId,
  iat: Date.now()
};

const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '8h' });
```

### Success Criteria:
- [ ] JWT includes practice context
- [ ] Token validation updated
- [ ] Practice switching supported
- [ ] Security maintained

---

## Task 2.2: Create Practice Selection Middleware
**Estimated Time**: 20 minutes
**Priority**: HIGH

### Checklist:
- [ ] Create middleware to handle practice selection
- [ ] Validate user access to selected practice
- [ ] Set practice context in request
- [ ] Handle practice switching
- [ ] Add error handling

### Implementation:
```javascript
// middleware/clinicSelection.js
function clinicSelection(req, res, next) {
  const { practiceId } = req.headers;
  const userClinics = req.user.practices;
  
  // Validate practice access
  const hasAccess = userClinics.some(c => 
    c.practiceId.toString() === practiceId && c.status === 'active'
  );
  
  if (!hasAccess) {
    return res.status(403).json({ error: 'Access denied to practice' });
  }
  
  req.practiceId = practiceId;
  next();
}
```

### Success Criteria:
- [ ] Practice selection works
- [ ] Access validation enforced
- [ ] Context properly set
- [ ] Error handling complete

---

## Task 2.3: Update Login Process
**Estimated Time**: 30 minutes
**Priority**: HIGH

### Checklist:
- [ ] Modify login to return practice list
- [ ] Add practice selection step
- [ ] Update login response format
- [ ] Handle users with no practice access
- [ ] Test multi-practice login scenarios

### Implementation:
```javascript
// Enhanced login response
app.post('/api/auth/login', async (req, res) => {
  const user = await User.findOne({ email }).populate('practices.practiceId');
  
  if (!user || !bcrypt.compareSync(password, user.passwordHash)) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }
  
  const activeClinics = user.practices.filter(c => c.status === 'active');
  
  if (activeClinics.length === 0) {
    return res.status(403).json({ error: 'No active practice access' });
  }
  
  const token = generateToken(user);
  
  res.json({
    token,
    user: {
      id: user._id,
      email: user.email,
      practices: activeClinics
    }
  });
});
```

### Success Criteria:
- [ ] Login returns practice list
- [ ] Multi-practice support works
- [ ] No practice access handled
- [ ] Token generation updated

---

## Task 2.4: Create Practice Switching API
**Estimated Time**: 15 minutes
**Priority**: MEDIUM

### Checklist:
- [ ] Create endpoint for practice switching
- [ ] Validate user access to target practice
- [ ] Update current practice in session
- [ ] Return updated token
- [ ] Test practice switching

### Implementation:
```javascript
// Switch practice endpoint
app.post('/api/auth/switch-practice', authenticateToken, async (req, res) => {
  const { practiceId } = req.body;
  const user = req.user;
  
  // Validate access
  const hasAccess = user.practices.some(c => 
    c.practiceId.toString() === practiceId && c.status === 'active'
  );
  
  if (!hasAccess) {
    return res.status(403).json({ error: 'Access denied' });
  }
  
  // Generate new token with updated practice
  const newToken = generateToken({ ...user, currentClinicId: practiceId });
  
  res.json({ token: newToken, currentClinicId: practiceId });
});
```

### Success Criteria:
- [ ] Practice switching works
- [ ] Access validation enforced
- [ ] New token generated
- [ ] Session updated

---

## Task 2.5: Add Email Verification System
**Estimated Time**: 40 minutes
**Priority**: HIGH

### Checklist:
- [ ] Create email verification model
- [ ] Generate verification tokens
- [ ] Send verification emails
- [ ] Create verification endpoint
- [ ] Handle email resending
- [ ] Test email flow

### Implementation:
```javascript
// Email verification model
const verificationSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  token: { type: String, required: true, unique: true },
  type: { type: String, enum: ['email', 'password-reset'], required: true },
  expiresAt: { type: Date, required: true },
  used: { type: Boolean, default: false }
});

// Send verification email
async function sendVerificationEmail(user) {
  const token = crypto.randomBytes(32).toString('hex');
  
  await EmailVerification.create({
    userId: user._id,
    token,
    type: 'email',
    expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
  });
  
  await sendEmail({
    to: user.email,
    subject: 'Verify your IntelliCare account',
    html: `Click <a href="${process.env.FRONTEND_URL}/verify-email?token=${token}">here</a> to verify`
  });
}
```

### Success Criteria:
- [ ] Verification system works
- [ ] Emails sent successfully
- [ ] Token validation secure
- [ ] Expiration handled

---

## Task 2.6: Implement Password Reset
**Estimated Time**: 35 minutes
**Priority**: HIGH

### Checklist:
- [ ] Create password reset request endpoint
- [ ] Generate secure reset tokens
- [ ] Send reset emails
- [ ] Create password reset endpoint
- [ ] Add rate limiting
- [ ] Test reset flow

### Implementation:
```javascript
// Password reset request
app.post('/api/auth/forgot-password', async (req, res) => {
  const { email } = req.body;
  const user = await User.findOne({ email });
  
  if (!user) {
    // Don't reveal if email exists
    return res.json({ message: 'If email exists, reset link sent' });
  }
  
  const token = crypto.randomBytes(32).toString('hex');
  
  await EmailVerification.create({
    userId: user._id,
    token,
    type: 'password-reset',
    expiresAt: new Date(Date.now() + 60 * 60 * 1000) // 1 hour
  });
  
  await sendPasswordResetEmail(user.email, token);
  
  res.json({ message: 'If email exists, reset link sent' });
});
```

### Success Criteria:
- [ ] Reset request works
- [ ] Secure token generation
- [ ] Email sending works
- [ ] Rate limiting applied

---

## Task 2.7: Add Multi-Factor Authentication (MFA)
**Estimated Time**: 50 minutes
**Priority**: MEDIUM

### Checklist:
- [ ] Add MFA fields to User model
- [ ] Implement TOTP (Time-based OTP)
- [ ] Create MFA setup endpoint
- [ ] Add MFA verification to login
- [ ] Generate backup codes
- [ ] Test MFA flow

### Implementation:
```javascript
// Add to User schema
security: {
  mfaEnabled: { type: Boolean, default: false },
  mfaSecret: String,
  backupCodes: [String],
  lastLogin: Date
}

// MFA setup
const speakeasy = require('speakeasy');

app.post('/api/auth/setup-mfa', authenticateToken, async (req, res) => {
  const secret = speakeasy.generateSecret({
    name: `IntelliCare (${req.user.email})`,
    issuer: 'IntelliCare'
  });
  
  // Store secret temporarily until verified
  req.user.tempMfaSecret = secret.base32;
  await req.user.save();
  
  res.json({
    qrCode: secret.otpauth_url,
    manualKey: secret.base32
  });
});
```

### Success Criteria:
- [ ] MFA setup works
- [ ] TOTP verification works
- [ ] Backup codes generated
- [ ] Login flow updated

---

## Task 2.8: Create Session Management
**Estimated Time**: 30 minutes
**Priority**: MEDIUM

### Checklist:
- [ ] Track active sessions
- [ ] Implement session timeout
- [ ] Add concurrent session limits
- [ ] Create session revocation
- [ ] Monitor session activity

### Implementation:
```javascript
// Session model
const sessionSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  token: { type: String, required: true, unique: true },
  practiceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Practice' },
  ipAddress: String,
  userAgent: String,
  lastActivity: { type: Date, default: Date.now },
  expiresAt: Date,
  isActive: { type: Boolean, default: true }
});

// Session cleanup middleware
app.use(async (req, res, next) => {
  if (req.user) {
    await Session.updateOne(
      { token: req.token },
      { lastActivity: new Date() }
    );
  }
  next();
});
```

### Success Criteria:
- [ ] Sessions tracked
- [ ] Timeout implemented
- [ ] Revocation works
- [ ] Activity monitored

---

## Completion Checklist

### Before Moving to Next Phase:
- [ ] Multi-tenant JWT tokens working
- [ ] Practice selection implemented
- [ ] Email verification active
- [ ] Password reset functional
- [ ] MFA setup (optional)
- [ ] Session management working
- [ ] All authentication tests passing

### Validation Steps:
1. **Test login with multi-practice user**
2. **Verify practice switching works**
3. **Test email verification flow**
4. **Test password reset flow**
5. **Verify session timeout**
6. **Test concurrent session limits**

### Next Phase:
Once all authentication tasks are complete, proceed to **[03-security-tasks.md](./03-security-tasks.md)**
