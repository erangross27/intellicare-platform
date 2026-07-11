# Task 3.5: Add Circuit Breaker

## 📋 **Task Overview**
**Phase:** 3 (Utilities, Monitoring & Resilience)  
**Time Estimate:** 25 minutes  
**Risk Level:** MEDIUM  
**Priority:** MEDIUM  

Add circuit breaker pattern for external AI services to prevent cascading failures and improve system resilience.

## 🎯 **Objective**
Implement circuit breaker that:
- Prevents cascading failures from external service outages
- Provides graceful degradation when AI services are down
- Automatically recovers when services are restored
- Protects system resources from being exhausted

## 🚨 **Resilience Risk**
**MEDIUM:** Without circuit breaker, external service failures can cascade and bring down the entire system.

## 📁 **File to Modify**
**File:** `backend/routes/agent.js`  
**Add circuit breaker pattern for AI services**

## 🔍 **Current Resilience Issues**

### **Issue 1: No Circuit Breaker for AI Services**
```javascript
// CURRENT - NO PROTECTION FROM AI SERVICE FAILURES
const result = await agent.processChatMessage(...);
// ❌ If AI service is down, this will keep failing
// ❌ No protection from cascading failures
// ❌ No graceful degradation
```

### **Issue 2: No Failure Detection**
```javascript
// CURRENT - NO FAILURE TRACKING
try {
  const result = await aiService.call();
} catch (error) {
  // ❌ No tracking of failure patterns
  // ❌ No automatic service isolation
}
```

### **Issue 3: No Automatic Recovery**
```javascript
// CURRENT - NO RECOVERY MECHANISM
// ❌ No automatic retry when service recovers
// ❌ No health checking of external services
```

## ✅ **Circuit Breaker System**

