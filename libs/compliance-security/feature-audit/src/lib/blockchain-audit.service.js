/**
 * 🔗 BLOCKCHAIN AUDIT SERVICE
 * Blockchain-based verification for critical medical events with timestamped, tamper-proof records
 * SECURITY: All database access through SecureDataAccess
 */

const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

// ServiceProxy setup for dependency management
let serviceProxyManager = null;
function getServiceProxy() {
  if (!serviceProxyManager) {
    serviceProxyManager = require('../../../../../backend/services/serviceProxyManager');
  }
  return serviceProxyManager;
}

class Block {
  constructor(index, timestamp, data, previousHash) {
    this.index = index;
    this.timestamp = timestamp;
    this.data = data;
    this.previousHash = previousHash;
    this.nonce = 0;
    this.hash = this.calculateHash();
  }

  // Calculate block hash with proof-of-work
  calculateHash() {
    return crypto
      .createHash('sha256')
      .update(this.index + this.previousHash + this.timestamp + JSON.stringify(this.data) + this.nonce)
      .digest('hex');
  }

  // Mine block with difficulty (proof-of-work)
  mineBlock(difficulty) {
    const target = Array(difficulty + 1).join('0');
    
    while (this.hash.substring(0, difficulty) !== target) {
      this.nonce++;
      this.hash = this.calculateHash();
    }

    console.log(`⛏️  Block mined: ${this.hash} (nonce: ${this.nonce})`);
  }
}

class BlockchainAuditService {
  constructor() {
    this.serviceToken = null;
    this.chain = [this.createGenesisBlock()];
    this.difficulty = 2; // Proof-of-work difficulty
    this.pendingTransactions = [];
    this.miningReward = 0; // No reward for audit blockchain
    this.blockchainFile = path.join(__dirname, '../../../../../../../backend/logs/blockchain-audit.json');
    this.criticalEvents = [
      'patient_created',
      'patient_deleted',
      'document_uploaded',
      'document_deleted',
      'user_login',
      'user_logout',
      'permission_changed',
      'key_rotated',
      'security_incident',
      'data_export',
      'system_backup',
      'system_restore'
    ];
  }

  async initialize() {
    try {
      const proxy = getServiceProxy();
      const serviceAccountManager = proxy.getService('serviceAccountManager');
      this.serviceToken = await serviceAccountManager.authenticate('blockchain-audit-service');
      await this.loadBlockchain();
      // Blockchain Audit Service initialized
    } catch (error) {
      console.error('❌ Failed to initialize Blockchain Audit Service:', error);
      throw error;
    }
  }

  getServiceContext(practiceId = 'global', operation = 'blockchain-audit') {
    return {
      serviceId: 'blockchain-audit-service',
      operation,
      practiceId
    };
  }

  // Create genesis block
  createGenesisBlock() {
    const genesisData = {
      type: 'genesis',
      message: 'IntelliCare Medical Audit Blockchain Genesis Block',
      timestamp: new Date().toISOString(),
      version: '1.0.0'
    };
    
    return new Block(0, new Date().toISOString(), genesisData, '0');
  }

  // Get latest block
  getLatestBlock() {
    return this.chain[this.chain.length - 1];
  }

