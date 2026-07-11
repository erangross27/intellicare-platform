const { ObjectId } = require('mongodb');
const express = require('express');
const router = express.Router();
const Insurance = require('../models/Insurance');
const SecureDataAccess = require('../services/secureDataAccess');
// Models are accessed via req.models for multi-tenancy
// const Patient = require('../models/Patient'); // REMOVED - Use req.models.Patient
const { practiceAuth } = require('../middleware/practiceAuth');
const { practiceContext } = require('../middleware/practiceContext');
// Basic validation helper
const validateRequired = (fields) => {
  return (req, res, next) => {
    const missing = fields.filter(field => !req.body[field]);
    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        error: `Missing required fields: ${missing.join(', ')}`
      });
    }
    next();
  };
};

// Apply middleware to all routes
router.use(practiceAuth);
router.use(practiceContext);

/**
 * @route   POST /insurance
 * @desc    Add insurance information for a patient
 * @access  Private (Doctor, Nurse, Receptionist)
 * @param   {string} patientId - Patient ID
 * @param   {string} insuranceCompany - Insurance company name
 * @param   {string} planName - Insurance plan name
 * @param   {string} planType - Type of plan (HMO, PPO, etc.)
 * @param   {string} memberId - Member ID
 * @param   {string} effectiveDate - Policy effective date
 */
router.post('/', validateRequired(['patientId', 'insuranceCompany', 'planName', 'planType', 'memberId', 'effectiveDate']), async (req, res) => {
  try {
    const { 
      patientId, 
      insuranceCompany, 
      planName, 
      planType,
      memberId,
      effectiveDate,
      expirationDate,
      groupNumber,
      subscriberName,
      relationshipToSubscriber,
      isPrimary,
      deductible,
      outOfPocketMax,
      coverage,
      customerServicePhone
    } = req.body;

    const context = {
      userId: req.user?.id || 'anonymous',
      operation: 'create-insurance-record',
      practiceId: req.practice?.id || req.practiceId || 'global'
    };

    // Verify patient exists and belongs to practice
    const patients = await SecureDataAccess.query('patients', { 
      _id: patientId, 
      practiceId: req.practiceContext.practiceId 
    }, {limit: 1}, context);
    
    const patient = patients[0];
    
    if (!patient) {
      return res.status(404).json({
        success: false,
        error: 'Patient not found in this practice'
      });
    }

    // If this is marked as primary, make sure to unset other primary insurance
    if (isPrimary) {
      await SecureDataAccess.update('insurances',
        { patientId: patientId, practiceId: req.practiceContext.practiceId },
        { isPrimary: false },
        context,
        { multi: true }
      );
    }

    // Create insurance record data
    const insuranceData = {
      // Patient Information
      patientId: patientId,
      patientName: `${patient.firstName} ${patient.lastName}`,
      
      // Insurance Company Information
      insuranceCompany: insuranceCompany,
      planName: planName,
      planType: planType,
      groupNumber: groupNumber,
      memberId: memberId,
      subscriberName: subscriberName || `${patient.firstName} ${patient.lastName}`,
      relationshipToSubscriber: relationshipToSubscriber || 'self',
      
      // Policy Details
      effectiveDate: new Date(effectiveDate),
      expirationDate: expirationDate ? new Date(expirationDate) : null,
      isPrimary: isPrimary || false,
      priority: isPrimary ? 1 : 2,
      
      // Benefits Information
      deductible: deductible || {
        individual: 0,
        family: 0,
        met: 0,
        remaining: 0
      },
      outOfPocketMax: outOfPocketMax || {
        individual: 0,
        family: 0,
        met: 0,
        remaining: 0
      },
      
      // Coverage Details
      coverage: coverage || [],
      
      // Contact Information
      customerServicePhone: customerServicePhone,
      
      // Verification
      verificationStatus: 'pending',
      
      // Practice Information
      practiceId: req.practiceContext.practiceId,
      practiceName: req.practiceContext.practiceName,
      
      // Metadata
      createdAt: new Date(),
      createdBy: req.user.id,
      lastUpdated: new Date()
    };

    const insurance = await SecureDataAccess.insert('insurances', insuranceData, context);

    // Log the insurance creation
    console.log(`Insurance added: ${insuranceCompany} - ${planName} for patient ${patient.firstName} ${patient.lastName}`);

    res.status(201).json({
      success: true,
      data: insurance,
      message: 'Insurance information added successfully'
    });

  } catch (error) {
    console.error('Error adding insurance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add insurance information',
      details: error.message
    });
  }
});

