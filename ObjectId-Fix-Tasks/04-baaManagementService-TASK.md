# Task File: baaManagementService.js
## Total Instances to Fix: 11

### Instance Details

#### baaId instances (string IDs that need conversion)
- [ ] Line 193: `{ _id: baaId, practiceId }` - baaId is a string parameter
- [ ] Line 306: `{ _id: baaId, practiceId }` - Same pattern
- [ ] Line 382: `{ _id: baaId, practiceId }` - Same pattern
- [ ] Line 458: `{ _id: baaId, practiceId }` - Same pattern
- [ ] Line 740: `{ _id: baaId }` - Same pattern

#### baa._id instances (should already be ObjectId)
- [ ] Line 224: `{ _id: baa._id }` - baa object from query, _id should be ObjectId
- [ ] Line 333: `{ _id: baa._id }` - Same
- [ ] Line 411: `{ _id: baa._id }` - Same
- [ ] Line 482: `{ _id: baa._id }` - Same
- [ ] Line 703: `{ _id: baa._id }` - Same
- [ ] Line 750: `{ _id: baa._id }` - Same

### Pattern Analysis
This file has two clear patterns:
1. **baaId** - Always a string parameter that needs ObjectId conversion (5 instances)
2. **baa._id** - From queried objects, should already be ObjectId (6 instances)

### Fix Strategy
1. Add ObjectId import at top
2. Convert baaId to ObjectId before using in queries
3. Verify baa._id is already ObjectId (it should be from the query results)

### Functions Affected
- signBaa()
- updateSignatureStatus()
- addClause()
- removeClause()
- generateBaa()
- terminateBaa()

Each function follows similar pattern:
1. Receives baaId as string parameter
2. Queries for BAA document
3. Updates using baa._id