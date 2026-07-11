# Task File: agentServiceV4.js
## Total Instances to Fix: 39

### Instance Analysis by Source

#### args.patientId instances (Lines 8563-9123)
- [ ] Line 8563: `{ _id: args.patientId }` - args.patientId comes from function parameter, needs ObjectId conversion at function entry
- [ ] Line 8924: `{ _id: args.patientId }` - Same pattern in different function
- [ ] Line 8965: `{ _id: args.patientId }` - Same pattern
- [ ] Line 9030: `{ _id: args.patientId }` - Same pattern
- [ ] Line 9123: `{ _id: args.patientId }` - Same pattern

#### Already Fixed (Line 12073)
- [x] Line 12073: `{ _id: objectId }` - ALREADY FIXED! This one already converts to ObjectId

#### session.pendingDocumentId (Line 12244)
- [ ] Line 12244: `{ _id: session.pendingDocumentId }` - pendingDocumentId from session, trace where it's set

#### patient._id instances (Lines 13566-13682)
- [ ] Line 13566: `{ _id: patient._id }` - patient._id should already be ObjectId if patient was queried properly
- [ ] Line 13682: `{ _id: patient._id }` - Same, verify patient object has ObjectId

#### appointment._id instances (Lines 15055-15520)
- [ ] Line 15055: `{ _id: appointment._id }` - appointment._id should be ObjectId
- [ ] Line 15421: `{ _id: appointment._id }` - Same
- [ ] Line 15520: `{ _id: appointment._id }` - Same

#### providerId instances (Line 15105)
- [ ] Line 15105: `{ _id: providerId }` - providerId is a string, needs conversion

#### providerUser._id (Line 15117)
- [ ] Line 15117: `{ _id: providerUser._id }` - Should already be ObjectId

#### patientId instances (Line 15129)
- [ ] Line 15129: `{ _id: patientId }` - patientId variable needs conversion

#### patient._id (Line 15159)
- [ ] Line 15159: `{ _id: patient._id }` - Should be ObjectId

#### patientUser._id (Line 15179)
- [ ] Line 15179: `{ _id: patientUser._id }` - Should be ObjectId

#### practiceContext.currentUser.id (Lines 16671-16848)
- [ ] Line 16671: `{ _id: practiceContext.currentUser.id }` - currentUser.id is likely a string
- [ ] Line 16761: `{ _id: practiceContext.currentUser.id }` - Same
- [ ] Line 16848: `{ _id: practiceContext.currentUser.id }` - Same

### Remaining 19 instances (need to find)
[To be mapped with full file scan]

### Fix Strategy
1. Group by variable source:
   - args.patientId - Convert at function entry
   - practiceContext.currentUser.id - Convert when setting currentUser
   - Direct string IDs - Convert before query
   - Object._id fields - Verify they're already ObjectIds

2. Add ObjectId import at top (already done)
3. Fix each instance based on its source type