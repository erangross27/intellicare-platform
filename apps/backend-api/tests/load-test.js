async function loadTest() {
  console.log('🏋️ Running load test...\n');

  const ConnectionPoolManager = require('../services/connectionPoolManager');
  const ServiceRegistry = require('../services/serviceRegistry');

  // Simulate heavy load
  console.log('Simulating 100 concurrent connection requests...');
  const start = Date.now();

  const promises = [];
  for (let i = 0; i < 100; i++) {
    promises.push(
      ConnectionPoolManager.acquireConnection(`test_db_${i % 10}`)
        .then(conn => {
          // Simulate some work
          return new Promise(resolve => setTimeout(resolve, Math.random() * 100));
        })
        .catch(e => console.log(`Request ${i} failed:`, e.message))
    );
  }

  await Promise.all(promises);
  const duration = Date.now() - start;

  console.log(`✅ Load test complete in ${duration}ms`);
  console.log(`Average response time: ${(duration / 100).toFixed(2)}ms per request`);

  // Check pool status after load
  const status = ConnectionPoolManager.getStatus();
  console.log(`\nPool status after load:`);
  console.log(`  • Pool size: ${status.poolSize}`);
  console.log(`  • Max connections: ${status.maxConnections}`);

  // Check for leaks
  const ConnectionMetricsCollector = require('../services/connectionMetricsCollector');
  const metrics = ConnectionMetricsCollector.getMetrics();

  if (metrics.connectionLeaks.length > 0) {
    console.log(`\n⚠️ Potential leaks detected: ${metrics.connectionLeaks.join(', ')}`);
  } else {
    console.log('\n✅ No connection leaks detected');
  }
}

loadTest().catch(console.error);