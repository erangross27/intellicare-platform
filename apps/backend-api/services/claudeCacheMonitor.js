// Claude Cache Performance Monitoring Service
// Real-time tracking of cache efficiency and cost savings

class ClaudeCacheMonitor {
  constructor() {
    this.metrics = {
      totalRequests: 0,
      cachedRequests: 0,
      totalInputTokens: 0,
      cachedInputTokens: 0,
      cacheWriteTokens: 0,
      totalOutputTokens: 0,
      totalCostUSD: 0,
      savedCostUSD: 0,
      cacheHitRate: 0,
      averageResponseTime: 0,
      hourlyMetrics: new Map(),
      dailyMetrics: new Map()
    };
    
    this.sessionMetrics = new Map();
    this.startTime = Date.now();
  }

  async initialize() {
    const serviceAccountManager = require('./serviceAccountManager');
    this.serviceToken = await serviceAccountManager.authenticate('claude-cache-monitor');
    return this;
  }
  
  // Record a request with cache metrics
  recordRequest(sessionId, metrics) {
    // Update global metrics
    this.metrics.totalRequests++;
    this.metrics.totalInputTokens += metrics.inputTokens || 0;
    this.metrics.cachedInputTokens += metrics.cachedTokens || 0;
    this.metrics.cacheWriteTokens += metrics.cacheWriteTokens || 0;
    this.metrics.totalOutputTokens += metrics.outputTokens || 0;
    
    // Calculate costs
    const USD_TO_ILS = 3.38;
    const inputCost = parseFloat(metrics.inputCost || 0);
    const outputCost = parseFloat(metrics.outputCost || 0);
    const totalCost = inputCost + outputCost;
    const savedCost = parseFloat(metrics.savedUSD || 0);
    
    this.metrics.totalCostUSD += totalCost;
    this.metrics.savedCostUSD += savedCost;
    
    // Update cache hit rate
    if (metrics.cachedTokens > 0) {
      this.metrics.cachedRequests++;
    }
    this.metrics.cacheHitRate = (this.metrics.cachedRequests / this.metrics.totalRequests * 100).toFixed(1);
    
    // Track session-specific metrics
    if (!this.sessionMetrics.has(sessionId)) {
      this.sessionMetrics.set(sessionId, {
        requests: 0,
        totalTokens: 0,
        cachedTokens: 0,
        totalCost: 0,
        savedCost: 0
      });
    }
    
    const sessionData = this.sessionMetrics.get(sessionId);
    sessionData.requests++;
    sessionData.totalTokens += metrics.inputTokens + metrics.outputTokens + (metrics.cacheWriteTokens || 0) + (metrics.cachedTokens || 0) + (metrics.cacheEphemeralTokens || 0);
    sessionData.cachedTokens += metrics.cachedTokens || 0;
    sessionData.totalCost += totalCost;
    sessionData.savedCost += savedCost;
    
    // Track hourly metrics
    const hour = new Date().toISOString().slice(0, 13);
    if (!this.metrics.hourlyMetrics.has(hour)) {
      this.metrics.hourlyMetrics.set(hour, {
        requests: 0,
        tokens: 0,
        cachedTokens: 0,
        cost: 0,
        saved: 0
      });
    }
    
    const hourData = this.metrics.hourlyMetrics.get(hour);
    hourData.requests++;
    hourData.tokens += metrics.inputTokens + metrics.outputTokens;
    hourData.cachedTokens += metrics.cachedTokens || 0;
    hourData.cost += totalCost;
    hourData.saved += savedCost;
    
    // Track daily metrics
    const day = new Date().toISOString().slice(0, 10);
    if (!this.metrics.dailyMetrics.has(day)) {
      this.metrics.dailyMetrics.set(day, {
        requests: 0,
        tokens: 0,
        cachedTokens: 0,
        cost: 0,
        saved: 0
      });
    }
    
    const dayData = this.metrics.dailyMetrics.get(day);
    dayData.requests++;
    dayData.tokens += metrics.inputTokens + metrics.outputTokens;
    dayData.cachedTokens += metrics.cachedTokens || 0;
    dayData.cost += totalCost;
    dayData.saved += savedCost;
    
    // Log significant savings
    if (savedCost > 0.01) {
      console.log(`💰 Cache saved $${savedCost.toFixed(4)} on this request!`);
    }
  }
  
