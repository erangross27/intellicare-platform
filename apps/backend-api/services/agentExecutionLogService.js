// Agent Execution Log Service
// Tracks all function calls, thinking messages, errors, and decisions during agent execution
// Provides comprehensive audit trail and debugging information

const { ObjectId } = require('mongodb');
const SecureDataAccess = require('./secureDataAccess');

class AgentExecutionLogService {
  /**
   * Create a new execution log entry when agent starts processing
   * @param {string} sessionId - Chat session ID
   * @param {string} userId - User ID
   * @param {string} message - User's input message
   * @param {object} context - Security context
   * @returns {Promise<string>} - executionLogId
   */
  static async createExecutionLog(sessionId, userId, message, context) {
    try {
      const executionLogId = `exec_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

      const logEntry = {
        executionLogId,
        sessionId,
        userId,
        initialMessage: message,
        status: 'in_progress', // in_progress, completed, failed
        startTime: new Date(),
        endTime: null,
        totalDuration: null,

        // Tracking arrays
        thinkingMessages: [],      // All thinking messages in order
        functionCalls: [],         // All function calls with params/results
        errors: [],                // All errors encountered
        fallbacks: [],             // All fallback mechanisms used

        // Metadata
        metadata: {
          functionCount: 0,
          errorCount: 0,
          fallbackCount: 0,
          thinkingMessageCount: 0
        },

        createdAt: new Date(),
        updatedAt: new Date()
      };

      await SecureDataAccess.insert('agent_execution_logs', logEntry, context);
      console.log(`✅ Created execution log: ${executionLogId}`);
      return executionLogId;
    } catch (error) {
      console.error('Error creating execution log:', error);
      throw error;
    }
  }

  /**
   * Log a thinking message
   * @param {string} executionLogId - ID of execution log
   * @param {string} message - Thinking message content
   * @param {number} order - Order in sequence
   * @param {object} context - Security context
   */
  static async logThinkingMessage(executionLogId, message, order, context) {
    try {
      const thinkingEntry = {
        timestamp: new Date(),
        order,
        content: message,
        length: message.length
      };

      await SecureDataAccess.update(
        'agent_execution_logs',
        { executionLogId },
        {
          $push: { thinkingMessages: thinkingEntry },
          $inc: { 'metadata.thinkingMessageCount': 1 },
          $set: { updatedAt: new Date() }
        },
        context
      );
    } catch (error) {
      console.error('Error logging thinking message:', error);
      // Non-blocking - don't fail the entire flow
    }
  }

  /**
   * Log a function call with parameters and execution details
   * @param {string} executionLogId - ID of execution log
   * @param {string} functionName - Name of function called
   * @param {object} params - Input parameters
   * @param {object} result - Function result/output
   * @param {number} duration - Execution duration in ms
   * @param {boolean} success - Whether function succeeded
   * @param {string} error - Error message if failed
   * @param {object} context - Security context
   */
  static async logFunctionCall(executionLogId, functionName, params, result, duration, success, error, context) {
    try {
      const functionCallEntry = {
        timestamp: new Date(),
        functionName,
        params: this._sanitizeParams(params), // Remove sensitive data
        resultSummary: this._getResultSummary(result),
        duration,
        success,
        error: error || null,
        resultSize: JSON.stringify(result || {}).length
      };

      await SecureDataAccess.update(
        'agent_execution_logs',
        { executionLogId },
        {
          $push: { functionCalls: functionCallEntry },
          $inc: {
            'metadata.functionCount': 1,
            ...(error && { 'metadata.errorCount': 1 })
          },
          $set: { updatedAt: new Date() }
        },
        context
      );
    } catch (err) {
      console.error('Error logging function call:', err);
      // Non-blocking - don't fail the entire flow
    }
  }

  /**
   * Log an error that occurred during execution
   * @param {string} executionLogId - ID of execution log
   * @param {string} errorType - Type of error (function_error, timeout, etc.)
   * @param {string} message - Error message
   * @param {string} context_info - Additional context about where error occurred
   * @param {object} context - Security context
   */
  static async logError(executionLogId, errorType, message, context_info, context) {
    try {
      const errorEntry = {
        timestamp: new Date(),
        type: errorType,
        message,
        context: context_info,
        stack: new Error().stack
      };

      await SecureDataAccess.update(
        'agent_execution_logs',
        { executionLogId },
        {
          $push: { errors: errorEntry },
          $inc: { 'metadata.errorCount': 1 },
          $set: { updatedAt: new Date() }
        },
        context
      );
    } catch (err) {
      console.error('Error logging error:', err);
      // Non-blocking - don't fail the entire flow
    }
  }

  /**
   * Log use of fallback mechanism
   * @param {string} executionLogId - ID of execution log
   * @param {string} fallbackType - Type of fallback (cache_hit, economy_mode, etc.)
   * @param {string} reason - Why fallback was triggered
   * @param {object} details - Additional fallback details
   * @param {object} context - Security context
   */
  static async logFallback(executionLogId, fallbackType, reason, details, context) {
    try {
      const fallbackEntry = {
        timestamp: new Date(),
        type: fallbackType,
        reason,
        details
      };

      await SecureDataAccess.update(
        'agent_execution_logs',
        { executionLogId },
        {
          $push: { fallbacks: fallbackEntry },
          $inc: { 'metadata.fallbackCount': 1 },
          $set: { updatedAt: new Date() }
        },
        context
      );
    } catch (err) {
      console.error('Error logging fallback:', err);
      // Non-blocking - don't fail the entire flow
    }
  }

  /**
   * Complete execution log when agent finishes
   * @param {string} executionLogId - ID of execution log
   * @param {boolean} success - Whether execution succeeded overall
   * @param {string} finalStatus - Final status message
   * @param {object} result - Final result from agent
   * @param {object} context - Security context
   */
  static async completeExecutionLog(executionLogId, success, finalStatus, result, context) {
    try {
      const startLog = await SecureDataAccess.query(
        'agent_execution_logs',
        { executionLogId },
        {},
        context
      );

      if (!startLog || startLog.length === 0) {
        console.warn(`Execution log not found: ${executionLogId}`);
        return;
      }

      const startTime = new Date(startLog[0].startTime);
      const endTime = new Date();
      const totalDuration = endTime - startTime;

      await SecureDataAccess.update(
        'agent_execution_logs',
        { executionLogId },
        {
          $set: {
            status: success ? 'completed' : 'failed',
            endTime,
            totalDuration,
            finalStatus,
            resultSummary: this._getResultSummary(result),
            updatedAt: new Date()
          }
        },
        context
      );

      console.log(`✅ Completed execution log: ${executionLogId} (${totalDuration}ms)`);
    } catch (error) {
      console.error('Error completing execution log:', error);
      // Non-blocking - don't fail the entire flow
    }
  }

  /**
   * Retrieve execution log with all details
   * @param {string} executionLogId - ID of execution log
   * @param {object} context - Security context
   * @returns {Promise<object>} - Complete execution log
   */
  static async getExecutionLog(executionLogId, context) {
    try {
      const logs = await SecureDataAccess.query(
        'agent_execution_logs',
        { executionLogId },
        {},
        context
      );
      return logs[0] || null;
    } catch (error) {
      console.error('Error retrieving execution log:', error);
      throw error;
    }
  }

  /**
   * Get execution logs for a session
   * @param {string} sessionId - Chat session ID
   * @param {number} limit - Max number of logs to return
   * @param {object} context - Security context
   * @returns {Promise<array>} - Array of execution logs
   */
  static async getSessionExecutionLogs(sessionId, limit = 50, context) {
    try {
      const logs = await SecureDataAccess.query(
        'agent_execution_logs',
        { sessionId },
        { sort: { startTime: -1 }, limit },
        context
      );
      return logs;
    } catch (error) {
      console.error('Error retrieving session execution logs:', error);
      throw error;
    }
  }

  /**
   * Get execution statistics for a user or session
   * @param {string} filterType - 'userId' or 'sessionId'
   * @param {string} filterId - ID value
   * @param {object} context - Security context
   * @returns {Promise<object>} - Statistics object
   */
  static async getExecutionStatistics(filterType, filterId, context) {
    try {
      const filter = { [filterType]: filterId };

      const logs = await SecureDataAccess.query(
        'agent_execution_logs',
        filter,
        { sort: { startTime: -1 }, limit: 100 },
        context
      );

      if (logs.length === 0) {
        return {
          totalExecutions: 0,
          successfulExecutions: 0,
          failedExecutions: 0,
          totalDuration: 0,
          averageDuration: 0,
          totalFunctionCalls: 0,
          totalErrors: 0,
          totalThinkingMessages: 0,
          averageFunctionsPerExecution: 0
        };
      }

      const stats = {
        totalExecutions: logs.length,
        successfulExecutions: logs.filter(l => l.status === 'completed').length,
        failedExecutions: logs.filter(l => l.status === 'failed').length,
        totalDuration: logs.reduce((sum, l) => sum + (l.totalDuration || 0), 0),
        totalFunctionCalls: logs.reduce((sum, l) => sum + (l.metadata?.functionCount || 0), 0),
        totalErrors: logs.reduce((sum, l) => sum + (l.metadata?.errorCount || 0), 0),
        totalThinkingMessages: logs.reduce((sum, l) => sum + (l.metadata?.thinkingMessageCount || 0), 0),
        totalFallbacks: logs.reduce((sum, l) => sum + (l.metadata?.fallbackCount || 0), 0)
      };

      stats.averageDuration = Math.round(stats.totalDuration / stats.totalExecutions);
      stats.averageFunctionsPerExecution = Math.round(stats.totalFunctionCalls / stats.totalExecutions);
      stats.successRate = Math.round((stats.successfulExecutions / stats.totalExecutions) * 100);

      return stats;
    } catch (error) {
      console.error('Error retrieving execution statistics:', error);
      throw error;
    }
  }

  // ============ HELPER METHODS ============

  /**
   * Sanitize parameters to remove sensitive data
   * @private
   */
  static _sanitizeParams(params) {
    if (!params) return null;

    const sanitized = { ...params };

    // Remove sensitive fields
    const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'ssn', 'socialSecurityNumber'];
    sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    });

    return sanitized;
  }

  /**
   * Get a summary of result object
   * @private
   */
  static _getResultSummary(result) {
    if (!result) return null;
    if (typeof result === 'string') return result.substring(0, 200);
    if (Array.isArray(result)) return `Array with ${result.length} items`;
    if (typeof result === 'object') {
      return {
        keys: Object.keys(result).slice(0, 5),
        hasError: !!result.error,
        hasData: !!result.data
      };
    }
    return String(result).substring(0, 200);
  }
}

module.exports = AgentExecutionLogService;
