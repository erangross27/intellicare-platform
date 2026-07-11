# Task 05: Optimize searchUsers and searchProviders Functions

## Current Issue
- Returns complete user profiles with permissions, settings
- Includes sensitive data like passwords hashes
- Provider profiles include full schedule data

## Location
- File: `services/agentServiceV4.js`
- searchUsers: Line ~29555
- searchProviders: Line ~31640
- getAllUsers, getProviders also affected

## Current Return Structure
```javascript
{
  success: true,
  data: [{
    _id, email, password, /* Security risk! */
    permissions, settings, preferences,
    profile, schedule, patients, ...
  }]
}
```

## Required Optimization
Return public info only:
```javascript
{
  _id: user._id,
  name: user.name || `${user.firstName} ${user.lastName}`,
  role: user.role,
  email: user.email,
  department: user.department,
  status: user.status || 'active'
}
```

## Implementation Steps
1. NEVER return password fields
2. Exclude permissions/settings from lists
3. Return display name and role
4. Add isProvider flag for providers

## Security Benefits
- No sensitive data exposure
- Reduced attack surface
- Faster processing

## Expected Result
- Token reduction: 85%
- Enhanced security
- Cleaner user lists