  // Get current performance metrics
  getPerformanceMetrics() {
    const USD_TO_ILS = 3.38;
    const uptimeHours = (Date.now() - this.startTime) / (1000 * 60 * 60);
    
    return {
      summary: {
        totalRequests: this.metrics.totalRequests,
        cachedRequests: this.metrics.cachedRequests,
        cacheHitRate: `${this.metrics.cacheHitRate}%`,
        totalTokens: this.metrics.totalInputTokens + this.metrics.totalOutputTokens,
        cachedTokens: this.metrics.cachedInputTokens,
        cacheEfficiency: this.metrics.totalInputTokens > 0 
          ? `${(this.metrics.cachedInputTokens / this.metrics.totalInputTokens * 100).toFixed(1)}%`
          : '0%'
      },
      costs: {
        totalCostUSD: `$${this.metrics.totalCostUSD.toFixed(4)}`,
        totalCostILS: `₪${(this.metrics.totalCostUSD * USD_TO_ILS).toFixed(2)}`,
        savedCostUSD: `$${this.metrics.savedCostUSD.toFixed(4)}`,
        savedCostILS: `₪${(this.metrics.savedCostUSD * USD_TO_ILS).toFixed(2)}`,
        savingsPercentage: this.metrics.totalCostUSD > 0
          ? `${(this.metrics.savedCostUSD / (this.metrics.totalCostUSD + this.metrics.savedCostUSD) * 100).toFixed(1)}%`
          : '0%',
        averageCostPerRequest: this.metrics.totalRequests > 0
          ? `$${(this.metrics.totalCostUSD / this.metrics.totalRequests).toFixed(4)}`
          : '$0'
      },
      projections: {
        hourlyRate: `$${((this.metrics.totalCostUSD / uptimeHours) || 0).toFixed(4)}/hour`,
        dailyRate: `$${((this.metrics.totalCostUSD / uptimeHours * 24) || 0).toFixed(2)}/day`,
        monthlyRate: `$${((this.metrics.totalCostUSD / uptimeHours * 24 * 30) || 0).toFixed(2)}/month`,
        hourlySavings: `$${((this.metrics.savedCostUSD / uptimeHours) || 0).toFixed(4)}/hour`,
        dailySavings: `$${((this.metrics.savedCostUSD / uptimeHours * 24) || 0).toFixed(2)}/day`,
        monthlySavings: `$${((this.metrics.savedCostUSD / uptimeHours * 24 * 30) || 0).toFixed(2)}/month`
      },
      cacheStats: {
        totalCacheWrites: this.metrics.cacheWriteTokens,
        totalCacheReads: this.metrics.cachedInputTokens,
        cacheWriteCost: `$${(this.metrics.cacheWriteTokens / 1000000 * 3.75).toFixed(4)}`, // 25% premium
        cacheReadSavings: `$${(this.metrics.cachedInputTokens / 1000000 * 2.7).toFixed(4)}`, // 90% discount
        netCacheBenefit: `$${((this.metrics.cachedInputTokens / 1000000 * 2.7) - (this.metrics.cacheWriteTokens / 1000000 * 0.75)).toFixed(4)}`
      }
    };
  }
  
  // Get session-specific metrics
  getSessionMetrics(sessionId) {
    const data = this.sessionMetrics.get(sessionId);
    if (!data) return null;
    
    const USD_TO_ILS = 3.38;
    return {
      sessionId,
      requests: data.requests,
      totalTokens: data.totalTokens,
      cachedTokens: data.cachedTokens,
      cacheRate: `${(data.cachedTokens / data.totalTokens * 100).toFixed(1)}%`,
      totalCostUSD: `$${data.totalCost.toFixed(4)}`,
      totalCostILS: `₪${(data.totalCost * USD_TO_ILS).toFixed(2)}`,
      savedCostUSD: `$${data.savedCost.toFixed(4)}`,
      savedCostILS: `₪${(data.savedCost * USD_TO_ILS).toFixed(2)}`,
      averageCostPerRequest: `$${(data.totalCost / data.requests).toFixed(4)}`
    };
  }
  
  // Get hourly breakdown
  getHourlyBreakdown() {
    const breakdown = [];
    for (const [hour, data] of this.metrics.hourlyMetrics) {
      breakdown.push({
        hour,
        requests: data.requests,
        tokens: data.tokens,
        cachedTokens: data.cachedTokens,
        cacheRate: `${(data.cachedTokens / data.tokens * 100).toFixed(1)}%`,
        cost: `$${data.cost.toFixed(4)}`,
        saved: `$${data.saved.toFixed(4)}`,
        efficiency: `${(data.saved / (data.cost + data.saved) * 100).toFixed(1)}%`
      });
    }
    return breakdown.sort((a, b) => b.hour.localeCompare(a.hour));
  }
  
