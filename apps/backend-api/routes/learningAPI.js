/**
 * Learning API Routes
 * 
 * Express routes that expose the learning system to the platform
 * Integrates with the learning API gateway for all operations
 */

const express = require('express');
const router = express.Router();
const learningAPIGateway = require('../services/learning/learningAPIGateway');
const SecureDataAccess = require('../services/secureDataAccess');
const { requireAuth, validateCSRF, requireRole } = require('../middleware/sessionValidation');
const { validateClinicAccess } = require('../middleware/sessionValidation');

// Initialize learning gateway on module load
learningAPIGateway.initialize().catch(error => {
    console.error('Failed to initialize learning API gateway:', error);
});

/**
 * Middleware to add context to requests
 */
const addLearningContext = (req, res, next) => {
    req.learningContext = {
        userId: req.user?.id || req.session?.userId,
        practiceId: req.practice?.id || req.session?.practiceId,
        role: req.user?.role || 'user',
        sessionId: req.sessionID,
        timestamp: new Date(),
        source: 'web',
        ip: req.ip
    };
    next();
};

/**
 * @route POST /api/learn/interaction
 * @desc Capture user interaction for learning
 * @access Private
 */
router.post('/interaction', 
    requireAuth, 
    validateCSRF,
    validateClinicAccess,
    addLearningContext,
    async (req, res) => {
        try {
            const result = await learningAPIGateway.handleRequest(
                'POST',
                '/learn/interaction',
                req.body,
                req.learningContext
            );
            
            res.json({
                success: true,
                data: result
            });
        } catch (error) {
            console.error('Error capturing interaction:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);

/**
 * @route GET /api/learn/predict/workflow
 * @desc Get workflow predictions based on current steps
 * @access Private
 */
router.get('/predict/workflow',
    requireAuth,
    validateClinicAccess,
    addLearningContext,
    async (req, res) => {
        try {
            const { steps } = req.query;
            const currentSteps = steps ? JSON.parse(steps) : [];
            
            const predictions = await learningAPIGateway.handleRequest(
                'GET',
                '/learn/predict/workflow',
                { currentSteps },
                req.learningContext
            );
            
            res.json({
                success: true,
                predictions
            });
        } catch (error) {
            console.error('Error predicting workflow:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);

/**
 * @route GET /api/learn/predict/next-action
 * @desc Predict next user action
 * @access Private
 */
router.get('/predict/next-action',
    requireAuth,
    validateClinicAccess,
    addLearningContext,
    async (req, res) => {
        try {
            const { currentAction } = req.query;
            
            const prediction = await learningAPIGateway.handleRequest(
                'GET',
                '/learn/predict/next-action',
                { currentAction },
                req.learningContext
            );
            
            res.json({
                success: true,
                prediction
            });
        } catch (error) {
            console.error('Error predicting next action:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);

/**
 * @route GET /api/learn/assistant/suggestions
 * @desc Get personalized suggestions for current user
 * @access Private
 */
router.get('/assistant/suggestions',
    requireAuth,
    validateClinicAccess,
    addLearningContext,
    async (req, res) => {
        try {
            const suggestions = await learningAPIGateway.handleRequest(
                'GET',
                '/learn/assistant/suggestions',
                req.query,
                req.learningContext
            );
            
            res.json({
                success: true,
                suggestions
            });
        } catch (error) {
            console.error('Error getting suggestions:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);

/**
 * @route POST /api/learn/assistant/feedback
 * @desc Submit feedback on a suggestion
 * @access Private
 */
router.post('/assistant/feedback',
    requireAuth,
    validateCSRF,
    validateClinicAccess,
    addLearningContext,
    async (req, res) => {
        try {
            const result = await learningAPIGateway.handleRequest(
                'POST',
                '/learn/assistant/feedback',
                req.body,
                req.learningContext
            );
            
            res.json({
                success: true,
                data: result
            });
        } catch (error) {
            console.error('Error submitting feedback:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);

/**
 * @route GET /api/learn/analysis/efficiency
 * @desc Get efficiency analysis for user or practice
 * @access Private
 */
router.get('/analysis/efficiency',
    requireAuth,
    validateClinicAccess,
    addLearningContext,
    async (req, res) => {
        try {
            const { type = 'user', timeframe = '7d' } = req.query;
            
            const analysis = await learningAPIGateway.handleRequest(
                'GET',
                '/learn/analysis/efficiency',
                { type, timeframe },
                req.learningContext
            );
            
            res.json({
                success: true,
                analysis
            });
        } catch (error) {
            console.error('Error getting efficiency analysis:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);

/**
 * @route GET /api/learn/analysis/bottlenecks
 * @desc Get bottleneck analysis for practice
 * @access Private (Admin)
 */
router.get('/analysis/bottlenecks',
    requireAuth,
    validateClinicAccess,
    addLearningContext,
    async (req, res) => {
        try {
            // Check admin permission
            if (req.learningContext.role !== 'admin' && 
                req.learningContext.role !== 'super_admin') {
                return res.status(403).json({
                    success: false,
                    error: 'Admin access required'
                });
            }
            
            const bottlenecks = await learningAPIGateway.handleRequest(
                'GET',
                '/learn/analysis/bottlenecks',
                {},
                req.learningContext
            );
            
            res.json({
                success: true,
                bottlenecks
            });
        } catch (error) {
            console.error('Error getting bottlenecks:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);

/**
 * @route GET /api/learn/automation/opportunities
 * @desc Get automation opportunities for practice
 * @access Private (Admin)
 */
router.get('/automation/opportunities',
    requireAuth,
    validateClinicAccess,
    addLearningContext,
    async (req, res) => {
        try {
            // Check admin permission
            if (req.learningContext.role !== 'admin' && 
                req.learningContext.role !== 'super_admin') {
                return res.status(403).json({
                    success: false,
                    error: 'Admin access required'
                });
            }
            
            const opportunities = await learningAPIGateway.handleRequest(
                'GET',
                '/learn/automation/opportunities',
                {},
                req.learningContext
            );
            
            res.json({
                success: true,
                opportunities
            });
        } catch (error) {
            console.error('Error getting automation opportunities:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);

/**
 * @route POST /api/learn/batch
 * @desc Batch learning API requests
 * @access Private
 */
router.post('/batch',
    requireAuth,
    validateCSRF,
    validateClinicAccess,
    addLearningContext,
    async (req, res) => {
        try {
            const { requests } = req.body;
            
            if (!Array.isArray(requests)) {
                return res.status(400).json({
                    success: false,
                    error: 'Requests must be an array'
                });
            }
            
            const results = await learningAPIGateway.batchRequest(
                requests,
                req.learningContext
            );
            
            res.json({
                success: true,
                results
            });
        } catch (error) {
            console.error('Error processing batch requests:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);

/**
 * @route GET /api/learn/admin/metrics
 * @desc Get learning system metrics
 * @access Private (Admin)
 */
router.get('/admin/metrics',
    requireAuth,
    validateClinicAccess,
    addLearningContext,
    async (req, res) => {
        try {
            // Check admin permission
            if (req.learningContext.role !== 'admin' && 
                req.learningContext.role !== 'super_admin') {
                return res.status(403).json({
                    success: false,
                    error: 'Admin access required'
                });
            }
            
            const metrics = await learningAPIGateway.handleRequest(
                'GET',
                '/learn/admin/metrics',
                {},
                req.learningContext
            );
            
            res.json({
                success: true,
                metrics
            });
        } catch (error) {
            console.error('Error getting metrics:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);

/**
 * @route POST /api/learn/admin/reset
 * @desc Reset learning data
 * @access Private (Admin)
 */
router.post('/admin/reset',
    requireAuth,
    validateCSRF,
    validateClinicAccess,
    addLearningContext,
    async (req, res) => {
        try {
            // Check admin permission
            if (req.learningContext.role !== 'admin' && 
                req.learningContext.role !== 'super_admin') {
                return res.status(403).json({
                    success: false,
                    error: 'Admin access required'
                });
            }
            
            const { scope, targetId } = req.body;
            
            const result = await learningAPIGateway.handleRequest(
                'POST',
                '/learn/admin/reset',
                { scope, targetId },
                req.learningContext
            );
            
            res.json({
                success: true,
                result
            });
        } catch (error) {
            console.error('Error resetting learning:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);

/**
 * @route POST /api/learn/orchestrate
 * @desc Trigger orchestrated learning operation
 * @access Private (Admin)
 */
router.post('/orchestrate',
    requireAuth,
    validateCSRF,
    validateClinicAccess,
    addLearningContext,
    async (req, res) => {
        try {
            // Check admin permission for orchestration
            if (req.learningContext.role !== 'admin' && 
                req.learningContext.role !== 'super_admin') {
                return res.status(403).json({
                    success: false,
                    error: 'Admin access required'
                });
            }
            
            const { operation, operationContext } = req.body;
            
            const result = await learningAPIGateway.handleRequest(
                'POST',
                '/learn/orchestrate',
                { operation, operationContext },
                req.learningContext
            );
            
            res.json({
                success: true,
                result
            });
        } catch (error) {
            console.error('Error orchestrating operation:', error);
            res.status(500).json({
                success: false,
                error: error.message
            });
        }
    }
);

/**
 * WebSocket endpoint for real-time learning updates
 * This will be handled by the WebSocket server, not Express
 * Documentation endpoint only
 */
router.get('/ws/info', (req, res) => {
    res.json({
        success: true,
        info: {
            endpoint: 'ws://localhost:5000/learn',
            events: [
                'workflow.predicted',
                'suggestion.available',
                'efficiency.alert',
                'automation.discovered',
                'pattern.detected'
            ],
            example: {
                action: 'subscribe',
                events: ['workflow.predicted', 'suggestion.available']
            }
        }
    });
});

module.exports = router;