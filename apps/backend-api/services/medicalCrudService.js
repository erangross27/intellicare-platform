/**
 * Medical CRUD Service
 * Provides unified CRUD operations for all 33 medical categories
 * Handles 201 collections across the medical spectrum
 */

const { ObjectId } = require('mongodb');
const SecureDataAccess = require('./secureDataAccess');

class MedicalCrudService {
  constructor() {
    this.serviceName = 'MedicalCrudService';

    // Complete mapping of 33 categories to their 201 collections
    this.categoryCollectionMap = {
      // 1. Appointments & Scheduling
      'appointments': [
        'appointments',
        'appointment_history',
        'appointment_reminders'
      ],

      // 2. Medications & Prescriptions
      'medications': [
        'medications',
        'medication_history',
        'prescriptions',
        'medication_allergies'
        // Note: drug_interactions is NOT a patient collection - it's handled by
        // drugInformationService.checkDrugInteractions() which queries the separate
        // intellicare_drug_data.drug_interactions reference database
      ],

      // 3. Allergies & Reactions
      'allergies': [
        'allergies',
        'allergy_history',
        'adverse_reactions'
      ],

      // 4. Vital Signs
      'vitals': [
        'vital_signs',
        'vital_history',
        'vital_trends'
      ],

      // 5. Laboratory
      'laboratory': [
        'lab_results',
        'lab_orders',
        'lab_history',
        'lab_panels',
        'lab_trends'
      ],

      // 6. Imaging & Radiology
      'imaging': [
        'imaging_studies',
        'radiology_reports',
        'imaging_orders',
        'ct_scans',
        'mri_studies',
        'xray_reports',
        'ultrasound_reports'
      ],

      // 7. Procedures
      'procedures': [
        'procedures',
        'surgical_procedures',
        'procedure_notes',
        'operative_reports',
        'procedure_complications'
      ],

      // 8. Diagnoses
      'diagnoses': [
        'diagnoses',
        'diagnosis_history',
        'problem_list',
        'differential_diagnoses'
      ],

      // 9. Immunizations
      'immunizations': [
        'immunizations',
        'vaccine_history',
        'vaccine_reactions',
        'immunization_schedules'
      ],

      // 10. Documents & Records
      'documents': [
        'documents',
        'medical_records',
        'clinical_notes',
        'discharge_summaries',
        'referral_letters'
      ],

      // 11. Cardiology
      'cardiology': [
        'cardiology_consultations',
        'echocardiograms',
        'ekg_results',
        'stress_tests',
        'cardiac_catheterizations',
        'holter_monitors',
        'cardiac_mri',
        'coronary_angiography'
      ],

      // 12. Neurology
      'neurology': [
        'neurology_consultations',
        'eeg_studies',
        'emg_studies',
        'nerve_conduction',
        'neurological_exams',
        'cognitive_assessments',
        'movement_disorders',
        'seizure_logs'
      ],

      // 13. Psychiatry
      'psychiatry': [
        'psychiatric_consultations',
        'mental_health_assessments',
        'psychiatric_medications',
        'therapy_sessions',
        'psychological_evaluations',
        'mood_tracking',
        'behavioral_assessments'
      ],

      // 14. Oncology
      'oncology': [
        'oncology_consultations',
        'cancer_staging',
        'tumor_markers',
        'chemotherapy_cycles',
        'radiation_therapy',
        'oncology_followup',
        'cancer_genetics',
        'palliative_care'
      ],

      // 15. Pediatrics
      'pediatrics': [
        'pediatric_consultations',
        'growth_charts',
        'developmental_milestones',
        'pediatric_vaccinations',
        'newborn_screening',
        'well_child_visits',
        'pediatric_assessments'
      ],

      // 16. Orthopedics
      'orthopedics': [
        'orthopedic_consultations',
        'joint_assessments',
        'bone_density',
        'orthopedic_procedures',
        'fracture_care',
        'sports_medicine',
        'physical_therapy_notes'
      ],

      // 17. Pulmonary
      'pulmonary': [
        'pulmonary_consultations',
        'pft_results',
        'sleep_studies',
        'bronchoscopy_reports',
        'oxygen_therapy',
        'ventilator_settings',
        'pulmonary_rehab'
      ],

      // 18. Endocrinology
      'endocrinology': [
        'endocrine_consultations',
        'diabetes_management',
        'thyroid_tests',
        'hormone_levels',
        'glucose_monitoring',
        'insulin_regimens',
        'metabolic_panels'
      ],

      // 19. Nephrology
      'nephrology': [
        'nephrology_consultations',
        'dialysis_records',
        'kidney_function',
        'electrolyte_panels',
        'renal_ultrasounds',
        'transplant_evaluations',
        'fluid_balance'
      ],

      // 20. Gastroenterology
      'gastroenterology': [
        'gi_consultations',
        'endoscopy_reports',
        'colonoscopy_reports',
        'liver_function',
        'ibd_assessments',
        'hepatitis_panels'
      ],

      // 21. Rheumatology
      'rheumatology': [
        'rheumatology_consultations',
        'joint_counts',
        'autoimmune_markers',
        'inflammatory_markers',
        'disease_activity_scores',
        'rheumatologic_medications'
      ],

      // 22. Hematology
      'hematology': [
        'hematology_consultations',
        'blood_smears',
        'coagulation_studies',
        'hemoglobinopathy_studies',
        'bone_marrow_studies',
        'transfusion_records',
        'bleeding_disorders'
      ],

      // 23. Dermatology
      'dermatology': [
        'dermatology_consultations',
        'skin_biopsies',
        'dermoscopy_reports',
        'patch_testing',
        'phototherapy_sessions',
        'cosmetic_procedures'
      ],

      // 24. Ophthalmology
      'ophthalmology': [
        'ophthalmology_consultations',
        'visual_acuity',
        'visual_fields',
        'oct_scans',
        'fundus_photos',
        'glaucoma_assessments',
        'cataract_evaluations'
      ],

      // 25. ENT (Otolaryngology)
      'ent': [
        'ent_consultations',
        'audiometry_results',
        'hearing_tests',
        'tympanometry',
        'laryngoscopy_reports',
        'sinus_imaging',
        'voice_assessments'
      ],

      // 26. Urology
      'urology': [
        'urology_consultations',
        'urodynamics_studies',
        'prostate_assessments',
        'cystoscopy_reports',
        'kidney_stones',
        'urinalysis_results'
      ],

      // 27. OB/GYN
      'obgyn': [
        'obstetric_visits',
        'prenatal_care',
        'gynecology_consultations',
        'pap_smears',
        'mammograms',
        'pregnancy_history',
        'fertility_assessments',
        'contraception_counseling'
      ],

      // 28. Emergency Medicine
      'emergency': [
        'emergency_visits',
        'er_consultations',
        'trauma_assessments',
        'triage_notes',
        'emergency_procedures'
      ],

      // 29. Physical Medicine & Rehabilitation
      'rehabilitation': [
        'pmr_consultations',
        'physical_therapy',
        'occupational_therapy',
        'speech_therapy',
        'functional_assessments',
        'rehabilitation_goals',
        'assistive_devices'
      ],

      // 30. Medical Genetics
      'genetics': [
        'genetic_consultations',
        'genetic_testing',
        'variant_reports',
        'pedigree_analysis',
        'carrier_screening',
        'pharmacogenomics'
      ],

      // 31. Infectious Disease
      'infectious': [
        'infectious_consultations',
        'pathogen_reports',
        'antibiotic_therapy',
        'infection_control',
        'travel_medicine',
        'immunodeficiency_evaluations'
      ],

      // 32. Anesthesiology
      'anesthesiology': [
        'anesthesia_consultations',
        'preoperative_assessments',
        'anesthesia_records',
        'pain_management',
        'nerve_blocks',
        'sedation_records'
      ],

      // 33. Preventive Medicine
      'preventive': [
        'preventive_consultations',
        'health_screenings',
        'risk_assessments',
        'lifestyle_counseling',
        'preventive_care_plans',
        'wellness_visits'
      ]
    };

    console.log(`[${this.serviceName}] Service initialized with ${Object.keys(this.categoryCollectionMap).length} categories`);
  }

