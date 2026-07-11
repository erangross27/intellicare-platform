# Task 07: Standard Implementation Pattern

## Universal Pattern for ALL List/Search Functions

### Step 1: Identify Function Type
```javascript
// List functions: Return multiple items
// Search functions: Return filtered items
// Get functions: Return single item (NO CHANGE NEEDED)
```

### Step 2: Apply Standard Transformation
```javascript
// BEFORE
return {
  success: true,
  data: results, // Full objects
  count: results.length
};

// AFTER
return {
  success: true,
  data: results.map(item => this.minimizeForList(item, entityType)),
  count: results.length,
  _metadata: {
    fieldsReturned: 7,
    fieldsOmitted: 43,
    tokenSavings: '95%'
  }
};
```

### Step 3: Create Entity-Specific Minimizers
```javascript
minimizeForList(item, type) {
  switch(type) {
    case 'patient':
      return {
        _id: item._id,
        firstName: item.firstName,
        lastName: item.lastName,
        nationalId: item.nationalId || item.ssn,
        phone: item.phone
      };

    case 'appointment':
      return {
        _id: item._id,
        time: item.scheduledTime,
        patientName: item.patientName,
        type: item.appointmentType,
        status: item.status
      };

    case 'document':
      return {
        _id: item._id,
        title: item.title,
        type: item.documentType,
        date: item.uploadDate,
        size: item.fileSize
      };

    default:
      // Generic minimizer
      return {
        _id: item._id,
        name: item.name || item.title,
        type: item.type,
        date: item.date || item.createdAt,
        status: item.status
      };
  }
}
```

### Step 4: Add Full Data Access Flag
```javascript
// Allow full data when explicitly needed
if (params.fullData === true) {
  return {
    success: true,
    data: results, // Full objects
    warning: 'Full data mode - may cause performance issues'
  };
}
```

### Step 5: Document the Change
```javascript
/**
 * PERFORMANCE OPTIMIZATION (Jan 2025)
 * This function returns minimal data to reduce Claude AI token usage
 * From: 34,095 tokens → To: <1,000 tokens
 * Full data available via params.fullData = true
 */
```

## Testing Pattern
1. Test with minimal data first
2. Verify Claude can still answer questions
3. Add fields only if Claude fails
4. Document any additional fields needed

## Rollback Plan
- Keep original code commented
- Add feature flag if needed
- Monitor Claude accuracy