/**
 * @route   GET /insurance/patient/:patientId
 * @desc    Get all insurance records for a patient
 * @access  Private
 */
router.get('/patient/:patientId', async (req, res) => {
  try {
    const { patientId } = req.params;

    const context = {
      userId: req.user?.id || 'anonymous',
      operation: 'get-patient-insurance-records',
      practiceId: req.practice?.id || req.practiceId || 'global'
    };

    // Verify patient exists and belongs to practice
    const patients = await SecureDataAccess.query('patients', { 
      _id: patientId, 
      practiceId: req.practiceContext.practiceId 
    }, {limit: 1}, context);
    
    const patient = patients[0];
    
    if (!patient) {
      return res.status(404).json({
        success: false,
        error: 'Patient not found in this practice'
      });
    }

    // Get insurance records
    const insuranceRecords = await SecureDataAccess.query('insurances', {
      patientId: patientId,
      practiceId: req.practiceContext.practiceId
    }, {}, context);

    // Enhance records with status indicators
    const enhancedRecords = insuranceRecords.map(record => {
      const enhanced = record.toObject();
      
      // Add virtual properties
      enhanced.isActive = record.isActive;
      enhanced.needsVerification = record.needsVerification;
      enhanced.deductibleProgress = record.deductibleProgress;
      enhanced.outOfPocketProgress = record.outOfPocketProgress;
      
      // Calculate days until expiration
      if (enhanced.expirationDate) {
        const daysUntilExpiration = Math.ceil((new Date(enhanced.expirationDate) - new Date()) / (1000 * 60 * 60 * 24));
        enhanced.daysUntilExpiration = Math.max(0, daysUntilExpiration);
        enhanced.isExpiringSoon = daysUntilExpiration <= 30 && daysUntilExpiration > 0;
      }
      
      return enhanced;
    });

    res.json({
      success: true,
      data: enhancedRecords,
      count: enhancedRecords.length,
      message: `Found ${enhancedRecords.length} insurance records`
    });

  } catch (error) {
    console.error('Error getting patient insurance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve insurance information',
      details: error.message
    });
  }
});

/**
 * @route   GET /insurance/:insuranceId
 * @desc    Get specific insurance record details
 * @access  Private
 */
router.get('/:insuranceId', async (req, res) => {
  try {
    const { insuranceId } = req.params;

    const context = {
      userId: req.user?.id || 'anonymous',
      operation: 'get-insurance-record-details',
      practiceId: req.practice?.id || req.practiceId || 'global'
    };

    const insurances = await SecureDataAccess.query('insurances', {
      _id: insuranceId,
      practiceId: req.practiceContext.practiceId
    }, {limit: 1}, context);
    
    const insurance = insurances[0];

    if (!insurance) {
      return res.status(404).json({
        success: false,
        error: 'Insurance record not found'
      });
    }

    res.json({
      success: true,
      data: insurance,
      message: 'Insurance record retrieved successfully'
    });

  } catch (error) {
    console.error('Error getting insurance record:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve insurance record',
      details: error.message
    });
  }
});

/**
 * @route   PUT /insurance/:insuranceId/verify
 * @desc    Verify insurance eligibility
 * @access  Private
 */
