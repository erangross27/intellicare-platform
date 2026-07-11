# MongoDB Replica Set Setup for Windows (Development)

## Steps to Enable Change Streams in Development

### 1. Stop MongoDB Service
Open Command Prompt as Administrator:
```cmd
net stop MongoDB
```

### 2. Create MongoDB Config File
Create `C:\Program Files\MongoDB\Server\8.0\bin\mongod.cfg` with:

```yaml
systemLog:
  destination: file
  path: C:\Program Files\MongoDB\Server\8.0\log\mongod.log
storage:
  dbPath: C:\Program Files\MongoDB\Server\8.0\data
replication:
  replSetName: "rs0"
net:
  port: 27017
  bindIp: 127.0.0.1
```

### 3. Start MongoDB with Replica Set
In Command Prompt as Administrator:
```cmd
cd "C:\Program Files\MongoDB\Server\8.0\bin"
mongod --config mongod.cfg --replSet rs0
```

### 4. Initialize the Replica Set
Open another Command Prompt and run:
```cmd
cd "C:\Program Files\MongoDB\Server\8.0\bin"
mongosh
```

In MongoDB shell:
```javascript
rs.initiate({
  _id: "rs0",
  members: [{ _id: 0, host: "localhost:27017" }]
})
```

### 5. Verify Replica Set Status
```javascript
rs.status()
```

You should see:
- "ok": 1
- Your member should be PRIMARY

### 6. Test Change Streams Work
```javascript
// In mongosh
use intellicare_practice_global
db.watch()
// Should not error - press Ctrl+C to exit watch
```

## Alternative: Quick Development Setup

If you just want a quick replica set for development:

### Option A: Run MongoDB in Docker
```bash
docker run -d --name mongo-replica -p 27017:27017 mongo:8 --replSet rs0
docker exec -it mongo-replica mongosh --eval "rs.initiate()"
```

### Option B: Use Run-RS (Node Package)
```bash
npm install -g run-rs
run-rs --version 8.0.0 --keep --dbpath C:\mongodb-replica-data
```

## Updating Connection String

Once replica set is running, update your `.env` if needed:
```
MONGODB_URI=mongodb://localhost:27017/intellicare?replicaSet=rs0
```

## Restart Your Application

After setting up the replica set:
1. The backend will restart automatically (nodemon)
2. You should see in logs:
   - "✅ MongoDB Change Streams activated"
   - "Watching ALL collections across ALL databases"
3. Cache invalidation will work instantly when data changes!

## Troubleshooting

If you see "not master and slaveOk=false":
```javascript
// In mongosh
rs.slaveOk()
```

If replica set won't initialize:
1. Delete the data directory
2. Start fresh with empty data folder
3. Re-run rs.initiate()

## To Revert Back to Standalone

1. Stop MongoDB
2. Remove `replication:` section from config
3. Start MongoDB normally