### **1. Circuit Breaker Implementation**
```javascript
// ADD at top of file after imports:

class CircuitBreaker {
  constructor(name, options = {}) {
    this.name = name;
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.nextAttempt = null;
    
    // Configuration
    this.failureThreshold = options.failureThreshold || 5;
    this.recoveryTimeout = options.recoveryTimeout || 60000; // 1 minute
    this.monitoringPeriod = options.monitoringPeriod || 10000; // 10 seconds
    this.halfOpenMaxCalls = options.halfOpenMaxCalls || 3;
    this.successThreshold = options.successThreshold || 2;
    
    // Metrics
    this.metrics = {
      totalCalls: 0,
      successfulCalls: 0,
      failedCalls: 0,
      rejectedCalls: 0,
      averageResponseTime: 0,
      totalResponseTime: 0,
      stateChanges: [],
      lastStateChange: null
    };
    
    console.log(`🔌 Circuit breaker '${this.name}' initialized`);
  }
  
  // Execute function with circuit breaker protection
  async execute(fn, fallback = null) {
    this.metrics.totalCalls++;
    
    // Check if circuit is open
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        this.metrics.rejectedCalls++;
        console.log(`🚫 Circuit breaker '${this.name}' is OPEN - rejecting call`);
        
        if (fallback) {
          return await fallback();
        } else {
          throw new Error(`Circuit breaker '${this.name}' is OPEN`);
        }
      } else {
        // Try to transition to half-open
        this.setState('HALF_OPEN');
      }
    }
    
    // Check if we're in half-open state and have reached max calls
    if (this.state === 'HALF_OPEN' && this.successCount >= this.halfOpenMaxCalls) {
      this.metrics.rejectedCalls++;
      
      if (fallback) {
        return await fallback();
      } else {
        throw new Error(`Circuit breaker '${this.name}' is HALF_OPEN - max calls reached`);
      }
    }
    
    const startTime = Date.now();
    
    try {
      const result = await fn();
      const responseTime = Date.now() - startTime;
      
      this.onSuccess(responseTime);
      return result;
      
    } catch (error) {
      const responseTime = Date.now() - startTime;
      this.onFailure(error, responseTime);
      
      if (fallback) {
        console.log(`🔄 Circuit breaker '${this.name}' executing fallback`);
        return await fallback();
      } else {
        throw error;
      }
    }
  }
  
  // Handle successful call
  onSuccess(responseTime) {
    this.metrics.successfulCalls++;
    this.metrics.totalResponseTime += responseTime;
    this.metrics.averageResponseTime = this.metrics.totalResponseTime / this.metrics.successfulCalls;
    
    if (this.state === 'HALF_OPEN') {
      this.successCount++;
      
      if (this.successCount >= this.successThreshold) {
        this.setState('CLOSED');
        this.reset();
      }
    } else if (this.state === 'CLOSED') {
      // Reset failure count on success
      this.failureCount = 0;
    }
    
    console.log(`✅ Circuit breaker '${this.name}' - successful call (${responseTime}ms)`);
  }
  
  // Handle failed call
  onFailure(error, responseTime) {
    this.metrics.failedCalls++;
    this.failureCount++;
    this.lastFailureTime = Date.now();
    
    console.log(`❌ Circuit breaker '${this.name}' - failed call: ${error.message}`);
    
    if (this.state === 'CLOSED' && this.failureCount >= this.failureThreshold) {
      this.setState('OPEN');
      this.nextAttempt = Date.now() + this.recoveryTimeout;
    } else if (this.state === 'HALF_OPEN') {
      this.setState('OPEN');
      this.nextAttempt = Date.now() + this.recoveryTimeout;
    }
  }
  
  // Change circuit breaker state
  setState(newState) {
    const oldState = this.state;
    this.state = newState;
    this.metrics.lastStateChange = Date.now();
    this.metrics.stateChanges.push({
      from: oldState,
      to: newState,
      timestamp: new Date(),
      failureCount: this.failureCount,
      successCount: this.successCount
    });
    
    // Keep only last 50 state changes
    if (this.metrics.stateChanges.length > 50) {
      this.metrics.stateChanges.shift();
    }
    
    console.log(`🔄 Circuit breaker '${this.name}' state: ${oldState} → ${newState}`);
    
    // Emit event for monitoring
    if (global.metrics) {
      global.metrics.emit('circuit_breaker_state_change', {
        name: this.name,
        oldState: oldState,
        newState: newState,
        failureCount: this.failureCount
      });
    }
  }
  
  // Reset circuit breaker
  reset() {
    this.failureCount = 0;
    this.successCount = 0;
    this.lastFailureTime = null;
    this.nextAttempt = null;
    console.log(`🔄 Circuit breaker '${this.name}' reset`);
  }
  
  // Get current status
  getStatus() {
    return {
      name: this.name,
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      lastFailureTime: this.lastFailureTime,
      nextAttempt: this.nextAttempt,
      metrics: this.metrics,
      config: {
        failureThreshold: this.failureThreshold,
        recoveryTimeout: this.recoveryTimeout,
        successThreshold: this.successThreshold
      }
    };
  }
  
  // Force state change (for testing/admin)
  forceState(state) {
    this.setState(state);
    if (state === 'CLOSED') {
      this.reset();
    }
  }
}

// Circuit breaker registry
class CircuitBreakerRegistry {
  constructor() {
    this.breakers = new Map();
  }
  
  // Get or create circuit breaker
  getBreaker(name, options = {}) {
    if (!this.breakers.has(name)) {
      this.breakers.set(name, new CircuitBreaker(name, options));
    }
    return this.breakers.get(name);
  }
  
  // Get all breakers
  getAllBreakers() {
    return Array.from(this.breakers.values());
  }
  
  // Get breaker status
  getStatus(name = null) {
    if (name) {
      const breaker = this.breakers.get(name);
      return breaker ? breaker.getStatus() : null;
    }
    
    return Array.from(this.breakers.values()).map(breaker => breaker.getStatus());
  }
}

// Global circuit breaker registry
const circuitBreakers = new CircuitBreakerRegistry();
global.circuitBreakers = circuitBreakers;
```

### **2. AI Service Circuit Breakers**
```javascript
// ADD: Circuit breakers for AI services
const aiCircuitBreakers = {
  chat: circuitBreakers.getBreaker('ai_chat', {
    failureThreshold: 3,
    recoveryTimeout: 30000, // 30 seconds
    successThreshold: 2
  }),
  
  voiceProcessing: circuitBreakers.getBreaker('ai_voice', {
    failureThreshold: 5,
    recoveryTimeout: 60000, // 1 minute
    successThreshold: 3
  }),
  
  documentAnalysis: circuitBreakers.getBreaker('ai_document', {
    failureThreshold: 3,
    recoveryTimeout: 45000, // 45 seconds
    successThreshold: 2
  }),
  
  diagnosis: circuitBreakers.getBreaker('ai_diagnosis', {
    failureThreshold: 4,
    recoveryTimeout: 60000, // 1 minute
    successThreshold: 2
  })
};

// Fallback functions for AI services
const aiFallbacks = {
  chat: async () => ({
    success: false,
    action: 'chat_only',
    message: 'AI service is temporarily unavailable. Please try again later.',
    fallback: true
  }),
  
  voiceProcessing: async () => ({
    success: false,
    message: 'Voice processing is temporarily unavailable. Please try again later.',
    fallback: true
  }),
  
  documentAnalysis: async () => ({
    success: false,
    message: 'Document analysis is temporarily unavailable. Please try again later.',
    fallback: true
  }),
  
  diagnosis: async () => ({
    success: false,
    message: 'AI diagnosis is temporarily unavailable. Please consult manually.',
    fallback: true
  })
};
```