  // Add critical event to blockchain
  async addCriticalEvent(eventData) {
    if (!this.serviceToken) {
      await this.initialize();
    }

    // Validate if event is critical
    if (!this.criticalEvents.includes(eventData.type)) {
      console.log(`ℹ️  Event ${eventData.type} not critical - skipping blockchain`);
      return null;
    }

    const auditRecord = {
      id: crypto.randomUUID(),
      type: eventData.type,
      timestamp: new Date().toISOString(),
      userId: eventData.userId,
      sessionId: eventData.sessionId,
      clientIp: eventData.clientIp,
      details: eventData.details,
      metadata: eventData.metadata || {},
      digitalSignature: this.createDigitalSignature(eventData)
    };

    // Create new block
    const newBlock = new Block(
      this.chain.length,
      auditRecord.timestamp,
      auditRecord,
      this.getLatestBlock().hash
    );

    // Mine the block (proof-of-work)
    newBlock.mineBlock(this.difficulty);

    // Add to chain
    this.chain.push(newBlock);

    // Persist blockchain
    await this.saveBlockchain();

    // Also store in database for queryability
    const proxy = getServiceProxy();
    const secureDataAccess = proxy.getService('secureDataAccess');
    await secureDataAccess.create('blockchain_audit_records', {
      blockIndex: newBlock.index,
      blockHash: newBlock.hash,
      eventType: eventData.type,
      userId: eventData.userId,
      timestamp: new Date(auditRecord.timestamp),
      auditRecord: auditRecord,
      createdAt: new Date()
    }, this.getServiceContext('global', 'add-critical-event'));

    console.log(`🔗 Critical event added to blockchain: ${eventData.type} (Block #${newBlock.index})`);
    return newBlock;
  }

  // Create digital signature for event
  createDigitalSignature(eventData) {
    const dataString = JSON.stringify({
      type: eventData.type,
      userId: eventData.userId,
      timestamp: eventData.timestamp,
      details: eventData.details
    }, Object.keys(eventData).sort());

    return crypto.createHash('sha256').update(dataString).digest('hex');
  }

  // Validate blockchain integrity
  isChainValid() {
    for (let i = 1; i < this.chain.length; i++) {
      const currentBlock = this.chain[i];
      const previousBlock = this.chain[i - 1];

      // Validate current block hash
      if (currentBlock.hash !== currentBlock.calculateHash()) {
        console.error(`🚨 Invalid hash at block ${i}: ${currentBlock.hash}`);
        return false;
      }

      // Validate chain linkage
      if (currentBlock.previousHash !== previousBlock.hash) {
        console.error(`🚨 Invalid previous hash at block ${i}`);
        return false;
      }

      // Validate proof-of-work
      if (currentBlock.hash.substring(0, this.difficulty) !== Array(this.difficulty + 1).join('0')) {
        console.error(`🚨 Invalid proof-of-work at block ${i}`);
        return false;
      }
    }

    return true;
  }

  // Save blockchain to disk
  async saveBlockchain() {
    try {
      const blockchainData = {
        chain: this.chain,
        difficulty: this.difficulty,
        lastUpdate: new Date().toISOString(),
        chainHash: this.calculateChainHash()
      };

      await fs.writeFile(this.blockchainFile, JSON.stringify(blockchainData, null, 2));
    } catch (error) {
      console.error('❌ Failed to save blockchain:', error);
    }
  }

  // Load blockchain from disk
  async loadBlockchain() {
    try {
      const blockchainContent = await fs.readFile(this.blockchainFile, 'utf8');
      const blockchainData = JSON.parse(blockchainContent);
      
      // Reconstruct blocks
      this.chain = blockchainData.chain.map(blockData => {
        const block = new Block(
          blockData.index,
          blockData.timestamp,
          blockData.data,
          blockData.previousHash
        );
        block.hash = blockData.hash;
        block.nonce = blockData.nonce;
        return block;
      });

      this.difficulty = blockchainData.difficulty;

      // Validate loaded chain
      if (!this.isChainValid()) {
        throw new Error('Loaded blockchain is invalid');
      }

      // Blockchain audit chain loaded from disk
    } catch (error) {
      // Starting new blockchain (no existing chain found)
      this.chain = [this.createGenesisBlock()];
    }
  }

  // Calculate overall chain hash
  calculateChainHash() {
    const chainData = this.chain.map(block => block.hash).join('');
    return crypto.createHash('sha256').update(chainData).digest('hex');
  }

