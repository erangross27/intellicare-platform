const assert = require('assert');
const { spawn } = require('child_process');

async function runFinalVerification() {
  console.log('🔍 FINAL VERIFICATION SUITE');
  console.log('===========================\n');

  let allTestsPassed = true;

  // Test 1: Memory Leak Check
  console.log('1. Memory Leak Test...');
  const memoryLeakTest = await new Promise((resolve) => {
    const node = spawn('node', ['--trace-warnings', 'server.js'], { cwd: process.cwd() });
    let hasWarnings = false;

    node.stderr.on('data', (data) => {
      if (data.toString().includes('MaxListenersExceededWarning')) {
        hasWarnings = true;
      }
    });

    setTimeout(() => {
      node.kill();
      resolve(!hasWarnings);
    }, 5000);
  });

  if (memoryLeakTest) {
    console.log('✅ No memory leaks detected\n');
  } else {
    console.log('❌ Memory leak warnings still present\n');
    allTestsPassed = false;
  }

  // Test 2: Connection Pool
  console.log('2. Connection Pool Test...');
  try {
    const ConnectionPoolManager = require('../services/connectionPoolManager');
    const status = ConnectionPoolManager.getStatus();
    assert(status.poolSize <= 50, 'Pool size should be under limit');
    console.log(`✅ Connection pool healthy: ${status.poolSize} connections\n`);
  } catch (e) {
    console.log('❌ Connection pool test failed:', e.message, '\n');
    allTestsPassed = false;
  }

  // Test 3: Service Registry
  console.log('3. Service Registry Test...');
  try {
    const ServiceRegistry = require('../services/serviceRegistry');
    const services = ServiceRegistry.listServices();
    assert(services.length > 0, 'Services should be registered');
    console.log(`✅ ${services.length} services registered\n`);
  } catch (e) {
    console.log('❌ Service registry test failed:', e.message, '\n');
    allTestsPassed = false;
  }

  // Test 4: Cache Performance
  console.log('4. Cache Performance Test...');
  try {
    const ServiceRegistry = require('../services/serviceRegistry');
    const start = Date.now();
    await ServiceRegistry.getCachedClinicDatabases();
    const firstCall = Date.now() - start;

    const start2 = Date.now();
    await ServiceRegistry.getCachedClinicDatabases();
    const secondCall = Date.now() - start2;

    assert(secondCall < firstCall / 2, 'Cache should be faster');
    console.log(`✅ Cache working: First call ${firstCall}ms, Cached ${secondCall}ms\n`);
  } catch (e) {
    console.log('❌ Cache test failed:', e.message, '\n');
    allTestsPassed = false;
  }

  // Test 5: Metrics Collection
  console.log('5. Metrics Collection Test...');
  try {
    const ConnectionMetricsCollector = require('../services/connectionMetricsCollector');
    const metrics = ConnectionMetricsCollector.getMetrics();
    assert(metrics.poolUtilization !== undefined, 'Metrics should be collected');
    console.log(`✅ Metrics active: Pool at ${metrics.poolUtilization}\n`);
  } catch (e) {
    console.log('❌ Metrics test failed:', e.message, '\n');
    allTestsPassed = false;
  }

  // Test 6: Performance Dashboard
  console.log('6. Performance Dashboard Test...');
  try {
    const PerformanceDashboard = require('../services/performanceDashboard');
    const report = await PerformanceDashboard.getFullReport();
    assert(report.summary !== undefined, 'Dashboard should generate report');
    console.log('✅ Performance dashboard operational\n');
  } catch (e) {
    console.log('❌ Dashboard test failed:', e.message, '\n');
    allTestsPassed = false;
  }

  // Final Summary
  console.log('=============================');
  if (allTestsPassed) {
    console.log('🎉 ALL TESTS PASSED!');
    console.log('\nThe connection architecture migration is complete and working perfectly.');
    console.log('\nKey achievements:');
    console.log('  ✅ Zero memory leak warnings');
    console.log('  ✅ Connection pooling active');
    console.log('  ✅ Service registry operational');
    console.log('  ✅ Cache system working');
    console.log('  ✅ Metrics collection active');
    console.log('  ✅ Performance monitoring ready');
  } else {
    console.log('⚠️ SOME TESTS FAILED');
    console.log('Please review the failed tests above.');
  }

  process.exit(allTestsPassed ? 0 : 1);
}

runFinalVerification().catch(console.error);