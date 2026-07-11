# System Architecture - Multi-Turn Conversation System

## Components Overview

### 1. Conversation Mode Manager
- **File:** `services/conversationModeManager.js`
- **Purpose:** Detect and manage conversation modes
- **Modes:** 8 types (Scheduling, Medical, Patient, Document, Admin, Collaboration, Reporting, General)

### 2. Function Bundles
- **File:** `services/conversationBundles.js`
- **Purpose:** Pre-defined function groups for each mode
- **Bundles:** 8 bundles with 15-40 functions each

### 3. Session Manager
- **File:** `services/conversationSessionManager.js`
- **Purpose:** Track conversation state across turns
- **Features:** Context, entities, workflows, metrics

### 4. Intent Mapper Integration
- **File:** `services/intentBasedFunctionMapper.js`
- **Purpose:** Map intents to functions with conversation awareness

### 5. Claude Service Integration
- **File:** `services/agentServiceClaude.js`
- **Method:** `getCoreFunctions()`
- **Enhancement:** Multi-turn support with mode detection

## Data Flow

1. User message → Claude Service
2. Mode detection/maintenance
3. Bundle selection based on mode
4. Function loading from bundle
5. Context preservation in session
6. Response generation with context
7. Session update with turn data

## Token Economics

- **Per Turn:** 5,000-10,000 tokens
- **Per Conversation:** 50,000-100,000 tokens
- **Savings:** 95% vs sending all functions

## Fallback Chain

1. Conversation Mode →
2. Intent Detection →
3. Keyword Matching →
4. Default Bundle