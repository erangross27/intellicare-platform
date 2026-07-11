# Task 06: Update Server Startup

## Objective
Use master loader in server.js

## File to Update
`backend/server.js`

## Changes
1. Replace individual service loading
2. Use MasterServiceLoader
3. Ensure all services initialized before routes

## Key Section
After core security services initialization

## Success Criteria
- Clean startup sequence
- All services loaded before server starts
- No lazy loading during runtime