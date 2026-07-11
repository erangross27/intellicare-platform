const serviceAccountManager = require('./serviceAccountManager');
// Cost Tracking Service using MongoDB with Encryption
// Tracks costs per user (doctor) with encrypted storage

const CostTrackingModel = require('../models/CostTrackingModel');
const SecureDataAccess = require('./secureDataAccess');

class CostTrackingServiceDB {
  constructor() {
    this.serviceToken = null;
    this.initialized = false;
  }
  
  async initialize() {
    if (this.initialized) return this;
    
    const serviceAccountManager = require('./serviceAccountManager');
    this.serviceToken = await serviceAccountManager.authenticate('cost-tracking-db');
    this.initialized = true;
    console.log('✅ Cost Tracking Service initialized');
    return this;
  }
  
  // Record a conversation cost
  async recordConversationCost(practiceId, userId, sessionId, costInfo) {
    try {
      // Get the model
      const CostTracking = await CostTrackingModel.getModel();
      
      // Create context for SecureDataAccess
      const context = {
        serviceId: 'cost-tracking-db',
        apiKey: this.serviceToken?.apiKey || this.serviceToken,
        practiceId: practiceId
      };
      
      // Find or create cost tracking record for this practice
      const costRecords = await SecureDataAccess.query('costtrackings', { practiceId }, { limit: 1 }, context);
      let plainRecord = costRecords[0];
      let costRecord;
      
      if (!plainRecord) {
        costRecord = new CostTracking({
          practiceId,
          totalCosts: null,
          totalTokens: 0,
          totalMessages: 0,
          totalConversations: 0
        });
        
        // Initialize with empty encrypted costs
        costRecord.setTotalCosts({ USD: 0, ILS: 0 });
        await SecureDataAccess.insert('costtrackings', costRecord.toObject ? costRecord.toObject() : costRecord, context);
      } else {
        // Hydrate the plain object into a Mongoose document
        costRecord = new CostTracking(plainRecord);
      }
      
      // Add the new cost
      await costRecord.addCost(costInfo, userId, sessionId, context);
      
      // Return success without fetching totals (they're expensive and not needed immediately)
      // Frontend can request totals separately if needed
      return {
        success: true,
        message: 'Cost recorded successfully'
      };
    } catch (error) {
      console.error('Error recording cost:', error);
      return {
        success: false,
        error: error.message
      };
    }
  }
  
  // Get total costs for a practice
  async getClinicTotals(practiceId) {
    try {
      const CostTracking = await CostTrackingModel.getModel();
      
      // Create context for SecureDataAccess
      const context = {
        serviceId: 'cost-tracking-db',
        apiKey: this.serviceToken?.apiKey || this.serviceToken,
        practiceId: practiceId
      };
      
      const costRecords = await SecureDataAccess.query('costtrackings', { practiceId }, { limit: 1 }, context);
      const plainRecord = costRecords[0];
      
      if (!plainRecord) {
        return {
          totalCostUSD: '0.0000',
          totalCostILS: '0.0000',
          totalCostDisplay: '₪0.00',
          totalTokens: 0,
          totalConversations: 0,
          totalMessages: 0,
          averageCostPerMessage: '₪0.00',
          averageCostPerConversation: '₪0.00'
        };
      }
      
      // Hydrate the plain object into a Mongoose document
      const costRecord = new CostTracking(plainRecord);
      const totals = costRecord.getTotalCosts();
      
      return {
        totalCostUSD: totals.USD.toFixed(4),
        totalCostILS: totals.ILS.toFixed(4),
        totalCostDisplay: totals.ILS < 0.10 
          ? `₪${totals.ILS.toFixed(4)}`
          : `₪${totals.ILS.toFixed(2)}`,
        totalTokens: costRecord.totalTokens,
        totalConversations: costRecord.totalConversations,
        totalMessages: costRecord.totalMessages,
        averageCostPerMessage: costRecord.totalMessages > 0
          ? `₪${(totals.ILS / costRecord.totalMessages).toFixed(4)}`
          : '₪0.00',
        averageCostPerConversation: costRecord.totalConversations > 0
          ? `₪${(totals.ILS / costRecord.totalConversations).toFixed(2)}`
          : '₪0.00'
      };
    } catch (error) {
      console.error('Error getting practice totals:', error);
      return null;
    }
  }
  