### **3. Protected AI Operations**
```javascript
// BEFORE - Unprotected AI calls:
const result = await agent.processChatMessage(message, sessionId, language, practiceContext);

// AFTER - Circuit breaker protected:
router.post('/chat',
  // ... middleware ...
  asyncHandler(async (req, res) => {
    try {
      const { message, sessionId = 'default', language = 'he' } = req.body;
      const clinicSessionId = createClinicSessionId(req.practiceSubdomain, sessionId);
      
      // Execute with circuit breaker protection
      const result = await aiCircuitBreakers.chat.execute(
        async () => {
          return await agent.processChatMessage(
            message, 
            clinicSessionId, 
            language, 
            req.practiceContext
          );
        },
        aiFallbacks.chat
      );
      
      // Log circuit breaker usage
      if (result.fallback) {
        await auditLog(req, 'AI_FALLBACK_USED', {
          service: 'chat',
          circuitBreakerState: aiCircuitBreakers.chat.state,
          message: message.substring(0, 100)
        });
      }
      
      res.json(result);
      
    } catch (error) {
      throw error;
    }
  })
);

router.post('/voice-command',
  // ... middleware ...
  asyncHandler(async (req, res) => {
    try {
      const { audioData, language = 'he' } = req.body;
      
      const result = await aiCircuitBreakers.voiceProcessing.execute(
        async () => {
          return await processVoiceCommand(audioData, language, req.practiceContext);
        },
        aiFallbacks.voiceProcessing
      );
      
      if (result.fallback) {
        await auditLog(req, 'AI_FALLBACK_USED', {
          service: 'voice',
          circuitBreakerState: aiCircuitBreakers.voiceProcessing.state
        });
      }
      
      res.json(result);
      
    } catch (error) {
      throw error;
    }
  })
);

router.post('/analyze-document',
  // ... middleware ...
  asyncHandler(async (req, res) => {
    try {
      const { patientName, documentIds } = req.body;
      
      const result = await aiCircuitBreakers.documentAnalysis.execute(
        async () => {
          return await analyzeDocuments(patientName, documentIds, req.practiceContext);
        },
        aiFallbacks.documentAnalysis
      );
      
      if (result.fallback) {
        await auditLog(req, 'AI_FALLBACK_USED', {
          service: 'document_analysis',
          circuitBreakerState: aiCircuitBreakers.documentAnalysis.state,
          patientName: patientName,
          documentCount: documentIds.length
        });
      }
      
      res.json(result);
      
    } catch (error) {
      throw error;
    }
  })
);
```

### **4. Circuit Breaker Health Monitoring**
```javascript
// ADD: Circuit breaker health monitoring
const monitorCircuitBreakers = () => {
  setInterval(() => {
    const allBreakers = circuitBreakers.getAllBreakers();
    
    allBreakers.forEach(breaker => {
      const status = breaker.getStatus();
      
      // Log circuit breaker metrics
      console.log(`🔌 Circuit breaker '${status.name}': ${status.state} (failures: ${status.failureCount})`);
      
      // Alert on circuit breaker opening
      if (status.state === 'OPEN' && global.alertSystem) {
        global.alertSystem.triggerAlert('CIRCUIT_BREAKER_OPEN', {
          name: status.name,
          failureCount: status.failureCount,
          lastFailureTime: status.lastFailureTime,
          severity: 'warning'
        });
      }
      
      // Record metrics
      if (global.metrics) {
        global.metrics.emit('circuit_breaker_status', status);
      }
    });
  }, 30000); // Every 30 seconds
};

// Start monitoring
monitorCircuitBreakers();
```

