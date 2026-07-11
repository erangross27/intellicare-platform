# CMS Blue Button 2.0 Application Registration Details

## Application Registration Form Fields:

### 1. **Application Name**
```
IntelliCare Health Platform
```

### 2. **Application Description**
```
IntelliCare is a comprehensive medical AI platform for healthcare professionals that provides AI-powered diagnosis assistance, patient management, and seamless integration with Medicare data to auto-populate patient demographics, medical history, and insurance information. The platform helps reduce administrative burden and improve patient care quality through intelligent automation.
```

### 3. **Application Type**
```
✅ Confidential (Web Application)
```
(This is for server-side applications that can securely store secrets)

### 4. **Grant Type**
```
✅ Authorization Code
```
(Standard OAuth 2.0 flow for web applications)

### 5. **Redirect URIs** (IMPORTANT - Add ALL of these)
```
http://localhost:5000/api/medicare/auth/callback
http://localhost:3000/api/medicare/auth/callback
http://localhost:3001/api/medicare/auth/callback
http://intellicare.health:5000/api/medicare/auth/callback
http://intellicare.health:3000/api/medicare/auth/callback
https://intellicare.health/api/medicare/auth/callback
https://api.intellicare.health/medicare/auth/callback
https://app.intellicare.health/api/medicare/auth/callback
```

### 6. **Scope** (Select all that apply)
```
✅ profile           - Basic user info
✅ patient/Patient.read       - Demographics
✅ patient/Coverage.read      - Insurance coverage
✅ patient/ExplanationOfBenefit.read - Claims data
```

### 7. **Logo URL** (Optional)
```
https://intellicare.health/logo.png
```
(Or leave blank for now)

### 8. **Website URL**
```
https://intellicare.health
```

### 9. **Terms of Service URL** (Optional)
```
https://intellicare.health/terms
```
(Or leave blank for now)

### 10. **Privacy Policy URL** (Optional)
```
https://intellicare.health/privacy
```
(Or leave blank for now)

### 11. **Support Email**
```
support@intellicare.health
```
(Or use: eran@gross.support)

### 12. **Support Phone** (Optional)
```
+1-555-0100
```
(Or your actual phone)

## After Registration, You'll Get:

1. **Client ID**: Something like `3PeD8gAIr8iUwl0hF3hJkL6WvgVzMvCqdrEG8Bva`
2. **Client Secret**: A long secure string (KEEP THIS SAFE!)

## Store Your Credentials:

Once you have your Client ID and Secret, run this command:

```bash
cd backend
node -e "
const kms = require('./services/productionKMS');
(async () => {
  // Replace with your actual credentials
  await kms.storeInternalKey('BLUE_BUTTON_CLIENT_ID', 'YOUR_CLIENT_ID_HERE');
  await kms.storeInternalKey('BLUE_BUTTON_CLIENT_SECRET', 'YOUR_CLIENT_SECRET_HERE');
  console.log('✅ CMS Blue Button credentials stored successfully!');
  process.exit(0);
})();
"
```

## Test Your Integration:

### 1. Start your backend:
```bash
cd backend && npm run dev
```

### 2. Test the OAuth flow:
Visit: http://localhost:5000/api/medicare/auth/login

This will redirect you to the Medicare sandbox login page.

### 3. Use Test Credentials:
```
Username: BBUser00000
Password: PW00000!
```
(Numbers range from 00000 to 30000)

### 4. Approve Access:
Click "Allow" to grant your app access to the test beneficiary's data

### 5. You'll be redirected back to:
http://localhost:5000/api/medicare/auth/callback

And receive the patient data!

## API Endpoints We Created:

- `GET /api/medicare/auth/login` - Start OAuth flow
- `GET /api/medicare/auth/callback` - Handle OAuth callback
- `GET /api/medicare/patient` - Get patient data after auth
- `POST /api/medicare/auth/logout` - Logout
- `GET /api/medicare/auth/status` - Check auth status

## Testing in Your App:

Add a button in your UI:
```javascript
// In your React component
const handleMedicareConnect = () => {
  window.location.href = '/api/medicare/auth/login';
};

<button onClick={handleMedicareConnect}>
  Connect Medicare Account
</button>
```

## Important Notes:

1. **Sandbox vs Production**: 
   - Sandbox URL: https://sandbox.bluebutton.cms.gov/
   - Production URL: https://bluebutton.cms.gov/
   - Start with sandbox for testing

2. **Rate Limits**:
   - Sandbox: More lenient
   - Production: 15,000 requests per hour

3. **Data Retention**:
   - Store tokens securely (we use encryption)
   - Refresh tokens before expiry
   - Log all access for HIPAA compliance

4. **Production Requirements**:
   - SSL/HTTPS required
   - Privacy policy required
   - Terms of service required
   - HIPAA compliance attestation

## Troubleshooting:

If you get errors:

1. **"Invalid redirect_uri"**: Make sure the callback URL matches EXACTLY
2. **"Invalid client"**: Check Client ID and Secret are correct
3. **"Access denied"**: User didn't approve, or scopes not granted
4. **"Invalid grant"**: Authorization code expired (they expire quickly)

## Need Help?

- CMS Developer Support: https://groups.google.com/g/bluebutton-api
- API Documentation: https://bluebutton.cms.gov/developers/
- Sandbox Testing: https://sandbox.bluebutton.cms.gov/testclient/

Let me know once you've registered and I'll help you test it!