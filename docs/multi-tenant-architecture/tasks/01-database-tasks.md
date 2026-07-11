# Database Tasks - Phase 1 (UPDATED)

## Overview
Foundation database changes for multi-tenant architecture with **separate database per practice** for ultimate isolation.

## Task 1.1: Create Practice Model
**Estimated Time**: 20 minutes
**Priority**: HIGH

### Checklist:
- [ ] Create `backend/models/Practice.js`
- [ ] Define practice schema with all required fields
- [ ] Add validation rules
- [ ] Add indexes for performance
- [ ] Test model creation and validation

### Implementation:
```javascript
// backend/models/Practice.js
const mongoose = require('mongoose');

const clinicSchema = new mongoose.Schema({
  name: { type: String, required: true },
  subdomain: { type: String, required: true, unique: true },
  status: { type: String, enum: ['active', 'suspended', 'trial'], default: 'trial' },
  // ... rest of schema
});

module.exports = mongoose.model('Practice', clinicSchema);
```

### Success Criteria:
- [ ] Model file created
- [ ] Schema validation works
- [ ] Indexes created
- [ ] Basic CRUD operations work

---

## Task 1.2: Create Database Connection Factory
**Estimated Time**: 30 minutes
**Priority**: HIGH

### Checklist:
- [ ] Create database connection factory for practice-specific databases
- [ ] Implement global database connection for practice registry
- [ ] Add database naming conventions
- [ ] Create connection pooling per practice
- [ ] Test database connections

### Implementation:
```javascript
// utils/databaseFactory.js
const mongoose = require('mongoose');

class DatabaseFactory {
  constructor() {
    this.connections = new Map();
    this.globalConnection = null;
  }

  // Get global database connection
  async getGlobalDatabase() {
    if (!this.globalConnection) {
      this.globalConnection = await mongoose.createConnection(
        process.env.MONGODB_URI,
        { dbName: 'intellicare_global' }
      );
    }
    return this.globalConnection;
  }

  // Get practice-specific database connection
  async getClinicDatabase(practiceSubdomain) {
    const dbName = `intellicare_practice_${practiceSubdomain}`;

    if (!this.connections.has(dbName)) {
      const connection = await mongoose.createConnection(
        process.env.MONGODB_URI,
        { dbName }
      );
      this.connections.set(dbName, connection);
    }

    return this.connections.get(dbName);
  }
}

module.exports = new DatabaseFactory();
```

### Success Criteria:
- [ ] Database factory created
- [ ] Global connection works
- [ ] Practice connections work
- [ ] Connection pooling implemented

---

## Task 1.3: Update Patient Model for Per-Database Architecture
**Estimated Time**: 25 minutes
**Priority**: HIGH

### Checklist:
- [ ] Remove practiceId field from Patient schema (not needed with separate databases)
- [ ] Update Patient model to work with practice-specific databases
- [ ] Create patient model factory function
- [ ] Add practice-specific patient ID generation
- [ ] Test patient operations per practice database

### Implementation:
```javascript
// Remove practiceId from Patient schema - not needed with separate databases
const PatientSchema = new mongoose.Schema({
  patientId: {
    type: String,
    required: true,
    unique: true // Unique within practice database
  },
  // Based on docs/multi-tenant-architecture/04-database-design.md
  name: { type: String, required: true },
  age: { type: Number, required: true },
  gender: { type: String, required: true },
  email: String,
  phone: String,
  identification: {
    type: { type: String, enum: ['israeli_id', 'us_ssn', 'uk_nhs', 'canadian_sin', 'passport', 'other'], required: true },
    number: { type: String, required: true },
    country: { type: String, required: true }
  },
  medicalHistory: [{
    date: Date,
    diagnosis: String,
    symptoms: String,
    treatment: String,
    notes: String,
    category: String
  }]
});

// Create patient model factory
function createPatientModel(practiceDatabase) {
  return practiceDatabase.model('Patient', PatientSchema);
}
```

### Success Criteria:
- [ ] practiceId field removed
- [ ] Patient model factory created
- [ ] Practice-specific operations work
- [ ] Patient ID generation per practice

---

## Task 1.4: Update User Model for Per-Database Architecture
**Estimated Time**: 30 minutes
**Priority**: HIGH

### Checklist:
- [ ] Remove practice membership array from User schema
- [ ] Update User model for practice-specific databases
- [ ] Create user model factory function
- [ ] Add practice-specific role management
- [ ] Test user operations per practice database