### **5. Circuit Breaker Management Endpoints**
```javascript
// ADD: Circuit breaker management endpoints
router.get('/circuit-breakers',
  practiceAuth,
  requireAuth,
  (req, res) => {
    try {
      const status = circuitBreakers.getStatus();
      
      res.json({
        success: true,
        data: status
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get circuit breaker status'
      });
    }
  }
);

router.get('/circuit-breakers/:name',
  practiceAuth,
  requireAuth,
  (req, res) => {
    try {
      const status = circuitBreakers.getStatus(req.params.name);
      
      if (status) {
        res.json({
          success: true,
          data: status
        });
      } else {
        res.status(404).json({
          success: false,
          error: 'Circuit breaker not found'
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to get circuit breaker status'
      });
    }
  }
);

router.post('/circuit-breakers/:name/reset',
  practiceAuth,
  requireAuth,
  (req, res) => {
    try {
      const breaker = circuitBreakers.breakers.get(req.params.name);
      
      if (breaker) {
        breaker.forceState('CLOSED');
        
        // Log manual reset
        auditLog(req, 'CIRCUIT_BREAKER_MANUAL_RESET', {
          name: req.params.name,
          resetBy: req.user._id
        });
        
        res.json({
          success: true,
          message: `Circuit breaker '${req.params.name}' reset`,
          data: breaker.getStatus()
        });
      } else {
        res.status(404).json({
          success: false,
          error: 'Circuit breaker not found'
        });
      }
    } catch (error) {
      res.status(500).json({
        success: false,
        error: 'Failed to reset circuit breaker'
      });
    }
  }
);
```

### **6. Circuit Breaker Testing**
```javascript
// ADD: Circuit breaker testing utilities
const testCircuitBreaker = async (name, shouldFail = false) => {
  const breaker = circuitBreakers.breakers.get(name);
  
  if (!breaker) {
    throw new Error(`Circuit breaker '${name}' not found`);
  }
  
  console.log(`🧪 Testing circuit breaker '${name}' (shouldFail: ${shouldFail})`);
  
  try {
    const result = await breaker.execute(async () => {
      if (shouldFail) {
        throw new Error('Simulated failure');
      }
      return { success: true, test: true };
    });
    
    console.log(`✅ Circuit breaker test passed:`, result);
    return result;
    
  } catch (error) {
    console.log(`❌ Circuit breaker test failed:`, error.message);
    throw error;
  }
};

// Add test endpoint (development only)
if (process.env.NODE_ENV === 'development') {
  router.post('/circuit-breakers/:name/test',
    practiceAuth,
    requireAuth,
    asyncHandler(async (req, res) => {
      const { shouldFail = false } = req.body;
      
      try {
        const result = await testCircuitBreaker(req.params.name, shouldFail);
        
        res.json({
          success: true,
          data: result,
          status: circuitBreakers.getStatus(req.params.name)
        });
      } catch (error) {
        res.json({
          success: false,
          error: error.message,
          status: circuitBreakers.getStatus(req.params.name)
        });
      }
    })
  );
}
```

## ⚠️ **Resilience Notes**
- **🚨 IMPORTANT:** Circuit breakers prevent cascading failures
- **🚨 IMPORTANT:** Fallbacks provide graceful degradation
- **🚨 IMPORTANT:** Automatic recovery improves availability
- **❌ DON'T SKIP:** This is essential for system resilience

## 🧪 **Testing After Implementation**
1. **Test circuit breaker states:**
   - Trigger failures to open circuit
   - Verify automatic recovery to half-open
   - Test successful calls closing circuit

2. **Test fallback mechanisms:**
   - Verify fallbacks execute when circuit is open
   - Check fallback responses are appropriate

3. **Test monitoring:**
   - Verify circuit breaker status endpoints
   - Check metrics and alerts

## ✅ **Success Criteria**
- [ ] Circuit breakers implemented for all AI services
- [ ] Fallback mechanisms working
- [ ] Automatic state transitions functioning
- [ ] Monitoring and management endpoints active
- [ ] Health checking operational
- [ ] Manual reset capability working

## 🔄 **Next Task**
After completing this task, proceed to:
**Task 3.6:** Add Data Retention Policies

## 📝 **CRITICAL NOTES**
- **PREVENTS CASCADING FAILURES** - circuit breakers essential for resilience
- **ENABLES GRACEFUL DEGRADATION** - fallbacks maintain service availability
- **IMPROVES SYSTEM STABILITY** - automatic recovery reduces downtime
- **TEST THOROUGHLY** - verify all failure scenarios are handled
