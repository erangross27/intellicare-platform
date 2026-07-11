# 🔐 MONGODB DATABASE CREATION LOCKDOWN

## THE PROBLEM
**MongoDB automatically creates databases on first write** - this is a HUGE security hole!
- Any script with connection string can create `intellicare_practice_hacker`
- Our 10 security layers are bypassed completely
- MongoDB doesn't ask permission - it just creates!

## ❌ WHAT DOESN'T WORK
- Application-level guards (can be bypassed)
- SecureDataAccess checks (only for our code)
- Service authentication (doesn't stop direct MongoDB access)

## ✅ REAL SOLUTIONS - MONGODB SERVER LEVEL

### Solution 1: CREATE RESTRICTED MONGODB USER (IMMEDIATE FIX)
```javascript
// Connect to MongoDB as admin
use admin

// Create a restricted user for the application
db.createUser({
  user: "intellicare_app",
  pwd: "CHANGE_THIS_STRONG_PASSWORD_NOW",
  roles: [
    {
      role: "readWrite",
      db: "intellicare_practice_global"
    },
    // Add each legitimate practice database explicitly
    {
      role: "readWrite",
      db: "intellicare_practice_testclinic"
    }
    // NO dbAdminAnyDatabase or dbOwner roles!
  ]
})

// REMOVE dangerous roles from existing user
db.revokeRolesFromUser("intellicare_app", [
  { role: "dbAdminAnyDatabase", db: "admin" },
  { role: "userAdminAnyDatabase", db: "admin" },
  { role: "clusterAdmin", db: "admin" }
])
```

### Solution 2: CREATE CUSTOM ROLE WITHOUT DATABASE CREATION
```javascript
use admin

// Create custom role that CANNOT create databases
db.createRole({
  role: "intellicareAppRole",
  privileges: [
    {
      resource: { db: "intellicare_practice_global", collection: "" },
      actions: ["find", "insert", "update", "remove", "createIndex"]
      // NOTE: No "createCollection" or "createDatabase" actions!
    }
  ],
  roles: []
})

// Assign this role to app user
db.grantRolesToUser("intellicare_app", [
  { role: "intellicareAppRole", db: "admin" }
])
```

### Solution 3: MONGODB AUTHENTICATION REQUIRED
```yaml
# mongod.conf - ENFORCE AUTHENTICATION
security:
  authorization: enabled  # This MUST be enabled!
  javascriptEnabled: false  # Disable JS execution

net:
  bindIp: 127.0.0.1  # Only local connections
  port: 27017

# Disable automatic database creation
setParameter:
  authenticationMechanisms: SCRAM-SHA-256
```

### Solution 4: CONNECTION STRING ENFORCEMENT
```javascript
// OLD - DANGEROUS (full admin access)
MONGODB_URI=mongodb://localhost:27017

// NEW - RESTRICTED (specific user with limited permissions)
MONGODB_URI=mongodb://intellicare_app:<DB_PASSWORD>@localhost:27017/intellicare_practice_global?authSource=admin&authMechanism=SCRAM-SHA-256
```

### Solution 5: IMPLEMENT MONGODB CHANGE STREAM MONITORING
```javascript
// Monitor for unauthorized database creation attempts
const MongoClient = require('mongodb').MongoClient;

async function monitorDatabaseCreation() {
  const client = await MongoClient.connect('mongodb://admin_monitor:<DB_PASSWORD>@localhost:27017');
  const admin = client.db('admin');

  // Watch for database/collection creation
  const changeStream = admin.watch([
    { $match: {
      operationType: { $in: ['create', 'createCollection'] }
    }}
  ], { fullDocument: 'updateLookup' });

  changeStream.on('change', (change) => {
    console.error('🚨 UNAUTHORIZED DATABASE OPERATION:', change);
    // Send alert, block user, etc.
  });
}
```

## 🚨 IMMEDIATE ACTIONS REQUIRED

### Step 1: Check Current MongoDB Setup
```bash
# Check if authentication is enabled
mongo --eval "db.runCommand({connectionStatus: 1})"

# If this works WITHOUT password, you have NO security!
mongo --eval "db.getMongo().getDBNames()"
```

### Step 2: Enable MongoDB Authentication
```bash
# 1. Create admin user first
mongo
> use admin
> db.createUser({
    user: "adminUser",
    pwd: "STRONG_ADMIN_PASSWORD",
    roles: ["root"]
  })

# 2. Restart MongoDB with auth enabled
# Windows:
net stop MongoDB
mongod --auth --config "C:\Program Files\MongoDB\Server\5.0\bin\mongod.cfg"
net start MongoDB

# 3. Create restricted app user (see above)
```

### Step 3: Update Application Connection
```javascript
// .env file
MONGODB_URI=mongodb://intellicare_app:<DB_PASSWORD>@localhost:27017/intellicare_practice_global?authSource=admin
MONGODB_ADMIN_URI=mongodb://adminUser:<DB_PASSWORD>@localhost:27017/admin?authSource=admin
```

### Step 4: Add Database Creation Whitelist
```javascript
// services/databaseSecurity.js
class DatabaseSecurity {
  static async createPracticeDatabase(subdomain, adminConnection) {
    // ONLY this function can create new databases
    // Requires admin connection
    // Validates subdomain
    // Creates database with proper permissions
    // Logs creation event

    if (!this.isValidSubdomain(subdomain)) {
      throw new Error('Invalid subdomain');
    }

    // Create database
    const db = adminConnection.db(`intellicare_practice_${subdomain}`);

    // Grant app user access to new database
    await adminConnection.db('admin').command({
      grantRolesToUser: "intellicare_app",
      roles: [{ role: "readWrite", db: `intellicare_practice_${subdomain}` }]
    });

    return db;
  }
}
```

## 🔴 CRITICAL: Current Security Status

### WITHOUT MongoDB Authentication:
- ❌ **ANY** script can create databases
- ❌ **ANY** connection can read all data
- ❌ **ANY** process can delete everything
- ❌ Our security layers are **USELESS**

### WITH MongoDB Authentication + Restricted Roles:
- ✅ Only admin can create databases
- ✅ App user can only access whitelisted databases
- ✅ Database creation requires explicit admin action
- ✅ Unauthorized attempts are blocked at MongoDB level

## Testing Database Security
```javascript
// Try to create unauthorized database (should FAIL)
const mongoose = require('mongoose');
const conn = await mongoose.createConnection(
  'mongodb://intellicare_app:<DB_PASSWORD>@localhost:27017/intellicare_practice_hacker'
);

// This should throw permission error:
await conn.db.collection('test').insertOne({ hack: 'attempt' });
// MongoError: not authorized on intellicare_practice_hacker to execute command

// Only works for authorized databases:
const conn2 = await mongoose.createConnection(
  'mongodb://intellicare_app:<DB_PASSWORD>@localhost:27017/intellicare_practice_global'
);
await conn2.db.collection('test').insertOne({ valid: 'data' }); // Works
```

## Summary
**The ONLY real solution is MongoDB-level authentication and authorization.**
- Application-level security can be bypassed
- MongoDB must enforce who can create databases
- Use restricted users with specific database access
- Never use admin or root users in application code

Without this, someone could literally run:
```javascript
// This currently WORKS and creates a database!
mongoose.connect('mongodb://localhost:27017/intellicare_practice_evil')
  .then(conn => conn.collection('data').insertOne({ stolen: 'everything' }))
```

**This must be fixed at MongoDB server configuration level, not application code!**