  // Get costs for a specific user
  async getUserTotals(practiceId, userId) {
    try {
      const CostTracking = await CostTrackingModel.getModel();
      
      // Create context for SecureDataAccess
      const context = {
        serviceId: 'cost-tracking-db',
        apiKey: this.serviceToken?.apiKey || this.serviceToken,
        practiceId: practiceId
      };
      
      const costRecords = await SecureDataAccess.query('costtrackings', { practiceId }, { limit: 1 }, context);
      const plainRecord = costRecords[0];
      
      if (!plainRecord) {
        return {
          totalCostUSD: '0.0000',
          totalCostILS: '0.0000',
          totalCostDisplay: '₪0.00',
          totalMessages: 0
        };
      }
      
      // Hydrate the plain object into a Mongoose document
      const costRecord = new CostTracking(plainRecord);
      const userEntry = costRecord.userCosts.find(u => u.userId === userId);
      
      if (!userEntry) {
        return {
          totalCostUSD: '0.0000',
          totalCostILS: '0.0000',
          totalCostDisplay: '₪0.00',
          totalMessages: 0
        };
      }
      
      const userData = costRecord.decryptCosts(userEntry.encryptedData);
      
      return {
        totalCostUSD: userData.USD.toFixed(4),
        totalCostILS: userData.ILS.toFixed(4),
        totalCostDisplay: userData.ILS < 0.10
          ? `₪${userData.ILS.toFixed(4)}`
          : `₪${userData.ILS.toFixed(2)}`,
        totalMessages: userEntry.messages,
        lastUse: userEntry.lastUse
      };
    } catch (error) {
      console.error('Error getting user totals:', error);
      return null;
    }
  }
  
  // Get current month costs
  async getCurrentMonthCosts(practiceId) {
    try {
      const CostTracking = await CostTrackingModel.getModel();
      
      // Create context for SecureDataAccess
      const context = {
        serviceId: 'cost-tracking-db',
        apiKey: this.serviceToken?.apiKey || this.serviceToken,
        practiceId: practiceId
      };
      
      const costRecords = await SecureDataAccess.query('costtrackings', { practiceId }, { limit: 1 }, context);
      const plainRecord = costRecords[0];
      
      if (!plainRecord) {
        return {
          month: new Date().toISOString().slice(0, 7),
          costUSD: '0.0000',
          costILS: '0.0000',
          costDisplay: '₪0.00',
          tokens: 0,
          messages: 0
        };
      }
      
      // Hydrate the plain object into a Mongoose document
      const costRecord = new CostTracking(plainRecord);
      const currentMonth = new Date().toISOString().slice(0, 7);
      const monthEntry = costRecord.monthlyCosts.find(m => m.month === currentMonth);
      
      if (!monthEntry) {
        return {
          month: currentMonth,
          costUSD: '0.0000',
          costILS: '0.0000',
          costDisplay: '₪0.00',
          tokens: 0,
          messages: 0
        };
      }
      
      const monthData = costRecord.decryptCosts(monthEntry.encryptedData);
      
      return {
        month: currentMonth,
        costUSD: monthData.USD.toFixed(4),
        costILS: monthData.ILS.toFixed(4),
        costDisplay: monthData.ILS < 0.10
          ? `₪${monthData.ILS.toFixed(4)}`
          : `₪${monthData.ILS.toFixed(2)}`,
        tokens: monthEntry.tokens,
        messages: monthEntry.messages
      };
    } catch (error) {
      console.error('Error getting month costs:', error);
      return null;
    }
  }
  
  // Get today's costs
  async getTodayCosts(practiceId) {
    try {
      const CostTracking = await CostTrackingModel.getModel();
      
      // Create context for SecureDataAccess
      const context = {
        serviceId: 'cost-tracking-db',
        apiKey: this.serviceToken?.apiKey || this.serviceToken,
        practiceId: practiceId
      };
      
      const costRecords = await SecureDataAccess.query('costtrackings', { practiceId }, { limit: 1 }, context);
      const plainRecord = costRecords[0];
      
      if (!plainRecord) {
        return {
          date: new Date().toISOString().slice(0, 10),
          costUSD: '0.0000',
          costILS: '0.0000',
          costDisplay: '₪0.00',
          tokens: 0,
          messages: 0
        };
      }
      
      // Hydrate the plain object into a Mongoose document
      const costRecord = new CostTracking(plainRecord);
      const today = new Date().toISOString().slice(0, 10);
      const dayEntry = costRecord.dailyCosts.find(d => d.date === today);
      
      if (!dayEntry) {
        return {
          date: today,
          costUSD: '0.0000',
          costILS: '0.0000',
          costDisplay: '₪0.00',
          tokens: 0,
          messages: 0
        };
      }
      
      const dayData = costRecord.decryptCosts(dayEntry.encryptedData);
      
      return {
        date: today,
        costUSD: dayData.USD.toFixed(4),
        costILS: dayData.ILS.toFixed(4),
        costDisplay: dayData.ILS < 0.10
          ? `₪${dayData.ILS.toFixed(4)}`
          : `₪${dayData.ILS.toFixed(2)}`,
        tokens: dayEntry.tokens,
        messages: dayEntry.messages
      };
    } catch (error) {
      console.error('Error getting today costs:', error);
      return null;
    }
  }
  
