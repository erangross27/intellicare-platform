/**
 * Performance Monitor Middleware
 * Tracks request timing, CPU usage, and identifies slow routes/services
 *
 * Usage: Add to server.js after other middleware
 */

const v8 = require('v8');
const os = require('os');

class PerformanceMonitor {
  constructor() {
    this.requestStats = new Map();
    this.slowRequests = [];
    this.serviceTimings = new Map();
    this.cpuSamples = [];
    this.memSamples = [];
    this.enabled = true;
    this.slowThreshold = 100; // ms - requests slower than this are logged
    this.sampleInterval = null;
    this.startTime = Date.now();
    this.lastCpuUsage = null; // For delta calculation
    this.cpuAlertThreshold = 80; // Only alert when CPU exceeds this % (per core)
    this.cpuAlertCount = 0; // Track consecutive high CPU samples
    this.cpuAlertMinSamples = 3; // Only alert after N consecutive high samples
    this.numCores = os.cpus().length;
  }

  /**
   * Express middleware to track request timing
   */
  middleware() {
    return (req, res, next) => {
      if (!this.enabled) return next();

      const start = process.hrtime.bigint();
      const route = `${req.method} ${req.path}`;

      // Track response finish
      res.on('finish', () => {
        const duration = Number(process.hrtime.bigint() - start) / 1e6; // Convert to ms

        // Update stats
        if (!this.requestStats.has(route)) {
          this.requestStats.set(route, {
            count: 0,
            totalTime: 0,
            minTime: Infinity,
            maxTime: 0,
            avgTime: 0
          });
        }

        const stats = this.requestStats.get(route);
        stats.count++;
        stats.totalTime += duration;
        stats.minTime = Math.min(stats.minTime, duration);
        stats.maxTime = Math.max(stats.maxTime, duration);
        stats.avgTime = stats.totalTime / stats.count;

        // Log slow requests
        if (duration > this.slowThreshold) {
          const slowEntry = {
            route,
            duration: duration.toFixed(2),
            timestamp: new Date().toISOString(),
            statusCode: res.statusCode
          };
          this.slowRequests.push(slowEntry);

          // Keep only last 100 slow requests
          if (this.slowRequests.length > 100) {
            this.slowRequests.shift();
          }

          console.log(`⚠️ SLOW REQUEST: ${route} took ${duration.toFixed(2)}ms`);
        }
      });

      next();
    };
  }

  /**
   * Start background CPU/Memory sampling
   */
  startSampling(intervalMs = 5000) {
    if (this.sampleInterval) return;

    // Initialize lastCpuUsage for delta calculation
    this.lastCpuUsage = process.cpuUsage();

    this.sampleInterval = setInterval(() => {
      // CPU usage - calculate DELTA since last sample (correct per-interval calculation)
      const currentCpuUsage = process.cpuUsage();
      const userDelta = currentCpuUsage.user - this.lastCpuUsage.user;
      const systemDelta = currentCpuUsage.system - this.lastCpuUsage.system;
      this.lastCpuUsage = currentCpuUsage;

      // Convert microseconds to percentage of interval time
      // Divide by numCores to get per-core average (0-100% scale)
      const intervalMicros = intervalMs * 1000;
      const cpuPercent = ((userDelta + systemDelta) / intervalMicros) * 100 / this.numCores;

      this.cpuSamples.push({
        timestamp: Date.now(),
        user: userDelta,
        system: systemDelta,
        percent: cpuPercent
      });

      // Memory usage
      const memUsage = process.memoryUsage();
      this.memSamples.push({
        timestamp: Date.now(),
        heapUsed: memUsage.heapUsed,
        heapTotal: memUsage.heapTotal,
        external: memUsage.external,
        rss: memUsage.rss
      });

      // Keep only last 720 samples (1 hour at 5s intervals)
      if (this.cpuSamples.length > 720) this.cpuSamples.shift();
      if (this.memSamples.length > 720) this.memSamples.shift();

      // Alert only if CPU exceeds threshold for consecutive samples
      if (cpuPercent > this.cpuAlertThreshold) {
        this.cpuAlertCount++;
        if (this.cpuAlertCount >= this.cpuAlertMinSamples) {
          console.log(`🔥 HIGH CPU ALERT: ${cpuPercent.toFixed(1)}% (sustained for ${this.cpuAlertCount * intervalMs / 1000}s)`);
          this.logActiveHandles();
          this.cpuAlertCount = 0; // Reset after alerting
        }
      } else {
        this.cpuAlertCount = 0; // Reset if CPU is normal
      }
    }, intervalMs);

    console.log(`📊 Performance sampling started (every ${intervalMs / 1000}s, alert threshold: ${this.cpuAlertThreshold}%)`);
  }

