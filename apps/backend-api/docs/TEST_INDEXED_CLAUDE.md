# Testing Claude Indexed Approach

## Quick Setup

### 1. Set Environment Variable
```bash
# In your terminal or add to .env file:
export USE_INDEXED_CLAUDE=true
export CLAUDE_API_KEY=your_claude_key_here

# Or in Windows:
set USE_INDEXED_CLAUDE=true
set CLAUDE_API_KEY=your_claude_key_here
```

### 2. Start the Server
```bash
cd backend
DISABLE_RATE_LIMITS=true USE_INDEXED_CLAUDE=true node server.js
```

### 3. You Should See:
```
🚀 Claude Indexed Agent active - AI selects functions using lightweight index
📊 Example: "show me Eran Gross" = loads only searchPatients & getPatientDetails
💰 Cost: 92% reduction vs loading all functions
```

## Test Cases to Try

### Test 1: View Patient (Should load 2 functions)
```
"Show me patient Eran Gross"
```
Expected: Loads only `searchPatients`, `getPatientDetails`

### Test 2: Add Medical History (Should load 2 functions)
```
"Add that Eran complains about fatigue and trouble sleeping"
```
Expected: Loads only `searchPatients`, `addMedicalHistory`

### Test 3: Update Info (Should load 2 functions)
```
"Update Eran's phone number to 0501234567"
```
Expected: Loads only `searchPatients`, `updatePatient`

### Test 4: Schedule Appointment (Should load 2 functions)
```
"Schedule appointment for Eran tomorrow at 10am"
```
Expected: Loads only `searchPatients`, `scheduleAppointment`

### Test 5: Complex Request (Should load 4-5 functions)
```
"Show Eran's medications and check for interactions"
```
Expected: Loads `searchPatients`, `getMedications`, `checkDrugInteractions`

## What to Look For

### In Console Logs:
```
🎯 Claude selected: searchPatients,getPatientDetails
⚡ Executing: searchPatients
```

### In Response:
- Should work exactly as before
- But cost should be ~₪0.004 instead of ~₪0.045
- Functions loaded: 2-4 instead of 235

## Troubleshooting

### If Not Working:
1. Check `functionIndex.json` exists in backend folder
2. Verify Claude API key is set
3. Check console for error messages

### To Compare Costs:
1. Try same request with `USE_INDEXED_CLAUDE=false` (old way)
2. Try same request with `USE_INDEXED_CLAUDE=true` (new way)
3. Compare token usage in response

## Expected Results

| Request Type | Functions Loaded | Tokens | Cost |
|-------------|-----------------|--------|------|
| View Patient | 2 | ~1,200 | ₪0.004 |
| Add Symptoms | 2 | ~1,200 | ₪0.004 |
| Update Info | 2 | ~1,200 | ₪0.004 |
| Complex | 4-5 | ~1,500 | ₪0.005 |

vs Old Way: 235 functions, 15,000 tokens, ₪0.045

## Success Indicators

✅ Console shows "Claude Indexed Agent active"
✅ Only 2-4 functions loaded per request
✅ Responses work correctly
✅ Cost ~92% lower
✅ No hardcoded keywords used