router.put('/:insuranceId/verify', async (req, res) => {
  try {
    const { insuranceId } = req.params;
    const { status, eligibilityResponse, notes } = req.body;

    const validStatuses = ['active', 'inactive', 'pending', 'terminated'];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        error: `Invalid status. Valid options: ${validStatuses.join(', ')}`
      });
    }

    const context = {
      userId: req.user?.id || 'anonymous',
      operation: 'verify-insurance-eligibility',
      practiceId: req.practice?.id || req.practiceId || 'global'
    };

    const insurances = await SecureDataAccess.query('insurances', {
      _id: insuranceId,
      practiceId: req.practiceContext.practiceId
    }, {limit: 1}, context);
    
    const insurance = insurances[0];

    if (!insurance) {
      return res.status(404).json({
        success: false,
        error: 'Insurance record not found'
      });
    }

    // Update verification status
    await SecureDataAccess.update('insurances', 
      { _id: insuranceObjectId, practiceId: req.practiceContext.practiceId },
      {
        verificationStatus: status,
        lastVerified: new Date(),
        verifiedBy: req.user.id,
        eligibilityResponse: eligibilityResponse,
        verificationNotes: notes,
        lastUpdated: new Date()
      },
      context
    );

    // Get updated insurance record
    const updatedInsurances = await SecureDataAccess.query('insurances', {
      _id: insuranceId,
      practiceId: req.practiceContext.practiceId
    }, {limit: 1}, context);
    
    const updatedInsurance = updatedInsurances[0];

    res.json({
      success: true,
      data: updatedInsurance,
      message: 'Insurance verification completed successfully'
    });

  } catch (error) {
    console.error('Error verifying insurance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify insurance',
      details: error.message
    });
  }
});

/**
 * @route   POST /insurance/:insuranceId/authorization
 * @desc    Add prior authorization request
 * @access  Private
 */
