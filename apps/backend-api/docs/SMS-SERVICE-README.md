# SMS Service Configuration Guide

## 🔒 Current Status: DISABLED
The SMS service is configured but **DISABLED by default** to prevent accidental messages.

## ✅ What's Configured:
1. **Twilio Credentials** - Stored encrypted in KMS:
   - Account SID: `AC<REDACTED>`
   - Auth Token: [ENCRYPTED]
   - Phone Number: `+12513068242`
   - Messaging Service: `MGa029002538e40e8dff93c79819a29907` (My New Notifications Service)

2. **Safety Features Implemented**:
   - ⛔ **Master Kill Switch** - SMS_ENABLED=false prevents ALL SMS sending
   - 🧪 **Test Mode** - Logs messages without sending in development
   - ⏱️ **5-minute startup delay** - No SMS on server restart
   - 🚫 **Test number blocking** - Common test numbers are blocked
   - 📱 **Clear status messages** - Shows SMS status on server startup

## 📋 Simple Commands (No Parameters to Remember):

### Check Status:
```bash
node scripts/check-sms-status.js
```

### Enable SMS (When Ready):
```bash
node scripts/enable-sms.js
# Requires typing "YES ENABLE SMS" to confirm
```

### Disable SMS (Immediate):
```bash
node scripts/disable-sms.js
# Disables immediately, no confirmation needed
```

### Test Without Sending:
```bash
node test-twilio-sms.js
# Will show "SMS SERVICE DISABLED" message
```

### Test Direct Twilio Connection:
```bash
node test-twilio-direct.js +1234567890
# Bypasses all safety checks - USE WITH CAUTION
```

## 🛡️ How It Works:

### When DISABLED (Current State):
- Server shows: `⛔ SMS SERVICE DISABLED`
- No SMS sent to any number
- All SMS operations return error
- Reminder service skips SMS
- Safe for testing with fake data

### When ENABLED:
- Server shows: `✅ SMS SERVICE ENABLED`
- Real SMS sent via Twilio
- Charges apply to your Twilio account
- Only enable when ready for production

## 📝 Before Enabling SMS:

1. **Sign BAA with Twilio** for HIPAA compliance
2. **Configure webhooks** in Twilio console:
   - Status: `https://intellicare.health/api/sms/status`
   - Incoming: `https://intellicare.health/api/sms/incoming`
3. **Verify patient phone numbers** are correct
4. **Test with your own phone** first

## 🚨 Important Notes:

- **NO SMS will be sent** until you run `enable-sms.js`
- Reminder service waits 5 minutes before checking appointments
- Test numbers are automatically blocked for safety
- Server restart is NOT required after enable/disable

## 🔧 Troubleshooting:

If SMS not working after enabling:
1. Check status: `node scripts/check-sms-status.js`
2. Verify Twilio credentials in KMS
3. Check server logs for error messages
4. Ensure patient has `smsReminders: true` in preferences

## 📞 Support:
- Twilio Console: https://console.twilio.com
- HIPAA BAA: https://www.twilio.com/en-us/hipaa
- Messaging Service: View in Twilio Console > Messaging > Services

---
Last Updated: December 2024
Status: Configured but DISABLED for safety