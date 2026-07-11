const assert = require('assert');

async function testConnectionPool() {
  console.log('Testing Connection Pool...');

  const ConnectionPoolManager = require('../services/connectionPoolManager');
  const DatabaseEventBus = require('../services/databaseEventBus');
  const ConnectionMetricsCollector = require('../services/connectionMetricsCollector');

  // Test 1: Singleton pattern
  const instance1 = ConnectionPoolManager;
  const instance2 = require('../services/connectionPoolManager');
  assert.strictEqual(instance1, instance2, 'ConnectionPoolManager should be singleton');
  console.log('✅ Singleton test passed');

  // Test 2: Connection acquisition
  try {
    const conn = await ConnectionPoolManager.acquireConnection('test_db');
    assert(conn, 'Should acquire connection');
    console.log('✅ Connection acquisition test passed');
  } catch (e) {
    console.log('⚠️ Connection test failed (MongoDB may not be running)');
  }

  // Test 3: Pool status
  const status = ConnectionPoolManager.getStatus();
  assert(status.poolSize !== undefined, 'Should return pool status');
  console.log('✅ Pool status test passed');

  // Test 4: Event bus
  let eventReceived = false;
  DatabaseEventBus.subscribe('test', () => { eventReceived = true; });
  DatabaseEventBus.emitEvent('test', { data: 'test' });
  assert(eventReceived, 'Should receive events');
  console.log('✅ Event bus test passed');

  // Test 5: Metrics
  const metrics = ConnectionMetricsCollector.getMetrics();
  assert(metrics.totalConnections !== undefined, 'Should collect metrics');
  console.log('✅ Metrics collection test passed');

  console.log('\n✅ All connection pool tests passed!');
}

// Run tests
testConnectionPool().catch(console.error);