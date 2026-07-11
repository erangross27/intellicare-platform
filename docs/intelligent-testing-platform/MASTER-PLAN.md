# IntelliCare Two-Agent Testing Platform - Master Plan

## 🎯 Main Goal
Build a testing system where TWO Claude AI instances have REAL conversations to test all 428 IntelliCare medical functions and find backend bugs.

## 🔑 Key Discovery
- **Claude** (not Gemini) executes ALL 428 functions via `agentServiceClaude.js`
- Bugs only appear when functions are ACTUALLY executed
- Previous attempts failed because they used scripts instead of real AI conversation

## 📂 What We've Created So Far
1. ✅ **README.md** - Overview and mission statement
2. ✅ **01-ARCHITECTURE.md** - Technical design of two-agent system
3. ✅ **02-TASK-BREAKDOWN.md** - 30 small tasks (5-10 minutes each)

## 📋 What Still Needs to Be Done

### Documentation (3 more files)
- [ ] **03-SYSTEM-PROMPTS.md** - Detailed prompts for test agent personas (doctor/nurse/secretary)
- [ ] **04-IMPLEMENTATION-GUIDE.md** - Step-by-step coding instructions
- [ ] **05-FUNCTION-CATALOG.md** - Reference for all 428 functions
- [ ] **06-BUG-PATTERNS.md** - Common bugs to detect

### Code Implementation
- [ ] **Test Agent Class** - Claude instance that acts as medical professional
- [ ] **Communication Layer** - HTTP calls to IntelliCare agent
- [ ] **Bug Detector** - Identifies errors in conversations
- [ ] **Conversation Logger** - Saves all interactions
- [ ] **Progress Tracker** - Monitors testing status
- [ ] **Minimal POC** - Test single function (e.g., addPatient)

## 🏗️ Architecture Summary
```
Test Agent (Claude #1)  <---> IntelliCare Agent (existing Claude service)
- Different system prompts
- Natural conversation
- 10-20 second response times
- Real function execution
- Automatic bug detection
```

## 🚀 Next Steps When You Return

1. **Complete Documentation**
   - Write remaining 4 documentation files
   - Especially system prompts and implementation guide

2. **Build Minimal POC**
   - Create `TestAgent.js` class
   - Test one function (searchPatients or addPatient)
   - Verify real conversation works

3. **Expand Testing**
   - Add more personas
   - Test more functions
   - Build bug reporting

## 💡 Critical Success Factors
- **NO SCRIPTS** - Real AI conversation only
- **PATIENCE** - Wait 10-20 seconds for responses
- **BOTH AGENTS KNOW ALL FUNCTIONS** - Shared knowledge base
- **DIFFERENT SYSTEM PROMPTS** - Test agent vs IntelliCare agent
- **ACTUAL FUNCTION EXECUTION** - Not just UI testing

## 📊 Success Metrics
- Test all 428 functions
- Find at least 40 bugs (1 per 10 functions)
- Natural conversations (3-5 exchanges per function)
- Complete documentation for future agents

## 🔗 File Locations
- Documentation: `/docs/intelligent-testing-platform/`
- Test Platform Code: `/apps/test-platform/`
- IntelliCare Agent: `/apps/backend-api/services/agentServiceClaude.js`
- Function List: `/apps/backend-api/all_functions.txt`

## 🎭 The Three Personas
1. **Doctor** - Full medical functions, prescriptions, diagnoses
2. **Nurse** - Vital signs, patient care, limited prescriptions
3. **Secretary** - Registration, appointments, insurance

## 🐛 Types of Bugs We'll Find
1. Missing required parameters
2. Validation errors
3. Country-specific issues (US vs Israel)
4. Permission/role problems
5. Context loss in conversations
6. Function execution failures

---

**Remember: "No scripts, real conversation" - This is the way.**

**Status: Foundation complete, ready for implementation phase**