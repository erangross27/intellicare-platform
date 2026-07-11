# Task: Order Lab Test

## Function Details
- **Function Name**: `orderLabTest`
- **Current Status**: ❌ MISSING
- **Priority**: HIGH
- **Estimated Time**: 5 hours

## Problem Description
No lab ordering functionality exists. The agent tries to call lab endpoints but there's no lab route file or service implementation.

## Implementation Steps

### 1. Create Lab Routes File
```javascript
// Create backend/routes/lab.js
const express = require('express');
const router = express.Router();

router.post('/order', async (req, res) => {
  // Implementation
});

// Register in server.js:
app.use('/api/lab', labRoutes);
```

### 2. Create Lab Order Service
```javascript
// backend/services/labOrderService.js
class LabOrderService {
  async createOrder(orderData) {
    // Generate requisition number
    // Store order
    // Send to lab (mock for now)
  }
  
  async getOrderStatus(requisitionNumber) {
    // Check order status
  }
}
```

### 3. Create Lab Order Model
```javascript
// backend/models/LabOrder.js
const labOrderSchema = new Schema({
  requisitionNumber: { type: String, unique: true },
  patientId: String,
  orderDate: Date,
  tests: [{
    code: String,
    name: String,
    category: String,
    specimen: String,
    priority: String
  }],
  status: String,
  results: [{
    testCode: String,
    resultValue: String,
    units: String,
    referenceRange: String,
    flag: String
  }]
});
```

## Required Endpoints
```
POST /api/lab/order
  Body: {
    patientId: string,
    tests: [{
      code: string,      // e.g., "CBC", "BMP", "HbA1c"
      name: string,
      specimen: string,  // "blood", "urine", etc.
      priority: string   // "routine", "stat", "asap"
    }],
    diagnosis: string[],
    fastingRequired: boolean,
    collectionDate: Date,
    notes: string
  }
  
  Response: {
    success: boolean,
    requisitionNumber: string,
    tests: array,
    estimatedTurnaround: string,
    instructions: {
      fasting: boolean,
      preparation: string[]
    },
    barcode: string
  }

GET /api/lab/order/:requisitionNumber
  Response: {
    requisitionNumber: string,
    status: 'ordered' | 'collected' | 'processing' | 'resulted' | 'cancelled',
    orderedAt: Date,
    collectedAt?: Date,
    resultedAt?: Date,
    tests: array
  }

PUT /api/lab/order/:requisitionNumber/collect
  Body: {
    collectedAt: Date,
    collectedBy: string,
    specimenIds: string[]
  }
```

## Common Lab Test Codes
```javascript
const commonTests = {
  'CBC': 'Complete Blood Count',
  'BMP': 'Basic Metabolic Panel',
  'CMP': 'Comprehensive Metabolic Panel',
  'TSH': 'Thyroid Stimulating Hormone',
  'HbA1c': 'Hemoglobin A1c',
  'LIPID': 'Lipid Panel',
  'UA': 'Urinalysis',
  'PT/INR': 'Prothrombin Time',
  'B12': 'Vitamin B12',
  'VITD': 'Vitamin D',
  'PSA': 'Prostate Specific Antigen',
  'CULT': 'Culture and Sensitivity'
};
```

## Data Models Required
```javascript
// LabOrder collection
{
  _id: ObjectId,
  requisitionNumber: String,
  patientId: String,
  patientName: String,
  practiceId: String,
  orderingProvider: {
    id: String,
    name: String,
    npi: String
  },
  orderDate: Date,
  priority: String,
  diagnosis: [String],
  tests: [{
    code: String,
    name: String,
    category: String,
    specimen: String,
    container: String,
    volume: String,
    priority: String,
    instructions: String
  }],
  specimenCollection: {
    required: Boolean,
    fastingRequired: Boolean,
    scheduledDate: Date,
    collectedDate: Date,
    collectedBy: String,
    specimenIds: [String]
  },
  status: String,
  statusHistory: [{
    status: String,
    timestamp: Date,
    user: String
  }],
  lab: {
    name: String,
    id: String,
    accessionNumber: String
  },
  turnaroundTime: String,
  results: [{
    testCode: String,
    testName: String,
    resultValue: String,
    units: String,
    referenceRange: String,
    flag: String, // 'H', 'L', 'C' (critical)
    resultedAt: Date,
    verifiedBy: String,
    comments: String
  }],
  documents: [String],
  notes: String,
  createdAt: Date,
  updatedAt: Date
}
```

## Test Cases
1. **Order Single Test**: Order CBC, verify requisition created
2. **Order Panel**: Order comprehensive panel, verify all tests included
3. **STAT Order**: Mark as STAT, verify priority handling
4. **Fasting Requirements**: Order glucose, verify fasting instructions
5. **Invalid Test Code**: Use unknown code, should return error
6. **Duplicate Order Check**: Prevent duplicate orders for same test same day

## Dependencies
- Patient must exist
- Provider must be authorized
- Test codes should be validated
- Insurance pre-auth may be required for some tests

## Success Criteria
- [ ] Lab order endpoint works
- [ ] Requisition numbers are unique
- [ ] Test codes are validated
- [ ] Instructions are provided based on tests
- [ ] Status tracking works
- [ ] Agent can order labs successfully

## Mock Lab Interface
```javascript
// For testing, auto-generate results after delay
setTimeout(() => {
  // Generate normal results for common tests
  const mockResults = {
    'CBC': {
      WBC: { value: 7.5, units: 'K/uL', range: '4.5-11.0' },
      RBC: { value: 4.8, units: 'M/uL', range: '4.2-5.4' },
      HGB: { value: 14.5, units: 'g/dL', range: '12.0-16.0' },
      HCT: { value: 42, units: '%', range: '36-46' }
    }
  };
}, 30000); // 30 seconds for STAT, 2 hours for routine
```

## Notes
- Start with common lab tests
- Plan for HL7 integration with lab systems
- Consider barcode generation for specimens
- Add critical value alerting
- Include specimen tracking
- Support standing orders