  /**
   * Get all data for a specific category
   */
  async getCategoryData(category, patientId, sessionId, options = {}) {
    const context = {
      serviceId: this.serviceName,
      operation: `get_${category}`,
      practiceId: global.practiceId || 'global'
    };

    try {
      const collections = this.categoryCollectionMap[category];
      if (!collections) {
        throw new Error(`Unknown category: ${category}`);
      }

      const results = {};
      const patientObjectId = new ObjectId(patientId);

      // OPTIMIZATION: First check patient.medicalData to know which collections have data
      let collectionsToQuery = collections;
      let usingOptimization = false;

      try {
        const patient = await SecureDataAccess.query(
          'patients',
          { _id: patientObjectId },
          { projection: { medicalData: 1 } },
          context
        );

        if (patient?.[0]?.medicalData?.collections) {
          // FAST PATH: Only query collections that have data
          const collectionsWithData = Object.keys(patient[0].medicalData.collections);

          // Filter to only collections in this category that have data
          collectionsToQuery = collections.filter(coll => collectionsWithData.includes(coll));

          if (collectionsToQuery.length < collections.length) {
            usingOptimization = true;
            console.log(`⚡ [${this.serviceName}] OPTIMIZED: Querying ${collectionsToQuery.length}/${collections.length} collections for ${category}`);
            console.log(`   Skipping empty: ${collections.filter(c => !collectionsToQuery.includes(c)).join(', ')}`);
          }
        }
      } catch (error) {
        console.log(`⚠️ [${this.serviceName}] Could not check patient.medicalData, querying all collections`);
      }

      // Fetch data from collections that have data (in parallel for speed)
      const queryPromises = collectionsToQuery.map(async (collection) => {
        try {
          const data = await SecureDataAccess.query(
            collection,
            { patientId: patientObjectId },
            {
              sort: { createdAt: -1 },
              limit: options.limit || 100
            },
            context
          );

          if (data && data.length > 0) {
            return { collection, data };
          }
          return null;
        } catch (error) {
          console.error(`[${this.serviceName}] Error fetching ${collection}:`, error);
          return null;
        }
      });

      // Execute all queries in parallel for speed
      const queryResults = await Promise.all(queryPromises);

      // Process results
      for (const result of queryResults) {
        if (result) {
          results[result.collection] = result.data;
        }
      }

      return {
        success: true,
        category: category,
        patientId: patientId,
        data: results,
        collectionsQueried: collectionsToQuery.length,
        totalCollections: collections.length,
        optimized: usingOptimization,
        recordsFound: Object.values(results).reduce((sum, arr) => sum + arr.length, 0)
      };
    } catch (error) {
      console.error(`[${this.serviceName}] Error in getCategoryData:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Add a new record to a category
   */
  async addCategoryRecord(category, data, sessionId) {
    const context = {
      serviceId: this.serviceName,
      operation: `add_${category}`,
      practiceId: global.practiceId || 'global'
    };

    try {
      const collections = this.categoryCollectionMap[category];
      if (!collections) {
        throw new Error(`Unknown category: ${category}`);
      }

      // Determine which collection to insert into
      // Default to first collection in the category
      const targetCollection = data.collection || collections[0];

      if (!collections.includes(targetCollection)) {
        throw new Error(`Collection ${targetCollection} not valid for category ${category}`);
      }

      // Ensure required fields
      const recordData = {
        ...data,
        patientId: new ObjectId(data.patientId),
        sessionId: sessionId,
        createdAt: new Date(),
        updatedAt: new Date(),
        createdBy: data.createdBy || 'system',
        source: data.source || 'manual_entry'
      };

      delete recordData.collection; // Remove meta field

      const result = await SecureDataAccess.insert(
        targetCollection,
        recordData,
        context
      );

      return {
        success: true,
        category: category,
        collection: targetCollection,
        recordId: result.insertedId,
        message: `Record added to ${targetCollection}`
      };
    } catch (error) {
      console.error(`[${this.serviceName}] Error in addCategoryRecord:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Update an existing record in a category
   */
  async updateCategoryRecord(category, recordId, updates, sessionId) {
    const context = {
      serviceId: this.serviceName,
      operation: `update_${category}`,
      practiceId: global.practiceId || 'global'
    };

    try {
      const collections = this.categoryCollectionMap[category];
      if (!collections) {
        throw new Error(`Unknown category: ${category}`);
      }

      // Try to find the record in any of the category's collections
      let targetCollection = null;
      let existingRecord = null;

      for (const collection of collections) {
        try {
          const records = await SecureDataAccess.query(
            collection,
            { _id: new ObjectId(recordId) },
            { limit: 1 },
            context
          );

          if (records && records.length > 0) {
            targetCollection = collection;
            existingRecord = records[0];
            break;
          }
        } catch (error) {
          // Continue checking other collections
        }
      }

      if (!targetCollection) {
        throw new Error(`Record ${recordId} not found in category ${category}`);
      }

      // Prepare updates
      const updateData = {
        ...updates,
        updatedAt: new Date(),
        updatedBy: updates.updatedBy || 'system'
      };

      // Remove fields that shouldn't be updated
      delete updateData._id;
      delete updateData.patientId;
      delete updateData.createdAt;

      const result = await SecureDataAccess.update(
        targetCollection,
        { _id: new ObjectId(recordId) },
        { $set: updateData },
        context
      );

      return {
        success: true,
        category: category,
        collection: targetCollection,
        recordId: recordId,
        modifiedCount: result.modifiedCount,
        message: `Record updated in ${targetCollection}`
      };
    } catch (error) {
      console.error(`[${this.serviceName}] Error in updateCategoryRecord:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Delete a record from a category
   */
  async deleteCategoryRecord(category, recordId, sessionId) {
    const context = {
      serviceId: this.serviceName,
      operation: `delete_${category}`,
      practiceId: global.practiceId || 'global'
    };

    try {
      const collections = this.categoryCollectionMap[category];
      if (!collections) {
        throw new Error(`Unknown category: ${category}`);
      }

      // Try to find and delete the record from any of the category's collections
      let targetCollection = null;
      let deleteResult = null;

      for (const collection of collections) {
        try {
          // Check if record exists in this collection
          const records = await SecureDataAccess.query(
            collection,
            { _id: new ObjectId(recordId) },
            { limit: 1 },
            context
          );

          if (records && records.length > 0) {
            targetCollection = collection;

            // Perform soft delete by marking as deleted
            deleteResult = await SecureDataAccess.update(
              collection,
              { _id: new ObjectId(recordId) },
              {
                $set: {
                  deleted: true,
                  deletedAt: new Date(),
                  deletedBy: 'system'
                }
              },
              context
            );
            break;
          }
        } catch (error) {
          // Continue checking other collections
        }
      }

      if (!targetCollection) {
        throw new Error(`Record ${recordId} not found in category ${category}`);
      }

      return {
        success: true,
        category: category,
        collection: targetCollection,
        recordId: recordId,
        message: `Record soft-deleted from ${targetCollection}`
      };
    } catch (error) {
      console.error(`[${this.serviceName}] Error in deleteCategoryRecord:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get category summary (counts and latest activity)
   */
  async getCategorySummary(category, patientId) {
    const context = {
      serviceId: this.serviceName,
      operation: `summary_${category}`,
      practiceId: global.practiceId || 'global'
    };

    try {
      const collections = this.categoryCollectionMap[category];
      if (!collections) {
        throw new Error(`Unknown category: ${category}`);
      }

      const summary = {
        category: category,
        collections: {},
        totalRecords: 0,
        latestActivity: null
      };

      const patientObjectId = new ObjectId(patientId);

      for (const collection of collections) {
        try {
          // Get count
          const pipeline = [
            { $match: { patientId: patientObjectId, deleted: { $ne: true } } },
            { $count: 'total' }
          ];

          const countResult = await SecureDataAccess.aggregate(
            collection,
            pipeline,
            context
          );

          const count = countResult[0]?.total || 0;

          if (count > 0) {
            // Get latest record
            const latestRecords = await SecureDataAccess.query(
              collection,
              { patientId: patientObjectId, deleted: { $ne: true } },
              { sort: { createdAt: -1 }, limit: 1 },
              context
            );

            summary.collections[collection] = {
              count: count,
              latest: latestRecords[0]?.createdAt || null
            };

            summary.totalRecords += count;

            if (latestRecords[0]?.createdAt &&
                (!summary.latestActivity || latestRecords[0].createdAt > summary.latestActivity)) {
              summary.latestActivity = latestRecords[0].createdAt;
            }
          }
        } catch (error) {
          console.error(`[${this.serviceName}] Error getting summary for ${collection}:`, error);
        }
      }

      return {
        success: true,
        summary: summary
      };
    } catch (error) {
      console.error(`[${this.serviceName}] Error in getCategorySummary:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Get all categories with data for a patient
   */
  async getPatientCategories(patientId) {
    const context = {
      serviceId: this.serviceName,
      operation: 'get_patient_categories',
      practiceId: global.practiceId || 'global'
    };

    try {
      const categories = [];

      for (const [category, collections] of Object.entries(this.categoryCollectionMap)) {
        const summary = await this.getCategorySummary(category, patientId);

        if (summary.success && summary.summary.totalRecords > 0) {
          categories.push({
            name: category,
            recordCount: summary.summary.totalRecords,
            collections: Object.keys(summary.summary.collections),
            latestActivity: summary.summary.latestActivity
          });
        }
      }

      // Sort by latest activity
      categories.sort((a, b) => {
        if (!a.latestActivity) return 1;
        if (!b.latestActivity) return -1;
        return new Date(b.latestActivity) - new Date(a.latestActivity);
      });

      return {
        success: true,
        patientId: patientId,
        categories: categories,
        totalCategories: categories.length
      };
    } catch (error) {
      console.error(`[${this.serviceName}] Error in getPatientCategories:`, error);
      return {
        success: false,
        error: error.message
      };
    }
  }
}

module.exports = new MedicalCrudService();