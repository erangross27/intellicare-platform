# 🚨 Mock Code That Needs Real Implementation

## Frontend Mock Code

### 1. ❌ **AddressAutocomplete.js** - Mock Address Data
**Location**: `frontend-vite/src/components/AddressAutocomplete.js`
- **Lines 34-389**: Contains hardcoded mock addresses for Israel and US
- **Issue**: Should use real address API (Google Places, MapBox, or Israeli postal service)
- **Priority**: MEDIUM - Affects patient registration accuracy

```javascript
// Current: Mock addresses
const mockAddresses = useMemo(() => ({
  'Israel': [
    { street: 'רחוב דיזנגוף 1', city: 'תל אביב-יפו', ... }
    // ... hardcoded addresses
  ],
  'United States': [
    { street: '123 Main St', city: 'New York', ... }
    // ... hardcoded addresses
  ]
}));

// Should be: Real API calls
const searchAddresses = async (query) => {
  const response = await fetch(`/api/address/search?q=${query}`);
  return response.json();
};
```

## Backend Mock Code

### 2. ❌ **agentServiceV4.js** - Mock Appointments
**Location**: `backend/services/agentServiceV4.js`
- **Lines 4660-4684**: Returns fake appointment data
- **Issue**: No real Appointment model or database operations
- **Priority**: HIGH - Core functionality missing

```javascript
// Current: Mock appointments
case 'appointments':
  // For now, return mock data as appointments might not have a model yet
  if (method === 'POST') {
    return {
      success: true,
      data: {
        id: `apt_${Date.now()}`,
        ...data,
        status: 'scheduled'
      }
    };
  }

// Should be: Real database operations
case 'appointments':
  const Appointment = practiceContext.models.Appointment;
  if (method === 'POST') {
    const appointment = await Appointment.create(data);
    return { success: true, data: appointment };
  }
```

### 3. ⚠️ **threatIntelligenceService.js** - Mock Threat Feed
**Location**: `backend/services/threatIntelligenceService.js`
- **Lines 66-225**: Contains mock threat feed for testing
- **Issue**: Should connect to real threat intelligence feeds
- **Priority**: LOW - Security enhancement, not blocking core functionality

```javascript
// Current: Mock threat feed
this.threatFeeds.set('mock_feed', {
  name: 'Mock Threat Feed',
  url: 'internal://mock',
  ...
});

// Should integrate with real threat feeds like:
// - OTX (Open Threat Exchange)
// - AbuseIPDB
// - VirusTotal API
```

### 4. ⚠️ **improvedOcrService.js** - Fake Text Generation Warning
**Location**: `backend/services/improvedOcrService.js`
- **Lines 638-649**: Has guards against fake text generation
- **Issue**: Already properly implemented with Tesseract OCR
- **Priority**: NONE - Just warning messages, OCR works correctly

## Summary of Required Actions

### 🔴 **HIGH Priority** (Blocking core functionality):
1. **Appointment System**: Create real Appointment model and database operations
   - Create `backend/models/Appointment.js`
   - Add appointment CRUD operations
   - Remove mock data from agentServiceV4.js

### 🟡 **MEDIUM Priority** (Degraded user experience):
2. **Address Autocomplete**: Integrate real address API
   - Option 1: Google Places API (paid)
   - Option 2: MapBox Geocoding API (free tier available)
   - Option 3: Israeli Postal Service API for Israeli addresses
   - Option 4: OpenStreetMap Nominatim (free, open source)

### 🟢 **LOW Priority** (Nice to have):
3. **Threat Intelligence**: Connect to real threat feeds
   - Integrate with actual threat intelligence providers
   - Keep mock feed as fallback for testing

## Implementation Order

1. **Fix Appointments** (1-2 days)
   - Create Appointment model
   - Update agentServiceV4.js
   - Test appointment CRUD operations

2. **Real Address API** (1 day)
   - Choose and integrate address provider
   - Update AddressAutocomplete component
   - Add API key management

3. **Threat Intelligence** (Optional, 1 day)
   - Research available free threat feeds
   - Integrate 1-2 real feeds
   - Keep mock as fallback

## Notes
- ChatContainer and main chat functionality use REAL APIs ✅
- Authentication system uses REAL database ✅
- Patient management uses REAL database ✅
- Document analysis uses REAL OCR (Tesseract) ✅
- AI agent uses REAL Gemini API ✅