router.post('/:insuranceId/authorization', validateRequired(['serviceRequested']), async (req, res) => {
  try {
    const { insuranceId } = req.params;
    const authData = req.body;

    const insuranceResults = await SecureDataAccess.query('insurances', {
      _id: insuranceId, 
      practiceId: req.practiceContext.practiceId
    , limit: 1 }, {}, context);


    const insurance = insuranceResults[0];

    if (!insurance) {
      return res.status(404).json({
        success: false,
        error: 'Insurance record not found'
      });
    }

    // Generate authorization number if not provided
    if (!authData.authorizationNumber) {
      authData.authorizationNumber = `AUTH-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    }

    // Add authorization using the model method
    await insurance.addAuthorization(authData);

    res.json({
      success: true,
      data: insurance,
      message: 'Authorization request added successfully'
    });

  } catch (error) {
    console.error('Error adding authorization:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add authorization request',
      details: error.message
    });
  }
});

/**
 * @route   PUT /insurance/:insuranceId/authorization/:authNumber
 * @desc    Update prior authorization status
 * @access  Private
 */
router.put('/:insuranceId/authorization/:authNumber', async (req, res) => {
  try {
    const { insuranceId, authNumber } = req.params;
    const updateData = req.body;

    const insuranceResults = await SecureDataAccess.query('insurances', {
      _id: insuranceId, 
      practiceId: req.practiceContext.practiceId
    , limit: 1 }, {}, context);


    const insurance = insuranceResults[0];

    if (!insurance) {
      return res.status(404).json({
        success: false,
        error: 'Insurance record not found'
      });
    }

    // Update authorization using the model method
    await insurance.updateAuthorization(authNumber, updateData);

    res.json({
      success: true,
      data: insurance,
      message: 'Authorization updated successfully'
    });

  } catch (error) {
    console.error('Error updating authorization:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update authorization',
      details: error.message
    });
  }
});

/**
 * @route   POST /insurance/:insuranceId/claim
 * @desc    Add insurance claim
 * @access  Private
 */
router.post('/:insuranceId/claim', validateRequired(['serviceDate', 'providerName', 'serviceDescription', 'chargedAmount']), async (req, res) => {
  try {
    const { insuranceId } = req.params;
    const claimData = req.body;

    const insuranceResults = await SecureDataAccess.query('insurances', {
      _id: insuranceId, 
      practiceId: req.practiceContext.practiceId
    , limit: 1 }, {}, context);


    const insurance = insuranceResults[0];

    if (!insurance) {
      return res.status(404).json({
        success: false,
        error: 'Insurance record not found'
      });
    }

    // Generate claim number if not provided
    if (!claimData.claimNumber) {
      claimData.claimNumber = `CLM-${Date.now()}-${Math.random().toString(36).substr(2, 6).toUpperCase()}`;
    }

    // Add claim using the model method
    await insurance.addClaim(claimData);

    res.json({
      success: true,
      data: insurance,
      message: 'Claim added successfully'
    });

  } catch (error) {
    console.error('Error adding claim:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to add claim',
      details: error.message
    });
  }
});

/**
 * @route   PUT /insurance/:insuranceId/claim/:claimNumber
 * @desc    Update insurance claim status
 * @access  Private
 */
router.put('/:insuranceId/claim/:claimNumber', async (req, res) => {
  try {
    const { insuranceId, claimNumber } = req.params;
    const updateData = req.body;

    const insuranceResults = await SecureDataAccess.query('insurances', {
      _id: insuranceId, 
      practiceId: req.practiceContext.practiceId
    , limit: 1 }, {}, context);


    const insurance = insuranceResults[0];

    if (!insurance) {
      return res.status(404).json({
        success: false,
        error: 'Insurance record not found'
      });
    }

    // Update claim using the model method
    await insurance.updateClaim(claimNumber, updateData);

    res.json({
      success: true,
      data: insurance,
      message: 'Claim updated successfully'
    });

  } catch (error) {
    console.error('Error updating claim:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to update claim',
      details: error.message
    });
  }
});

/**
 * @route   GET /insurance/verification/needed
 * @desc    Get insurance records that need verification
 * @access  Private
 */
router.get('/verification/needed', async (req, res) => {
  try {
    const { limit = 100 } = req.query;

    const context = {
      userId: req.user?.id || 'anonymous',
      operation: 'get-records-needing-verification',
      practiceId: req.practice?.id || req.practiceId || 'global'
    };

    // Get insurance records needing verification
    const recordsNeedingVerification = await SecureDataAccess.query('insurances', {
      practiceId: req.practiceContext.practiceId,
      verificationStatus: 'pending'
    }, {
      limit: parseInt(limit)
    }, context);

    res.json({
      success: true,
      data: recordsNeedingVerification,
      count: recordsNeedingVerification.length,
      message: `Found ${recordsNeedingVerification.length} records needing verification`
    });

  } catch (error) {
    console.error('Error getting records needing verification:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve records needing verification',
      details: error.message
    });
  }
});

/**
 * @route   GET /insurance/expiring
 * @desc    Get insurance records expiring soon
 * @access  Private
 */
router.get('/expiring', async (req, res) => {
  try {
    const { days = 30, limit = 100 } = req.query;

    const context = {
      userId: req.user?.id || 'anonymous',
      operation: 'get-expiring-records',
      practiceId: req.practice?.id || req.practiceId || 'global'
    };

    const expirationDate = new Date();
    expirationDate.setDate(expirationDate.getDate() + parseInt(days));

    // Get expiring insurance records
    const expiringRecords = await SecureDataAccess.query('insurances', {
      practiceId: req.practiceContext.practiceId,
      expirationDate: { $lte: expirationDate, $gt: new Date() }
    }, {
      limit: parseInt(limit)
    }, context);

    res.json({
      success: true,
      data: expiringRecords,
      count: expiringRecords.length,
      message: `Found ${expiringRecords.length} records expiring in ${days} days`
    });

  } catch (error) {
    console.error('Error getting expiring records:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to retrieve expiring records',
      details: error.message
    });
  }
});

/**
 * @route   GET /insurance/:insuranceId/coverage/:serviceType
 * @desc    Check coverage for specific service type
 * @access  Private
 */
router.get('/:insuranceId/coverage/:serviceType', async (req, res) => {
  try {
    const { insuranceId, serviceType } = req.params;

    const insuranceResults = await SecureDataAccess.query('insurances', {
      _id: insuranceId, 
      practiceId: req.practiceContext.practiceId
    , limit: 1 }, {}, context);


    const insurance = insuranceResults[0];

    if (!insurance) {
      return res.status(404).json({
        success: false,
        error: 'Insurance record not found'
      });
    }

    const copay = insurance.getCopayForService(serviceType);
    const covered = insurance.isServiceCovered(serviceType);

    res.json({
      success: true,
      data: {
        serviceType: serviceType,
        covered: covered,
        copayAmount: copay,
        deductibleProgress: insurance.deductibleProgress,
        outOfPocketProgress: insurance.outOfPocketProgress
      },
      message: `Coverage information for ${serviceType}`
    });

  } catch (error) {
    console.error('Error checking coverage:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to check coverage',
      details: error.message
    });
  }
});

module.exports = router;