  // Get blockchain statistics
  getBlockchainStats() {
    const eventTypes = {};
    const userActivity = {};
    let totalEvents = 0;

    this.chain.forEach(block => {
      if (block.data.type && block.data.type !== 'genesis') {
        totalEvents++;
        eventTypes[block.data.type] = (eventTypes[block.data.type] || 0) + 1;
        
        if (block.data.userId) {
          userActivity[block.data.userId] = (userActivity[block.data.userId] || 0) + 1;
        }
      }
    });

    return {
      totalBlocks: this.chain.length,
      totalEvents,
      eventTypes,
      userActivity,
      chainValid: this.isChainValid(),
      chainHash: this.calculateChainHash(),
      difficulty: this.difficulty,
      lastBlock: this.getLatestBlock()
    };
  }

  // Search blockchain events
  searchBlockchain(criteria) {
    const results = [];

    this.chain.forEach(block => {
      if (block.data.type === 'genesis') return;

      let matches = true;

      if (criteria.eventType && block.data.type !== criteria.eventType) matches = false;
      if (criteria.userId && block.data.userId !== criteria.userId) matches = false;
      if (criteria.startDate && new Date(block.timestamp) < new Date(criteria.startDate)) matches = false;
      if (criteria.endDate && new Date(block.timestamp) > new Date(criteria.endDate)) matches = false;

      if (matches) {
        results.push({
          blockIndex: block.index,
          blockHash: block.hash,
          timestamp: block.timestamp,
          event: block.data
        });
      }
    });

    return {
      results,
      totalFound: results.length,
      searchCriteria: criteria,
      chainIntegrity: this.isChainValid()
    };
  }

  // Export blockchain for compliance
  async exportBlockchain(format = 'json') {
    const exportData = {
      exportTimestamp: new Date().toISOString(),
      exportId: crypto.randomUUID(),
      blockchain: {
        totalBlocks: this.chain.length,
        chainHash: this.calculateChainHash(),
        isValid: this.isChainValid(),
        difficulty: this.difficulty
      },
      blocks: this.chain.map(block => ({
        index: block.index,
        timestamp: block.timestamp,
        hash: block.hash,
        previousHash: block.previousHash,
        nonce: block.nonce,
        data: block.data
      }))
    };

    if (format === 'csv') {
      return this.convertBlockchainToCSV(exportData);
    }

    return exportData;
  }

  // Convert blockchain to CSV
  convertBlockchainToCSV(exportData) {
    const headers = ['Block Index', 'Timestamp', 'Block Hash', 'Event Type', 'User ID', 'Details', 'Digital Signature'];
    const rows = exportData.blocks
      .filter(block => block.data.type !== 'genesis')
      .map(block => [
        block.index,
        block.timestamp,
        block.hash,
        block.data.type,
        block.data.userId || '',
        block.data.details || '',
        block.data.digitalSignature || ''
      ]);

    const csvContent = [
      `# Blockchain Audit Export`,
      `# Export ID: ${exportData.exportId}`,
      `# Export Time: ${exportData.exportTimestamp}`,
      `# Total Blocks: ${exportData.blockchain.totalBlocks}`,
      `# Chain Valid: ${exportData.blockchain.isValid}`,
      `# Chain Hash: ${exportData.blockchain.chainHash}`,
      '',
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(','))
    ].join('\n');

    return csvContent;
  }

  // Verify specific block
  verifyBlock(blockIndex) {
    if (blockIndex >= this.chain.length) {
      return { valid: false, error: 'Block index out of range' };
    }

    const block = this.chain[blockIndex];
    const isValid = block.hash === block.calculateHash();

    return {
      valid: isValid,
      block: {
        index: block.index,
        hash: block.hash,
        timestamp: block.timestamp,
        data: block.data
      }
    };
  }
}

// Register with ServiceProxy
if (typeof module !== 'undefined' && module.exports) {
  const proxy = getServiceProxy();
  proxy.registerService('blockchainAuditService', () => module.exports);
}

module.exports = BlockchainAuditService;