  /**
   * Stop background sampling
   */
  stopSampling() {
    if (this.sampleInterval) {
      clearInterval(this.sampleInterval);
      this.sampleInterval = null;
      console.log('📊 Performance sampling stopped');
    }
  }

  /**
   * Track service/function timing
   */
  trackService(serviceName, operation) {
    const start = process.hrtime.bigint();
    const key = `${serviceName}:${operation}`;

    return {
      end: () => {
        const duration = Number(process.hrtime.bigint() - start) / 1e6;

        if (!this.serviceTimings.has(key)) {
          this.serviceTimings.set(key, {
            count: 0,
            totalTime: 0,
            avgTime: 0,
            maxTime: 0
          });
        }

        const stats = this.serviceTimings.get(key);
        stats.count++;
        stats.totalTime += duration;
        stats.avgTime = stats.totalTime / stats.count;
        stats.maxTime = Math.max(stats.maxTime, duration);

        if (duration > 1000) {
          console.log(`⚠️ SLOW SERVICE: ${key} took ${duration.toFixed(2)}ms`);
        }

        return duration;
      }
    };
  }

  /**
   * Log active handles (timers, intervals, etc.)
   */
  logActiveHandles() {
    const handles = process._getActiveHandles();
    const requests = process._getActiveRequests();

    console.log(`📊 Active handles: ${handles.length}, Active requests: ${requests.length}`);

    // Group handles by type
    const handleTypes = {};
    handles.forEach(h => {
      const type = h.constructor.name;
      handleTypes[type] = (handleTypes[type] || 0) + 1;
    });

    console.log('📊 Handle types:', JSON.stringify(handleTypes));
  }

  /**
   * Get performance report
   */
  getReport() {
    const uptime = (Date.now() - this.startTime) / 1000;

    // Sort routes by total time (most time-consuming first)
    const routeStats = Array.from(this.requestStats.entries())
      .map(([route, stats]) => ({ route, ...stats }))
      .sort((a, b) => b.totalTime - a.totalTime)
      .slice(0, 20);

    // Sort services by average time
    const serviceStats = Array.from(this.serviceTimings.entries())
      .map(([service, stats]) => ({ service, ...stats }))
      .sort((a, b) => b.avgTime - a.avgTime)
      .slice(0, 20);

    // Current memory
    const mem = process.memoryUsage();
    const heapStats = v8.getHeapStatistics();

    // Average CPU over samples
    const avgCpu = this.cpuSamples.length > 0
      ? this.cpuSamples.reduce((sum, s) => sum + s.percent, 0) / this.cpuSamples.length
      : 0;

    return {
      uptime: `${uptime.toFixed(0)}s`,
      memory: {
        heapUsed: `${(mem.heapUsed / 1024 / 1024).toFixed(1)}MB`,
        heapTotal: `${(mem.heapTotal / 1024 / 1024).toFixed(1)}MB`,
        rss: `${(mem.rss / 1024 / 1024).toFixed(1)}MB`,
        external: `${(mem.external / 1024 / 1024).toFixed(1)}MB`,
        heapLimit: `${(heapStats.heap_size_limit / 1024 / 1024).toFixed(0)}MB`
      },
      cpu: {
        averagePercent: avgCpu.toFixed(1),
        samples: this.cpuSamples.length
      },
      activeHandles: process._getActiveHandles().length,
      activeRequests: process._getActiveRequests().length,
      slowestRoutes: routeStats,
      slowestServices: serviceStats,
      recentSlowRequests: this.slowRequests.slice(-10),
      totalRequests: Array.from(this.requestStats.values()).reduce((sum, s) => sum + s.count, 0)
    };
  }

  /**
   * Get active intervals/timers (helps identify CPU hogs)
   */
  getActiveTimers() {
    const handles = process._getActiveHandles();
    const timers = handles.filter(h =>
      h.constructor.name === 'Timeout' ||
      h.constructor.name === 'Timer' ||
      h._repeat !== undefined
    );

    return {
      count: timers.length,
      intervals: timers.filter(t => t._repeat).length,
      timeouts: timers.filter(t => !t._repeat).length
    };
  }

  /**
   * Reset all stats
   */
  reset() {
    this.requestStats.clear();
    this.slowRequests = [];
    this.serviceTimings.clear();
    this.cpuSamples = [];
    this.memSamples = [];
    console.log('📊 Performance stats reset');
  }
}

// Singleton instance
const monitor = new PerformanceMonitor();

module.exports = monitor;
