// Cost Tracking Model with Encryption
// Stores all AI usage costs in MongoDB with encryption

const mongoose = require('mongoose');
const crypto = require('crypto');
const secureConfigService = require('../services/secureConfigService');

// Get encryption key from environment or use default (should be in .env in production)
const ENCRYPTION_KEY = secureConfigService.get('COST_ENCRYPTION_KEY') || secureConfigService.get('ENCRYPTION_KEY') || 'your-32-byte-encryption-key-here!!!';
const ALGORITHM = 'aes-256-gcm';

// Encryption helper functions
function encrypt(text) {
  if (!text) return null;
  
  const iv = crypto.randomBytes(16);
  const salt = crypto.randomBytes(64);
  const key = crypto.pbkdf2Sync(ENCRYPTION_KEY, salt, 2145, 32, 'sha512');
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  
  const encrypted = Buffer.concat([cipher.update(JSON.stringify(text), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  
  return Buffer.concat([salt, iv, tag, encrypted]).toString('base64');
}

function decrypt(encryptedData) {
  if (!encryptedData) return null;
  
  const bData = Buffer.from(encryptedData, 'base64');
  const salt = bData.slice(0, 64);
  const iv = bData.slice(64, 80);
  const tag = bData.slice(80, 96);
  const text = bData.slice(96);
  
  const key = crypto.pbkdf2Sync(ENCRYPTION_KEY, salt, 2145, 32, 'sha512');
  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  
  const decrypted = decipher.update(text, 'binary', 'utf8') + decipher.final('utf8');
  return JSON.parse(decrypted);
}

// Schema for cost tracking
const costTrackingSchema = new mongoose.Schema({
  practiceId: {
    type: String,
    required: true,
    index: true
  },
  
  // Encrypted total costs
  totalCosts: {
    type: String, // Encrypted JSON containing USD and ILS amounts
    required: true
  },
  
  // Token usage (can be unencrypted for analytics)
  totalTokens: {
    type: Number,
    default: 0
  },
  
  totalMessages: {
    type: Number,
    default: 0
  },
  
  totalConversations: {
    type: Number,
    default: 0
  },
  
  // Encrypted daily breakdown
  dailyCosts: [{
    date: {
      type: String, // YYYY-MM-DD
      required: true
    },
    encryptedData: {
      type: String // Encrypted cost data for the day
    },
    messages: Number,
    tokens: Number
  }],
  
  // Encrypted monthly breakdown
  monthlyCosts: [{
    month: {
      type: String, // YYYY-MM
      required: true
    },
    encryptedData: {
      type: String // Encrypted cost data for the month
    },
    messages: Number,
    tokens: Number
  }],
  
  // Encrypted user costs
  userCosts: [{
    userId: {
      type: String,
      required: true
    },
    encryptedData: {
      type: String // Encrypted cost data per user
    },
    messages: Number,
    lastUse: Date
  }],
  
  // Metadata
  startDate: {
    type: Date,
    default: Date.now
  },
  
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  
  // Session tracking for deduplication
  processedSessions: [{
    sessionId: String,
    lastMessageTime: Date
  }]
}, {
  timestamps: true
});

// Instance methods for encryption/decryption
costTrackingSchema.methods.encryptCosts = function(costData) {
  return encrypt(costData);
};

costTrackingSchema.methods.decryptCosts = function(encryptedData) {
  return decrypt(encryptedData);
};

// Get decrypted total costs
costTrackingSchema.methods.getTotalCosts = function() {
  if (!this.totalCosts) return { USD: 0, ILS: 0 };
  return decrypt(this.totalCosts);
};

// Set encrypted total costs
costTrackingSchema.methods.setTotalCosts = function(costData) {
  this.totalCosts = encrypt(costData);
};

// Add cost with encryption
costTrackingSchema.methods.addCost = async function(costInfo, userId, sessionId) {
  const costUSD = parseFloat(costInfo.totalCost || 0);
  const costILS = costUSD * 3.38;
  const tokens = costInfo.totalTokens || 0;
  
  // Check if we've already processed this session message
  const existingSession = this.processedSessions.find(s => s.sessionId === sessionId);
  if (existingSession) {
    const timeDiff = Date.now() - existingSession.lastMessageTime;
    if (timeDiff < 1000) { // Ignore if less than 1 second (duplicate)
      return;
    }
    existingSession.lastMessageTime = new Date();
  } else {
    this.processedSessions.push({
      sessionId,
      lastMessageTime: new Date()
    });
  }
  
  // Update encrypted totals
  const currentTotals = this.getTotalCosts();
  currentTotals.USD = (currentTotals.USD || 0) + costUSD;
  currentTotals.ILS = (currentTotals.ILS || 0) + costILS;
  this.setTotalCosts(currentTotals);
  
  // Update unencrypted counters
  this.totalTokens += tokens;
  this.totalMessages += 1;
  
  // Update daily costs
  const today = new Date().toISOString().slice(0, 10);
  let dailyEntry = this.dailyCosts.find(d => d.date === today);
  
  if (!dailyEntry) {
    dailyEntry = {
      date: today,
      encryptedData: encrypt({ USD: 0, ILS: 0 }),
      messages: 0,
      tokens: 0
    };
    this.dailyCosts.push(dailyEntry);
  }
  
  const dailyData = decrypt(dailyEntry.encryptedData) || { USD: 0, ILS: 0 };
  dailyData.USD += costUSD;
  dailyData.ILS += costILS;
  dailyEntry.encryptedData = encrypt(dailyData);
  dailyEntry.messages += 1;
  dailyEntry.tokens += tokens;
  
  // Update monthly costs
  const month = new Date().toISOString().slice(0, 7);
  let monthlyEntry = this.monthlyCosts.find(m => m.month === month);
  
  if (!monthlyEntry) {
    monthlyEntry = {
      month: month,
      encryptedData: encrypt({ USD: 0, ILS: 0 }),
      messages: 0,
      tokens: 0
    };
    this.monthlyCosts.push(monthlyEntry);
  }
  
  const monthlyData = decrypt(monthlyEntry.encryptedData) || { USD: 0, ILS: 0 };
  monthlyData.USD += costUSD;
  monthlyData.ILS += costILS;
  monthlyEntry.encryptedData = encrypt(monthlyData);
  monthlyEntry.messages += 1;
  monthlyEntry.tokens += tokens;
  
  // Update user costs
  if (userId && userId !== 'unknown') {
    let userEntry = this.userCosts.find(u => u.userId === userId);
    
    if (!userEntry) {
      userEntry = {
        userId,
        encryptedData: encrypt({ USD: 0, ILS: 0 }),
        messages: 0,
        lastUse: new Date()
      };
      this.userCosts.push(userEntry);
    }
    
    const userData = decrypt(userEntry.encryptedData) || { USD: 0, ILS: 0 };
    userData.USD += costUSD;
    userData.ILS += costILS;
    userEntry.encryptedData = encrypt(userData);
    userEntry.messages += 1;
    userEntry.lastUse = new Date();
  }
  
  // Update conversation count
  const uniqueSessions = new Set(this.processedSessions.map(s => s.sessionId));
  this.totalConversations = uniqueSessions.size;
  
  this.lastUpdated = new Date();
  const context = { serviceId: 'cost-tracking', practiceId: this.practiceId };
  await SecureDataAccess.update('costtracking', { _id: this._id }, this, context);
};

// Get decrypted report
costTrackingSchema.methods.getDecryptedReport = function() {
  const totals = this.getTotalCosts();
  
  const today = new Date().toISOString().slice(0, 10);
  const todayData = this.dailyCosts.find(d => d.date === today);
  const todayCosts = todayData ? decrypt(todayData.encryptedData) : { USD: 0, ILS: 0 };
  
  const month = new Date().toISOString().slice(0, 7);
  const monthData = this.monthlyCosts.find(m => m.month === month);
  const monthCosts = monthData ? decrypt(monthData.encryptedData) : { USD: 0, ILS: 0 };
  
  return {
    summary: {
      totalCost: totals.ILS < 0.10 
        ? `₪${totals.ILS.toFixed(4)}`
        : `₪${totals.ILS.toFixed(2)}`,
      totalMessages: this.totalMessages,
      totalConversations: this.totalConversations,
      totalTokens: this.totalTokens,
      averagePerMessage: this.totalMessages > 0
        ? `₪${(totals.ILS / this.totalMessages).toFixed(4)}`
        : '₪0.00'
    },
    today: {
      costDisplay: todayCosts.ILS < 0.10
        ? `₪${todayCosts.ILS.toFixed(4)}`
        : `₪${todayCosts.ILS.toFixed(2)}`,
      messages: todayData?.messages || 0,
      tokens: todayData?.tokens || 0
    },
    currentMonth: {
      costDisplay: monthCosts.ILS < 0.10
        ? `₪${monthCosts.ILS.toFixed(4)}`
        : `₪${monthCosts.ILS.toFixed(2)}`,
      messages: monthData?.messages || 0,
      tokens: monthData?.tokens || 0
    }
  };
};

// Indexes for performance
costTrackingSchema.index({ practiceId: 1, lastUpdated: -1 });
costTrackingSchema.index({ 'processedSessions.sessionId': 1 });

// Create model using the global database connection
let CostTracking;

// We need to use the global database connection for cost tracking
// This data is shared across all practices for billing purposes
const databaseFactory = require('../utils/databaseFactory');
// secureConfigService already imported at the top
const SecureDataAccess = require('../services/secureDataAccess');

// Initialize the model with global connection
async function initializeCostTrackingModel() {
  try {
    // Global database operations moved to SecureDataAccess
    CostTracking = mongoose.model('CostTracking', costTrackingSchema);
    console.log('✅ CostTracking model initialized with global database');
    return CostTracking;
  } catch (error) {
    console.error('❌ Failed to initialize CostTracking model:', error);
    // Fallback to default mongoose connection if global fails
    CostTracking = mongoose.model('CostTracking', costTrackingSchema);
    return CostTracking;
  }
}

// Initialize immediately
initializeCostTrackingModel();

// Export a proxy that ensures the model is initialized
module.exports = new Proxy({}, {
  get(target, prop) {
    if (!CostTracking) {
      console.warn('⚠️ CostTracking model not yet initialized, using default connection');
      CostTracking = mongoose.model('CostTracking', costTrackingSchema);
    }
    return CostTracking[prop];
  }
});