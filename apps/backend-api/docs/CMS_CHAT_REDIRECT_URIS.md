# CMS Blue Button Redirect URIs for CHAT Integration

Since IntelliCare does EVERYTHING through the chat interface, we need to handle the OAuth callback differently.

## Redirect URIs to Register:

```
http://localhost:5000/api/chat/medicare-callback
http://localhost:3000/api/chat/medicare-callback
http://localhost:3001/api/chat/medicare-callback
http://127.0.0.1:5000/api/chat/medicare-callback
http://127.0.0.1:3000/api/chat/medicare-callback
http://127.0.0.1:3001/api/chat/medicare-callback
http://intellicare.health:5000/api/chat/medicare-callback
http://intellicare.health:3000/api/chat/medicare-callback
http://intellicare.health:3001/api/chat/medicare-callback
https://intellicare.health/api/chat/medicare-callback
https://www.intellicare.health/api/chat/medicare-callback
https://api.intellicare.health/chat/medicare-callback
https://app.intellicare.health/api/chat/medicare-callback
```

## How It Works in Chat:

1. **User types in chat**: "Connect my Medicare account" or "Get my Medicare data"

2. **AI responds with a link**: 
   ```
   "I'll help you connect your Medicare account. Please click this link to log in with Medicare.gov:
   [Connect Medicare Account]
   ```

3. **User clicks link** → Goes to Medicare.gov login

4. **After login** → Redirects back to `/api/chat/medicare-callback`

5. **Callback handler**:
   - Captures the OAuth code
   - Exchanges for access token
   - Stores in session
   - Redirects back to chat with success message

6. **Chat continues**:
   ```
   "✅ Medicare account connected successfully! I can now access your Medicare data. 
   Would you like me to import your demographics and medical history?"
   ```

## The Flow in the Chat:

```javascript
// When user wants to connect Medicare in chat:
if (message.includes('medicare') || message.includes('connect insurance')) {
  // Generate OAuth URL
  const authUrl = await blueButtonOAuthService.getAuthorizationUrl(
    'http://localhost:5000/api/chat/medicare-callback'
  );
  
  // Return clickable link in chat
  return {
    message: "I'll help you connect your Medicare account to automatically import your medical information.",
    actions: [{
      type: 'link',
      text: 'Connect Medicare Account',
      url: authUrl,
      target: '_blank'
    }]
  };
}

// After successful connection:
if (session.medicareConnected) {
  const patientData = await getMedicareData(session.medicareToken);
  return {
    message: `Great! I've imported your Medicare information:
    
    ✅ Name: ${patientData.name}
    ✅ MBI: ${patientData.mbi}
    ✅ Address: ${patientData.address}
    ✅ Coverage: Medicare Parts ${patientData.coverage}
    ✅ Recent diagnoses: ${patientData.diagnoses.length} conditions
    ✅ Medications: ${patientData.medications.length} active prescriptions
    
    Would you like me to create your patient profile with this information?`
  };
}
```

## Alternative: Embedded OAuth in Chat Modal

We could also do it with a modal/popup within the chat:

```javascript
// In ChatAuthAI component
const handleMedicareConnect = () => {
  // Open popup window
  const width = 600;
  const height = 700;
  const left = (window.innerWidth - width) / 2;
  const top = (window.innerHeight - height) / 2;
  
  const popup = window.open(
    '/api/chat/medicare-auth',
    'Medicare Login',
    `width=${width},height=${height},left=${left},top=${top}`
  );
  
  // Listen for completion
  window.addEventListener('message', (event) => {
    if (event.data.type === 'medicare-connected') {
      popup.close();
      // Continue in chat
      setMessage('Medicare connected! Getting your data...');
      fetchMedicareData();
    }
  });
};
```

## Which Approach?

**Option 1: Full Page Redirect**
- User clicks link → Medicare.gov → Back to chat
- Simpler to implement
- User might lose chat context

**Option 2: Popup Window**
- Chat stays open, Medicare login in popup
- Better UX, keeps context
- Need to handle popup blockers

**Option 3: Iframe (NOT RECOMMENDED)**
- Medicare.gov blocks iframes for security
- Won't work

## For CMS Registration, Use These URIs:

Since we're doing it through chat, register these callback URLs that go through the chat API:

```
http://localhost:5000/api/chat/medicare-callback
http://localhost:3000/api/chat/medicare-callback
http://localhost:3001/api/chat/medicare-callback
http://intellicare.health:5000/api/chat/medicare-callback
http://intellicare.health:3000/api/chat/medicare-callback
http://intellicare.health:3001/api/chat/medicare-callback
https://intellicare.health/api/chat/medicare-callback
```

These are specifically for the CHAT-based OAuth flow!