  // Get daily breakdown
  getDailyBreakdown() {
    const breakdown = [];
    for (const [day, data] of this.metrics.dailyMetrics) {
      breakdown.push({
        day,
        requests: data.requests,
        tokens: data.tokens,
        cachedTokens: data.cachedTokens,
        cacheRate: `${(data.cachedTokens / data.tokens * 100).toFixed(1)}%`,
        cost: `$${data.cost.toFixed(4)}`,
        saved: `$${data.saved.toFixed(4)}`,
        efficiency: `${(data.saved / (data.cost + data.saved) * 100).toFixed(1)}%`
      });
    }
    return breakdown.sort((a, b) => b.day.localeCompare(a.day));
  }
  
  // Generate a performance report
  generateReport() {
    const metrics = this.getPerformanceMetrics();
    const USD_TO_ILS = 3.38;
    
    return `
╔══════════════════════════════════════════════════════════════╗
║          CLAUDE CACHE PERFORMANCE REPORT                      ║
╚══════════════════════════════════════════════════════════════╝

📊 SUMMARY
├─ Total Requests: ${metrics.summary.totalRequests}
├─ Cached Requests: ${metrics.summary.cachedRequests} (${metrics.summary.cacheHitRate})
├─ Total Tokens: ${metrics.summary.totalTokens.toLocaleString()}
├─ Cached Tokens: ${metrics.summary.cachedTokens.toLocaleString()}
└─ Cache Efficiency: ${metrics.summary.cacheEfficiency}

💰 COST ANALYSIS
├─ Total Cost: ${metrics.costs.totalCostUSD} (${metrics.costs.totalCostILS})
├─ Total Saved: ${metrics.costs.savedCostUSD} (${metrics.costs.savedCostILS})
├─ Savings Rate: ${metrics.costs.savingsPercentage}
└─ Avg Cost/Request: ${metrics.costs.averageCostPerRequest}

📈 PROJECTIONS
├─ Current Rate: ${metrics.projections.hourlyRate}
├─ Daily Cost: ${metrics.projections.dailyRate}
├─ Monthly Cost: ${metrics.projections.monthlyRate}
├─ Daily Savings: ${metrics.projections.dailySavings}
└─ Monthly Savings: ${metrics.projections.monthlySavings}

🔄 CACHE STATISTICS
├─ Cache Writes: ${metrics.cacheStats.totalCacheWrites.toLocaleString()} tokens
├─ Cache Reads: ${metrics.cacheStats.totalCacheReads.toLocaleString()} tokens
├─ Write Cost: ${metrics.cacheStats.cacheWriteCost}
├─ Read Savings: ${metrics.cacheStats.cacheReadSavings}
└─ Net Benefit: ${metrics.cacheStats.netCacheBenefit}

Generated: ${new Date().toLocaleString()}
`;
  }
  
  // Reset metrics (for testing or new period)
  resetMetrics() {
    this.metrics = {
      totalRequests: 0,
      cachedRequests: 0,
      totalInputTokens: 0,
      cachedInputTokens: 0,
      cacheWriteTokens: 0,
      totalOutputTokens: 0,
      totalCostUSD: 0,
      savedCostUSD: 0,
      cacheHitRate: 0,
      averageResponseTime: 0,
      hourlyMetrics: new Map(),
      dailyMetrics: new Map()
    };
    this.sessionMetrics.clear();
    this.startTime = Date.now();
  }
}

// Export singleton instance
module.exports = new ClaudeCacheMonitor();

/* Usage:

const cacheMonitor = require('./claudeCacheMonitor');

// Record each request
cacheMonitor.recordRequest(sessionId, {
  inputTokens: 5000,
  outputTokens: 500,
  cachedTokens: 3000,
  cacheWriteTokens: 100,
  inputCost: '0.015',
  outputCost: '0.0075',
  savedUSD: '0.009'
});

// Get performance metrics
const metrics = cacheMonitor.getPerformanceMetrics();
console.log(metrics);

// Generate report
const report = cacheMonitor.generateReport();
console.log(report);

// Get session-specific metrics
const sessionMetrics = cacheMonitor.getSessionMetrics('session-123');

// Get hourly/daily breakdowns
const hourly = cacheMonitor.getHourlyBreakdown();
const daily = cacheMonitor.getDailyBreakdown();

*/