  // Get all users for a practice with their costs
  async getClinicUserBreakdown(practiceId) {
    try {
      const CostTracking = await CostTrackingModel.getModel();
      
      // Create context for SecureDataAccess
      const context = {
        serviceId: 'cost-tracking-db',
        apiKey: this.serviceToken?.apiKey || this.serviceToken,
        practiceId: practiceId
      };
      
      const costRecords = await SecureDataAccess.query('costtrackings', { practiceId }, { limit: 1 }, context);
      const plainRecord = costRecords[0];
      
      if (!plainRecord) {
        return [];
      }
      
      // Hydrate the plain object into a Mongoose document
      const costRecord = new CostTracking(plainRecord);
      
      const users = [];
      
      for (const userEntry of costRecord.userCosts) {
        const userData = costRecord.decryptCosts(userEntry.encryptedData);
        
        users.push({
          userId: userEntry.userId,
          totalCostILS: userData.ILS.toFixed(4),
          totalCostDisplay: userData.ILS < 0.10
            ? `₪${userData.ILS.toFixed(4)}`
            : `₪${userData.ILS.toFixed(2)}`,
          totalMessages: userEntry.messages,
          averageCostPerMessage: userEntry.messages > 0
            ? `₪${(userData.ILS / userEntry.messages).toFixed(4)}`
            : '₪0.00',
          lastUse: userEntry.lastUse
        });
      }
      
      // Sort by cost (highest first)
      return users.sort((a, b) => parseFloat(b.totalCostILS) - parseFloat(a.totalCostILS));
    } catch (error) {
      console.error('Error getting user breakdown:', error);
      return [];
    }
  }
  
  // Generate billing report
  async generateBillingReport(practiceId) {
    try {
      const CostTracking = await CostTrackingModel.getModel();
      
      // Create context for SecureDataAccess
      const context = {
        serviceId: 'cost-tracking-db',
        apiKey: this.serviceToken?.apiKey || this.serviceToken,
        practiceId: practiceId
      };
      
      const costRecords = await SecureDataAccess.query('costtrackings', { practiceId }, { limit: 1 }, context);
      const plainRecord = costRecords[0];
      
      if (!plainRecord) {
        return {
          summary: {
            totalCost: '₪0.00',
            totalMessages: 0,
            totalConversations: 0,
            totalTokens: 0
          },
          today: null,
          currentMonth: null,
          topUsers: []
        };
      }
      
      // Hydrate the plain object into a Mongoose document
      const costRecord = new CostTracking(plainRecord);
      const report = costRecord.getDecryptedReport();
      const userBreakdown = await this.getClinicUserBreakdown(practiceId);
      
      return {
        ...report,
        topUsers: userBreakdown.slice(0, 10)
      };
    } catch (error) {
      console.error('Error generating report:', error);
      return null;
    }
  }
  
  // Get TOTAL amount across ALL practices (for billing)
  async getTotalAmount() {
    try {
      const CostTracking = await CostTrackingModel.getModel();
      
      // Create context for SecureDataAccess - admin context for all practices
      const context = {
        serviceId: 'cost-tracking-db',
        apiKey: this.serviceToken?.apiKey || this.serviceToken,
        practiceId: 'global' // Admin context for all practices
      };
      
      const allRecords = await SecureDataAccess.query('costtrackings', {}, {}, context);
      
      let totalUSD = 0;
      let totalILS = 0;
      let totalMessages = 0;
      let totalTokens = 0;
      let totalClinics = allRecords.length;
      
      for (const record of allRecords) {
        const costs = record.getTotalCosts();
        totalUSD += costs.USD;
        totalILS += costs.ILS;
        totalMessages += record.totalMessages;
        totalTokens += record.totalTokens;
      }
      
      return {
        totalAmountUSD: totalUSD.toFixed(4),
        totalAmountILS: totalILS.toFixed(2),
        totalAmountDisplay: `₪${totalILS.toFixed(2)}`,
        totalMessages,
        totalTokens,
        totalClinics,
        averagePerClinic: totalClinics > 0 
          ? `₪${(totalILS / totalClinics).toFixed(2)}`
          : '₪0.00',
        averagePerMessage: totalMessages > 0
          ? `₪${(totalILS / totalMessages).toFixed(4)}`
          : '₪0.00'
      };
    } catch (error) {
      console.error('Error getting total amount:', error);
      return null;
    }
  }
  
  // Reset costs for a practice (admin only)
  async resetClinicCosts(practiceId) {
    try {
      const CostTracking = await CostTrackingModel.getModel();
      await CostTracking.deleteOne({ practiceId });
      return { success: true, message: 'Practice costs reset' };
    } catch (error) {
      console.error('Error resetting costs:', error);
      return { success: false, error: error.message };
    }
  }
}

// Export singleton
module.exports = new CostTrackingServiceDB();