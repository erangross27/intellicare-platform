# Task 02: Create Service Proxy Manager

## Objective
Create a proxy system to break circular dependencies

## File to Create
`backend/services/serviceProxyManager.js`

## Structure
```javascript
class ServiceProxyManager {
  createProxy(servicePath) {
    // Returns proxy that loads service on first use
  }
}
```

## Success Criteria
- Proxy manager created
- Can lazy-load services without circular deps