### Implementation:
```javascript
// User schema for practice-specific databases (based on docs/multi-tenant-architecture/04-database-design.md)
const UserSchema = new mongoose.Schema({
  email: { type: String, required: true, unique: true },
  passwordHash: { type: String, required: true },
  profile: {
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    title: String, // "Dr.", "RN", "LPN"
    phone: String
  },
  // Roles are now practice-specific (no need for practice array with separate databases)
  roles: [{ type: String, enum: ['doctor', 'nurse', 'admin', 'receptionist', 'technician'] }],
  permissions: [{ type: String, enum: ['read_patients', 'write_patients', 'delete_patients', 'read_documents', 'write_documents', 'delete_documents', 'manage_users', 'view_reports', 'system_admin'] }],
  status: { type: String, enum: ['active', 'inactive', 'pending', 'suspended'], default: 'active' },
  preferredLanguage: { type: String, default: 'en', enum: ['en', 'he'] },
  lastLogin: Date,
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
});

// Create user model factory
function createUserModel(practiceDatabase) {
  return practiceDatabase.model('User', UserSchema);
}
```

### Success Criteria:
- [ ] Practice array removed from User schema
- [ ] User model factory created
- [ ] Practice-specific role management
- [ ] User operations work per practice

---

## Task 1.5: Add Tenant Isolation Middleware
**Estimated Time**: 30 minutes
**Priority**: HIGH

### Checklist:
- [ ] Create tenant isolation middleware
- [ ] Automatically inject practiceId in queries
- [ ] Validate tenant access on all requests
- [ ] Add error handling for cross-tenant access
- [ ] Test with multiple tenants

### Implementation:
```javascript
// middleware/tenantIsolation.js
function tenantIsolation(req, res, next) {
  // Extract practice context from user
  req.practiceId = req.user.currentClinicId;
  
  // Validate tenant access
  if (!req.practiceId) {
    return res.status(403).json({ error: 'No practice context' });
  }
  
  next();
}
```

### Success Criteria:
- [ ] Middleware created
- [ ] Automatic practiceId injection
- [ ] Cross-tenant access blocked
- [ ] Error handling works

---

## Task 1.6: Update Database Indexes
**Estimated Time**: 20 minutes
**Priority**: MEDIUM

### Checklist:
- [ ] Add practiceId indexes to all collections
- [ ] Create compound indexes for common queries
- [ ] Remove old indexes that don't include practiceId
- [ ] Test query performance
- [ ] Monitor index usage

### Implementation:
```javascript
// Add to all collections
db.patients.createIndex({ "practiceId": 1 });
db.documents.createIndex({ "practiceId": 1 });
db.auditLogs.createIndex({ "practiceId": 1, "timestamp": -1 });

// Compound indexes
db.patients.createIndex({ "practiceId": 1, "personalInfo.lastName": 1 });
```

### Success Criteria:
- [ ] All indexes created
- [ ] Query performance maintained
- [ ] Index usage monitored
- [ ] Old indexes removed

---

## Task 1.7: Create Database Validation Rules
**Estimated Time**: 25 minutes
**Priority**: MEDIUM

### Checklist:
- [ ] Add schema validation for required fields
- [ ] Create custom validators for business rules
- [ ] Add data integrity checks
- [ ] Test validation with invalid data
- [ ] Document validation rules

### Implementation:
```javascript
// Custom validators
clinicSchema.pre('save', function(next) {
  // Validate subdomain format
  if (!/^[a-z0-9-]+$/.test(this.subdomain)) {
    next(new Error('Invalid subdomain format'));
  }
  next();
});
```

### Success Criteria:
- [ ] Validation rules added
- [ ] Invalid data rejected
- [ ] Error messages clear
- [ ] Documentation updated

---

## Task 1.8: Test Tenant Isolation
**Estimated Time**: 35 minutes
**Priority**: HIGH

### Checklist:
- [ ] Create test practices and users
- [ ] Test cross-tenant data access prevention
- [ ] Verify query filtering works
- [ ] Test API endpoints with different tenants
- [ ] Create automated tests for isolation

### Implementation:
```javascript
// Test tenant isolation
describe('Tenant Isolation', () => {
  it('should prevent cross-tenant patient access', async () => {
    const clinic1User = await createTestUser('clinic1');
    const clinic2Patient = await createTestPatient('clinic2');
    
    const result = await Patient.find({ 
      practiceId: clinic1User.practiceId 
    });
    
    expect(result).not.toContain(clinic2Patient);
  });
});
```

### Success Criteria:
- [ ] Cross-tenant access blocked
- [ ] All queries filtered by practice
- [ ] API endpoints secure
- [ ] Automated tests pass

---

## Completion Checklist

### Before Moving to Next Phase:
- [ ] All database models updated
- [ ] Data migration completed successfully
- [ ] Tenant isolation verified
- [ ] Performance benchmarks met
- [ ] All tests passing
- [ ] Code reviewed and documented

### Validation Steps:
1. **Create two test practices**
2. **Add users to each practice**
3. **Add patients to each practice**
4. **Verify users can only see their practice's patients**
5. **Test all API endpoints with tenant isolation**
6. **Run performance tests**

### Next Phase:
Once all database tasks are complete, proceed to **[02-authentication-tasks.md](./02-authentication-tasks.md)**
