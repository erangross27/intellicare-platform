# Medicare Patient Registration Workflow

## ❌ What Does NOT Work:
- **Cannot lookup by SSN** - CMS doesn't provide SSN-to-MBI API
- **Cannot get data without patient login** - Patient must authenticate with Medicare.gov
- **Cannot auto-populate without patient consent** - HIPAA requires explicit authorization

## ✅ What DOES Work:

### Option 1: Patient Self-Registration (BEST)
When a NEW patient comes to your practice:

1. **Receptionist/Doctor in Chat**: 
   "I'm adding a new patient. They have Medicare."

2. **AI Responds**:
   "I'll help register this Medicare patient. Please have them:
   1. Sit at the computer/tablet
   2. Click this link to connect their Medicare account
   [Connect Medicare Account - Patient Login Required]"

3. **Patient Logs In**:
   - Patient clicks link
   - Logs into Medicare.gov with THEIR credentials
   - Approves data sharing

4. **Auto-Population**:
   ```javascript
   // After successful Medicare login:
   {
     firstName: "John",
     lastName: "Smith", 
     dateOfBirth: "1945-03-15",
     mbi: "1AA2CC3DD45",
     ssn: null, // NOT provided by Medicare for security
     address: {
       street: "123 Main St",
       city: "New York",
       state: "NY",
       zipCode: "10001"
     },
     phone: "212-555-0100",
     insuranceProvider: "Medicare",
     medicarePartA: true,
     medicarePartB: true,
     medicarePartD: "SilverScript",
     diagnoses: ["Hypertension", "Diabetes Type 2"],
     medications: ["Metformin", "Lisinopril"],
     providers: ["Dr. Johnson - Cardiologist"]
   }
   ```

### Option 2: Manual Entry + Verification
If patient can't/won't log into Medicare:

1. **Manual Entry**:
   - Staff enters: Name, DOB, SSN, Address
   - System saves as "Unverified"

2. **Later Verification**:
   - Send patient email/SMS with Medicare login link
   - They complete at home
   - Data gets updated/verified

### Option 3: Commercial MBI Lookup Services (COSTS MONEY)
Services that CAN do SSN-to-MBI lookup:

1. **Availity** (https://www.availity.com)
   - Real-time eligibility
   - SSN → MBI lookup
   - ~$0.25-$1.00 per lookup
   - Requires provider account

2. **Change Healthcare** 
   - SSN-based eligibility
   - Returns MBI + coverage
   - Pricing varies by volume

3. **Stedi** (https://www.stedi.com)
   - Modern API
   - SSN → MBI lookup
   - $0.30 per eligibility check
   - Easy integration

4. **Experian Health**
   - Patient identity verification
   - SSN validation + MBI lookup
   - Enterprise pricing

## RECOMMENDED WORKFLOW FOR YOUR PRACTICE:

### For NEW Patients:

```javascript
// In your chat when adding new patient:

if (country === 'USA' && age >= 65) {
  return {
    message: `I'll help you register this Medicare patient. We have two options:
    
    Option 1: Quick Auto-Import (Recommended)
    - Have the patient log into their Medicare account
    - All their information will be imported automatically
    - Takes 2 minutes
    
    Option 2: Manual Entry
    - You enter their information manually
    - We'll verify with Medicare later
    
    Which would you prefer?`,
    
    actions: [
      {
        type: 'button',
        text: 'Patient Medicare Login',
        action: 'medicare_connect'
      },
      {
        type: 'button', 
        text: 'Manual Entry',
        action: 'manual_patient_entry'
      }
    ]
  };
}
```

### If They Choose Medicare Login:

1. **Generate tablet/phone friendly link**:
   ```javascript
   const authUrl = await getMedicareAuthUrl();
   
   return {
     message: `Please have the patient:
     1. Scan this QR code with their phone, OR
     2. Click this link on the tablet
     
     They'll log in with their Medicare.gov account.`,
     
     qrCode: generateQR(authUrl),
     link: authUrl
   };
   ```

2. **Patient logs in on their device**

3. **Real-time update in your chat**:
   ```javascript
   // WebSocket or polling for completion
   onMedicareConnected((patientData) => {
     showMessage(`✅ Patient imported successfully!
     
     Name: ${patientData.name}
     MBI: ${patientData.mbi}
     DOB: ${patientData.dateOfBirth}
     Address: ${patientData.address}
     
     Creating patient record...`);
   });
   ```

## WHAT YOU ACTUALLY NEED:

### For Medicare Blue Button:
- **Patient must login** - No way around this
- **We get**: Name, DOB, Address, MBI, Coverage, Claims
- **We DON'T get**: SSN (for security)

### For SSN Verification (separate service):
- Use SSA eCBSV (we implemented this)
- Verifies SSN is valid
- Does NOT provide medical data

### For Commercial Insurance:
- Each insurer has different process
- Most require member ID + DOB
- Some have provider portals

## THE BOTTOM LINE:

**You CANNOT automatically get Medicare data with just SSN + DOB**

You need EITHER:
1. **Patient to log in** (free, instant, complete data)
2. **Commercial service** (costs money, instant)
3. **Manual entry** (free, error-prone, no verification)

## Suggested Implementation:

```javascript
// Add to agentServiceV4.js
{
  name: "initiateMedicareImport",
  description: "Start Medicare data import for new patient registration",
  parameters: {
    type: "object",
    properties: {
      registrationType: {
        type: "string",
        enum: ["patient_login", "manual_entry", "commercial_lookup"],
        description: "How to register the patient"
      }
    }
  },
  handler: async (params) => {
    switch(params.registrationType) {
      case 'patient_login':
        // Generate Medicare OAuth URL
        const authUrl = await getMedicareAuthUrl();
        return {
          type: 'medicare_auth',
          url: authUrl,
          message: 'Have patient scan QR code or click link'
        };
        
      case 'commercial_lookup':
        // Use Stedi or other service (requires their API key)
        return {
          type: 'need_commercial_service',
          message: 'Commercial lookup requires Stedi/Availity account'
        };
        
      case 'manual_entry':
        // Proceed with manual form
        return {
          type: 'manual_form',
          fields: ['firstName', 'lastName', 'ssn', 'dateOfBirth', 'address']
        };
    }
  }
}
```

## Do You Want To:

1. **Use free Medicare login** (patient must authenticate)
2. **Pay for commercial service** (Stedi is easiest - $0.30/lookup)
3. **Manual entry only** (no auto-population)

Let me know which approach you want to implement!