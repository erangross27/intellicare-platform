# Task 10: Create Helper Utilities

## Utility Functions Needed

### 1. Field Minimizer Utility
```javascript
// services/responseOptimizer.js
class ResponseOptimizer {
  static minimizePatient(patient) {
    return {
      _id: patient._id,
      firstName: patient.firstName,
      lastName: patient.lastName,
      nationalId: patient.nationalId || patient.ssn,
      phone: patient.phone || patient.phoneNumber,
      age: patient.age,
      gender: patient.gender
    };
  }

  static minimizeAppointment(apt) {
    return {
      _id: apt._id,
      time: apt.scheduledTime,
      patientName: apt.patientName,
      type: apt.appointmentType,
      status: apt.status,
      provider: apt.providerName,
      duration: apt.duration || 30
    };
  }

  static minimizeDocument(doc) {
    return {
      _id: doc._id,
      title: doc.title,
      type: doc.documentType,
      date: doc.uploadDate,
      size: doc.fileSize,
      hasAnalysis: !!doc.analysisResult
    };
  }

  static minimizeUser(user) {
    return {
      _id: user._id,
      name: user.name || `${user.firstName} ${user.lastName}`,
      role: user.role,
      email: user.email,
      department: user.department
    };
  }
}
```

### 2. Token Counter Utility
```javascript
// Count tokens before/after optimization
static countTokens(data) {
  const str = JSON.stringify(data);
  // Rough estimate: 1 token ≈ 4 characters
  return Math.ceil(str.length / 4);
}

static logOptimization(before, after, functionName) {
  const beforeTokens = this.countTokens(before);
  const afterTokens = this.countTokens(after);
  const reduction = ((1 - afterTokens/beforeTokens) * 100).toFixed(1);

  console.log(`🎯 ${functionName} Optimization:`);
  console.log(`   Before: ${beforeTokens} tokens`);
  console.log(`   After: ${afterTokens} tokens`);
  console.log(`   Reduction: ${reduction}%`);
}
```

### 3. Batch Optimizer
```javascript
// Optimize arrays of items
static optimizeList(items, type) {
  if (!Array.isArray(items)) return items;

  const optimizer = this[`minimize${type}`];
  if (!optimizer) {
    console.warn(`No optimizer for type: ${type}`);
    return items;
  }

  return items.map(item => optimizer.call(this, item));
}
```

### 4. Context-Aware Fields
```javascript
// Add fields based on context
static addContextFields(item, query, type) {
  const base = this[`minimize${type}`](item);

  // If query mentions specific field, include it
  if (query?.includes('address')) {
    base.address = item.address;
  }
  if (query?.includes('insurance')) {
    base.insurance = item.insurance;
  }

  return base;
}
```

## Implementation Location
Create new file: `services/responseOptimizer.js`

## Usage Pattern
```javascript
const ResponseOptimizer = require('./responseOptimizer');

// In any list function:
const minimalData = ResponseOptimizer.optimizeList(results, 'Patient');
ResponseOptimizer.logOptimization(results, minimalData, 'listAllPatients');

return {
  success: true,
  data: minimalData,
  count: minimalData.length
};
```