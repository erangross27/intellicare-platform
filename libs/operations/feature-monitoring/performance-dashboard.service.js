const serviceAccountManager = require('../../../backend/services/serviceAccountManager');

class PerformanceDashboard {
  constructor() {
    this.startTime = Date.now();
    this.serviceToken = null;
    this.initialized = false;
  }

  async initialize() {
    try {
      this.serviceToken = await serviceAccountManager.authenticate('performance-dashboard-service');
      this.initialized = true;
      console.log('✅ Performance Dashboard Service initialized successfully');
    } catch (error) {
      console.error('❌ Failed to initialize Performance Dashboard Service:', error);
      throw error;
    }
  }

  async getFullReport() {
    const ConnectionPoolManager = require('../../../backend/services/connectionPoolManager');
    const ConnectionMetricsCollector = require('../../../backend/services/connectionMetricsCollector');

    const uptime = Math.floor((Date.now() - this.startTime) / 1000);

    // Try to get ServiceRegistry if available, fallback to default
    let services = [];
    try {
      const ServiceRegistry = require('../../../backend/services/serviceRegistry');
      services = ServiceRegistry.listServices();
    } catch (e) {
      // ServiceRegistry not available, use empty array
      services = [];
    }

    const report = {
      uptime: `${Math.floor(uptime / 3600)}h ${Math.floor((uptime % 3600) / 60)}m`,
      timestamp: new Date().toISOString(),

      connectionPool: ConnectionPoolManager.getStatus(),
      metrics: ConnectionMetricsCollector.getMetrics(),
      health: ConnectionMetricsCollector.getHealthStatus(),
      services: services,

      summary: {
        totalServices: services.length,
        poolUtilization: ConnectionMetricsCollector.getMetrics().poolUtilization,
        slowQueries: ConnectionMetricsCollector.getMetrics().slowQueryCount,
        connectionLeaks: ConnectionMetricsCollector.getMetrics().connectionLeaks.length
      }
    };

    // Generate recommendations
    report.recommendations = [];

    if (parseFloat(report.metrics.poolUtilization) > 80) {
      report.recommendations.push('Consider increasing connection pool max size');
    }

    if (report.metrics.slowQueryCount > 10) {
      report.recommendations.push('Review slow queries and add indexes');
    }

    if (report.metrics.connectionLeaks.length > 0) {
      report.recommendations.push('Investigate connection leaks: ' + report.metrics.connectionLeaks.join(', '));
    }

    return report;
  }

  printReport() {
    this.getFullReport().then(report => {
      console.log('\n📊 PERFORMANCE DASHBOARD');
      console.log('========================');
      console.log(`⏱️ Uptime: ${report.uptime}`);
      console.log(`📅 Report Time: ${report.timestamp}`);
      console.log('\n📈 Summary:');
      console.log(`  • Services: ${report.summary.totalServices}`);
      console.log(`  • Pool Usage: ${report.summary.poolUtilization}`);
      console.log(`  • Slow Queries: ${report.summary.slowQueries}`);
      console.log(`  • Connection Leaks: ${report.summary.connectionLeaks}`);

      if (report.recommendations.length > 0) {
        console.log('\n💡 Recommendations:');
        report.recommendations.forEach(r => console.log(`  • ${r}`));
      }

      console.log('\n✅ Health Status:', report.health.healthy ? 'HEALTHY' : 'DEGRADED');
      if (report.health.warnings.length > 0) {
        console.log('⚠️ Warnings:');
        report.health.warnings.forEach(w => console.log(`  • ${w}`));
      }
    });
  }
}

module.exports = new PerformanceDashboard();