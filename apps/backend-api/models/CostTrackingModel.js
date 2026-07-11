// Cost Tracking Model with Global Database Connection
// This model uses the global database for cross-practice billing

const mongoose = require('mongoose');
const crypto = require('crypto');
const databaseFactory = require('../utils/databaseFactory');
const secureConfigService = require('../services/secureConfigService');
const SecureDataAccess = require('../services/secureDataAccess');
const { getIsraelDateString } = require('../utils/timezoneHelper');

// Get encryption key from environment or use default (should be in .env in production)
const ENCRYPTION_KEY = secureConfigService.get('COST_ENCRYPTION_KEY') || secureConfigService.get('DOCUMENT_ENCRYPTION_KEY') || secureConfigService.get('ENCRYPTION_KEY') || 'your-32-byte-encryption-key-here!!!';
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
  try {
    return decrypt(encryptedData);
  } catch (error) {
    console.warn('⚠️ Could not decrypt cost data, returning default');
    return { USD: 0, ILS: 0 };
  }
};

// Get decrypted total costs
costTrackingSchema.methods.getTotalCosts = function() {
  if (!this.totalCosts) return { USD: 0, ILS: 0 };
  try {
    return decrypt(this.totalCosts);
  } catch (error) {
    console.warn('⚠️ Could not decrypt existing cost data, resetting to 0');
    // If decryption fails, reset to 0 (old data with different key)
    return { USD: 0, ILS: 0 };
  }
};

// Set encrypted total costs
costTrackingSchema.methods.setTotalCosts = function(costData) {
  this.totalCosts = encrypt(costData);
};

// Add cost with encryption
costTrackingSchema.methods.addCost = async function(costInfo, userId, sessionId, context) {
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
  
  // Update daily costs (using Israel date)
  const today = getIsraelDateString();
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
  
  let dailyData;
  try {
    dailyData = decrypt(dailyEntry.encryptedData) || { USD: 0, ILS: 0 };
  } catch (error) {
    console.warn('⚠️ Could not decrypt daily cost data, resetting to 0');
    dailyData = { USD: 0, ILS: 0 };
  }
  dailyData.USD += costUSD;
  dailyData.ILS += costILS;
  dailyEntry.encryptedData = encrypt(dailyData);
  dailyEntry.messages += 1;
  dailyEntry.tokens += tokens;
  
  // Update monthly costs (using Israel date for month)
  const month = getIsraelDateString().slice(0, 7);
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
  
  let monthlyData;
  try {
    monthlyData = decrypt(monthlyEntry.encryptedData) || { USD: 0, ILS: 0 };
  } catch (error) {
    console.warn('⚠️ Could not decrypt monthly cost data, resetting to 0');
    monthlyData = { USD: 0, ILS: 0 };
  }
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
    
    let userData;
    try {
      userData = decrypt(userEntry.encryptedData) || { USD: 0, ILS: 0 };
    } catch (error) {
      console.warn('⚠️ Could not decrypt user cost data, resetting to 0');
      userData = { USD: 0, ILS: 0 };
    }
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
  
  // Build update document with atomic operators
  const updateDoc = {
    $set: {
      totalCosts: this.totalCosts,
      totalTokens: this.totalTokens,
      totalMessages: this.totalMessages,
      totalConversations: this.totalConversations,
      dailyCosts: this.dailyCosts,
      monthlyCosts: this.monthlyCosts,
      userCosts: this.userCosts,
      processedSessions: this.processedSessions,
      lastUpdated: this.lastUpdated
    }
  };
  
  await SecureDataAccess.update('costtrackings', { _id: this._id }, updateDoc, context);
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

// Create a singleton instance of the model
class CostTrackingModel {
  constructor() {
    this.model = null;
    this.initPromise = null;
  }

  async initialize() {
    if (this.model) return this.model;
    
    if (!this.initPromise) {
      this.initPromise = this._doInitialize();
    }
    
    return this.initPromise;
  }

  async _doInitialize() {
    try {
      // Use databaseFactory to get global database
      const databaseFactory = require('../utils/databaseFactory');
      const globalDb = await databaseFactory.getGlobalDatabase();
      this.model = globalDb.model('CostTracking', costTrackingSchema);
      console.log('✅ CostTracking model initialized with global database');
      return this.model;
    } catch (error) {
      console.error('❌ Failed to initialize CostTracking model:', error);
      // Fallback to default mongoose connection if global fails
      this.model = mongoose.model('CostTracking', costTrackingSchema);
      console.log('⚠️ Using fallback mongoose connection for CostTracking');
      return this.model;
    }
  }

  async getModel() {
    if (!this.model) {
      await this.initialize();
    }
    return this.model;
  }
}

// Export singleton instance
module.exports = new CostTrackingModel();