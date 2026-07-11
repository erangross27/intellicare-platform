# 🤖 MANDATORY RULES FOR AI AGENTS - MEDICAL PLATFORM

## 🚨 THESE ARE NOT SUGGESTIONS - THEY ARE REQUIREMENTS

**This is a HIPAA-compliant medical platform handling sensitive patient data.**
**Security violations will cause production deployment failures and compliance violations.**

## ❌ NEVER DO THIS (WILL BE IMMEDIATELY REJECTED):

### 1. Generate Keys/Secrets in Frontend
```javascript
// ❌ WRONG - Anyone can extract from browser
const signingKey = CryptoJS.lib.WordArray.random(256/8);
localStorage.setItem('apiKey', signingKey);
```

### 2. Sign Requests in Frontend  
```javascript
// ❌ WRONG - Meaningless if client has the key
const signature = CryptoJS.HmacSHA256(data, clientKey);
headers['X-Request-Signature'] = signature;
```

### 3. Encrypt Data in Frontend
```javascript
// ❌ WRONG - Fake security, use HTTPS instead
const encrypted = CryptoJS.AES.encrypt(sensitive, clientKey);
```

### 4. Trust Client-Provided Security Headers
```javascript
// ❌ WRONG - Client can forge these
req.headers['x-request-signature']
req.headers['x-request-timestamp']  
req.headers['x-session-fingerprint']
```

### 5. Store Secrets in Browser Storage
```javascript
// ❌ WRONG - Accessible to any script/XSS
localStorage.setItem('token', jwt);
sessionStorage.setItem('secret', key);
```

### 6. Bypass Server Validation
```javascript
// ❌ WRONG - Client validation is meaningless
if (clientValidation.passed) { proceed(); }
```

### 7. Take "Easier" Path Over Secure Path
```javascript
// ❌ WRONG - Convenience over security
// "Let's just skip the validation for now"
// "We can trust the client for this simple check"
// "It's faster to do it client-side"
```

## ✅ ALWAYS DO THIS (ONLY ACCEPTABLE APPROACH):

### 1. Use HttpOnly Cookies for Sessions
```javascript
// ✅ CORRECT - Server-controlled, XSS-safe
res.cookie('sessionToken', token, { 
  httpOnly: true, 
  secure: true, 
  sameSite: 'strict' 
});
```

### 2. Validate Everything Server-Side
```javascript
// ✅ CORRECT - Only server validation matters
async function validateRequest(req) {
  const session = await validateSession(req.cookies.sessionToken);
  const permissions = await checkPermissions(session.userId);
  return { session, permissions };
}
```

### 3. Use CSRF Tokens for Mutations
```javascript
// ✅ CORRECT - Real CSRF protection
if (['POST', 'PUT', 'DELETE'].includes(method)) {
  validateCSRFToken(req.headers['x-csrf-token']);
}
```

### 4. Let HTTPS Handle Transport Encryption
```javascript
// ✅ CORRECT - HTTPS is designed for this
fetch('/api/endpoint', {
  method: 'POST',
  body: JSON.stringify(data), // Plain JSON, HTTPS encrypts
  credentials: 'include'       // Include httpOnly cookies
});
```

### 5. Generate All Tokens Server-Side
```javascript
// ✅ CORRECT - Cryptographically secure
const sessionToken = crypto.randomBytes(32).toString('hex');
const csrfToken = crypto.randomBytes(32).toString('hex');
```

### 6. Audit Log All Security Events
```javascript
// ✅ CORRECT - Complete audit trail
await auditLog.logSecurityEvent({
  type: 'AUTHENTICATION_ATTEMPT',
  userId: session?.userId,
  ip: req.ip,
  timestamp: new Date()
});
```

## 🔍 BEFORE MAKING ANY SECURITY CHANGE:

### Ask Yourself These Questions:
1. **Can a malicious client bypass this?** If yes, move to server
2. **Does this store secrets in the browser?** If yes, use httpOnly cookies
3. **Am I trusting client-provided data?** If yes, validate server-side
4. **Is this the "easy" solution?** If yes, check if it's secure
5. **Would I trust this with my own medical records?** If no, redesign

### The Security Test:
If any of these are true, your approach is WRONG:
- Client has access to encryption keys
- Client generates its own signatures
- Validation logic exists only in JavaScript
- Secrets are stored in localStorage/sessionStorage
- You're trusting data from the client

## 🏥 MEDICAL PLATFORM CONTEXT:

### Why This Matters:
- **Patient Privacy**: HIPAA requires strict data protection
- **Legal Liability**: Security breaches have legal consequences  
- **Professional Trust**: Medical providers trust us with sensitive data
- **Regulatory Compliance**: Must meet healthcare security standards

### Real-World Impact:
- A security breach affects real patients
- Medical data is extremely valuable to attackers
- Healthcare organizations have strict security requirements
- Compliance violations can shut down the platform

## 🚨 RED FLAGS - STOP AND RECONSIDER:

If you find yourself saying/thinking:
- "It's just a simple client-side check"
- "We can encrypt it on the frontend"  
- "Client signing will improve performance"
- "Let's store the key in localStorage for convenience"
- "The client validation is good enough"
- "We can trust the browser for this"

**STOP!** These are signs you're about to implement fake security.

## ✅ GREEN LIGHTS - CORRECT THINKING:

If you find yourself saying/thinking:
- "All validation should happen server-side"
- "Let's use httpOnly cookies for this"
- "HTTPS will handle the encryption"
- "We need to audit log this server-side"
- "Client data cannot be trusted"
- "Security over convenience"

**GO!** This is the correct security mindset.

## 🎯 THE GOLDEN RULE:

**When implementing security for a medical platform:**
**The secure way is the ONLY way - there are no acceptable shortcuts.**

If you're unsure whether something is secure, err on the side of:
1. **Server-side validation** over client-side
2. **Rejecting requests** over accepting them
3. **Logging events** over ignoring them  
4. **Strict permissions** over permissive ones
5. **Explicit allow lists** over implicit trust

---
**Remember: Real patients trust this platform with their most sensitive information.**
**Our security implementation must be worthy of that trust.**