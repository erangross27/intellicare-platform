# Task 02: Brain Tumor Molecular Markers

**Phase:** 1 (Critical Clinical Data)
**Priority:** High
**PDF Template:** `brain_tumor_molecular_idh_mgmt.pdf`
**Target Collection:** `brain_tumor_molecular_markers`

## Clinical Context

Brain tumor molecular profiling has revolutionized neuro-oncology treatment. Key markers like IDH mutation, MGMT methylation, and 1p/19q codeletion determine:
- Treatment selection (TMZ chemotherapy response based on MGMT status)
- Prognosis (IDH-mutant tumors have better outcomes)
- WHO classification (molecular classification now standard)
- Clinical trial eligibility (IDH inhibitors for IDH-mutant gliomas)

This collection enables precision oncology for brain tumor patients.

## Implementation Steps

### Step 1: Add Schema Field to claudeBatchProcessor.js

**Location:** `services/claudeBatchProcessor.js` lines ~15694 (AFTER `addictionMedicineData`, BEFORE `careGaps`)

**What to add:** Insert the following field:

```javascript
          brainTumorMolecularMarkers: {
            type: 'object',
            properties: {
              tumorType: {
                type: 'string',
                description: 'Tumor histology (e.g., "Glioblastoma", "Astrocytoma", "Oligodendroglioma", "Ependymoma")'
              },

              whoGrade: {
                type: 'string',
                description: 'WHO grade (Grade 1, 2, 3, 4) - now integrated with molecular features'
              },

              molecularClassification: {
                type: 'string',
                description: 'WHO 2021 integrated diagnosis combining histology + molecular features (e.g., "Astrocytoma, IDH-mutant, Grade 2", "Glioblastoma, IDH-wildtype")'
              },

              idhStatus: {
                type: 'object',
                properties: {
                  tested: { type: 'boolean', description: 'Whether IDH testing was performed' },
                  result: { type: 'string', enum: ['IDH1-mutant', 'IDH2-mutant', 'IDH-wildtype', 'Not tested'], description: 'IDH mutation status' },
                  specificMutation: { type: 'string', description: 'Specific mutation if known (e.g., "IDH1 R132H" - most common)' },
                  method: { type: 'string', description: 'Testing method (IHC, sequencing, PCR)' },
                  prognosticImplication: { type: 'string', description: 'Clinical significance (IDH-mutant = better prognosis, younger patients, better chemo response)' }
                },
                description: 'IDH1/IDH2 mutation status - CRITICAL prognostic marker'
              },

              mgmtStatus: {
                type: 'object',
                properties: {
                  tested: { type: 'boolean', description: 'Whether MGMT testing was performed' },
                  result: { type: 'string', enum: ['Methylated', 'Unmethylated', 'Indeterminate', 'Not tested'], description: 'MGMT promoter methylation status' },
                  methylationPercentage: { type: 'string', description: 'Percentage methylation if quantitative assay used' },
                  method: { type: 'string', description: 'Testing method (Pyrosequencing, MS-PCR, IHC)' },
                  therapeuticImplication: { type: 'string', description: 'Treatment impact (Methylated = better response to temozolomide chemotherapy)' }
                },
                description: 'MGMT promoter methylation - predicts temozolomide response'
              },

              codeletionStatus: {
                type: 'object',
                properties: {
                  tested: { type: 'boolean', description: 'Whether 1p/19q testing was performed' },
                  result: { type: 'string', enum: ['Codeleted', 'Intact', 'Not tested'], description: '1p/19q codeletion status' },
                  method: { type: 'string', description: 'Testing method (FISH, array CGH, NGS)' },
                  diagnosticImplication: { type: 'string', description: 'Clinical significance (Codeletion = oligodendroglioma, better prognosis, chemo/RT sensitive)' }
                },
                description: '1p/19q codeletion - diagnostic for oligodendroglioma'
              },

              tertPromoterStatus: {
                type: 'object',
                properties: {
                  tested: { type: 'boolean', description: 'Whether TERT promoter mutation tested' },
                  result: { type: 'string', enum: ['Mutant', 'Wildtype', 'Not tested'], description: 'TERT promoter mutation status' },
                  specificMutation: { type: 'string', description: 'Specific mutation (C228T or C250T)' },
                  prognosticImplication: { type: 'string', description: 'Clinical significance (mutation in IDH-wildtype GBM = poor prognosis)' }
                },
                description: 'TERT promoter mutation status'
              },

              atrmStatus: {
                type: 'object',
                properties: {
                  tested: { type: 'boolean', description: 'Whether ATRX loss tested' },
                  result: { type: 'string', enum: ['Loss', 'Retained', 'Not tested'], description: 'ATRX expression status' },
                  method: { type: 'string', description: 'Testing method (IHC)' },
                  diagnosticImplication: { type: 'string', description: 'Clinical significance (Loss associated with IDH-mutant astrocytoma, exclusive with 1p/19q codeletion)' }
                },
                description: 'ATRX expression - helps distinguish astrocytoma from oligodendroglioma'
              },

              tp53Status: {
                type: 'object',
                properties: {
                  tested: { type: 'boolean', description: 'Whether TP53 mutation tested' },
                  result: { type: 'string', enum: ['Mutant', 'Wildtype', 'Not tested'], description: 'TP53 mutation status' },
                  specificMutation: { type: 'string', description: 'Specific mutation if sequenced' },
                  diagnosticImplication: { type: 'string', description: 'Clinical significance (mutation associated with IDH-mutant astrocytoma)' }
                },
                description: 'TP53 mutation status'
              },

              ki67ProliferationIndex: {
                type: 'object',
                properties: {
                  tested: { type: 'boolean', description: 'Whether Ki-67 tested' },
                  percentage: { type: 'string', description: 'Ki-67 percentage (e.g., "15%", "30-40%")' },
                  interpretation: { type: 'string', description: 'Proliferation index interpretation (Low <10%, Intermediate 10-25%, High >25%)' },
                  prognosticImplication: { type: 'string', description: 'Higher Ki-67 = more aggressive tumor' }
                },
                description: 'Ki-67 proliferation index'
              },

              egressStatus: {
                type: 'object',
                properties: {
                  tested: { type: 'boolean', description: 'Whether EGFR amplification tested' },
                  result: { type: 'string', enum: ['Amplified', 'Not amplified', 'Not tested'], description: 'EGFR amplification status' },
                  egfrvIIIMutation: { type: 'string', enum: ['Present', 'Absent', 'Not tested'], description: 'EGFRvIII mutation (constitutively active variant)' },
                  therapeuticImplication: { type: 'string', description: 'Treatment implications (common in IDH-wildtype GBM, potential targeted therapy target)' }
                },
                description: 'EGFR amplification and EGFRvIII mutation'
              },

              cdkn2aStatus: {
                type: 'object',
                properties: {
                  tested: { type: 'boolean', description: 'Whether CDKN2A/B homozygous deletion tested' },
                  result: { type: 'string', enum: ['Homozygous deletion', 'Intact', 'Not tested'], description: 'CDKN2A/B status' },
                  prognosticImplication: { type: 'string', description: 'Homozygous deletion in IDH-mutant astrocytoma = Grade 4 per WHO 2021' }
                },
                description: 'CDKN2A/B homozygous deletion - upgrades IDH-mutant astrocytoma to Grade 4'
              },

              brainStatus: {
                type: 'object',
                properties: {
                  tested: { type: 'boolean', description: 'Whether BRAF mutation/fusion tested' },
                  result: { type: 'string', description: 'BRAF status (V600E mutation, KIAA1549-BRAF fusion, wildtype)' },
                  tumorType: { type: 'string', description: 'Associated tumor type (BRAF V600E in pleomorphic xanthoastrocytoma, ganglioglioma; BRAF fusion in pilocytic astrocytoma)' },
                  therapeuticImplication: { type: 'string', description: 'Treatment options (BRAF V600E responsive to BRAF inhibitors like dabrafenib, MEK inhibitors)' }
                },
                description: 'BRAF mutation/fusion status - important in pediatric and low-grade tumors'
              },

              h3Status: {
                type: 'object',
                properties: {
                  tested: { type: 'boolean', description: 'Whether histone H3 mutation tested' },
                  result: { type: 'string', description: 'H3 mutation status (H3 K27M, H3 G34R/V, wildtype)' },
                  location: { type: 'string', description: 'Tumor location (H3 K27M in midline/thalamus/brainstem, H3 G34 in cerebral hemispheres)' },
                  prognosticImplication: { type: 'string', description: 'H3 K27M = diffuse midline glioma, very poor prognosis, Grade 4' }
                },
                description: 'Histone H3 mutations - diagnostic for diffuse midline glioma'
              },

              ngsPanel: {
                type: 'object',
                properties: {
                  performed: { type: 'boolean', description: 'Whether NGS panel performed' },
                  panelName: { type: 'string', description: 'NGS panel used (e.g., "FoundationOne", "Tempus", "Institutional brain tumor panel")' },
                  genesAnalyzed: { type: 'number', description: 'Number of genes in panel' },
                  additionalMutations: { type: 'array', items: { type: 'string' }, description: 'Other mutations identified (PIK3CA, PTEN, NF1, etc.)' },
                  tumorMutationBurden: { type: 'string', description: 'TMB if reported (mutations/Mb)' },
                  microsatelliteStatus: { type: 'string', enum: ['MSI-H', 'MSS', 'Not tested'], description: 'Microsatellite instability status' }
                },
                description: 'Comprehensive NGS panel results'
              },

              clinicalTrialEligibility: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    molecularTarget: { type: 'string', description: 'Molecular target (e.g., "IDH1 R132H mutation", "BRAF V600E")' },
                    drugClass: { type: 'string', description: 'Drug class (IDH inhibitor, BRAF inhibitor, immunotherapy, etc.)' },
                    trialExample: { type: 'string', description: 'Example trial or drug (e.g., "Ivosidenib for IDH1-mutant glioma", "Dabrafenib for BRAF V600E")' },
                    eligibility: { type: 'string', description: 'Patient eligibility based on molecular profile' }
                  }
                },
                description: 'Clinical trial opportunities based on molecular markers'
              },

              treatmentRecommendations: {
                type: 'object',
                properties: {
                  chemotherapyGuidance: { type: 'string', description: 'Chemotherapy selection based on MGMT/IDH (e.g., "MGMT methylated - good candidate for TMZ")' },
                  radiationGuidance: { type: 'string', description: 'Radiation therapy guidance' },
                  targetedTherapy: { type: 'array', items: { type: 'string' }, description: 'Potential targeted therapies based on molecular profile' },
                  immunotherapy: { type: 'string', description: 'Immunotherapy considerations (TMB, MSI status)' },
                  prognosticCounseling: { type: 'string', description: 'Prognosis based on molecular subtype' }
                },
                description: 'Treatment recommendations based on molecular profiling'
              },

              specimen: {
                type: 'object',
                properties: {
                  specimenType: { type: 'string', description: 'Specimen type (Surgical resection, stereotactic biopsy)' },
                  specimenDate: { type: 'string', description: 'Date of tissue collection' },
                  pathologyReportDate: { type: 'string', description: 'Date molecular results reported' },
                  laboratory: { type: 'string', description: 'Laboratory performing molecular testing' },
                  tumorCellularity: { type: 'string', description: 'Tumor cellularity percentage (affects molecular testing sensitivity)' }
                },
                description: 'Specimen and testing details'
              }
            },
            description: 'EXTRACT brain tumor molecular markers for precision neuro-oncology - IDH, MGMT, 1p/19q, and comprehensive genomic profiling'
          },
```

### Step 2: Add Collection to medicalCollectionsService.js

**Location:** `services/medicalCollectionsService.js`

**Add:** `'brain_tumor_molecular_markers',` to the `allCollections` array

### Step 3: Add Collection Schema to collectionSchemas.js

**Location:** `services/models/collectionSchemas.js`

**Add:**

```javascript
brain_tumor_molecular_markers: {
  fields: {
    tumorType: { type: 'string' },
    whoGrade: { type: 'string' },
    molecularClassification: { type: 'string' },
    idhStatus: { type: 'object' },
    mgmtStatus: { type: 'object' },
    codeletionStatus: { type: 'object' },
    tertPromoterStatus: { type: 'object' },
    atrmStatus: { type: 'object' },
    tp53Status: { type: 'object' },
    ki67ProliferationIndex: { type: 'object' },
    egfrStatus: { type: 'object' },
    cdkn2aStatus: { type: 'object' },
    brafStatus: { type: 'object' },
    h3Status: { type: 'object' },
    ngsPanel: { type: 'object' },
    clinicalTrialEligibility: { type: 'array' },
    treatmentRecommendations: { type: 'object' },
    specimen: { type: 'object' }
  }
},
```

### Step 4: Test the Schema

```bash
# Backup
cp services/claudeBatchProcessor.js services/claudeBatchProcessor.js.backup

# Syntax check
node -c services/claudeBatchProcessor.js

# Copy test PDF
cp "/home/erangross/Documents/English medical termplates/brain_tumor_molecular_idh_mgmt.pdf" \
   sample-medical-records/

# Run extraction
node scripts/verifyDataExtractionAutoWithCache.js --no-cache
```

### Step 5: Verify in MongoDB

```bash
MONGO_URI=$(cat .kms/MONGODB_ADMIN_URI)
mongosh "$MONGO_URI" --quiet --eval "
  db = db.getSiblingDB('intellicare_practice_yale');
  print('Brain tumor molecular markers count: ' + db.brain_tumor_molecular_markers.countDocuments());
  printjson(db.brain_tumor_molecular_markers.findOne());
"
```

## Expected Data Structure

```javascript
{
  _id: ObjectId(...),
  patientId: ObjectId(...),
  tumorType: "Glioblastoma",
  whoGrade: "Grade 4",
  molecularClassification: "Glioblastoma, IDH-wildtype, WHO Grade 4",
  idhStatus: {
    tested: true,
    result: "IDH-wildtype",
    method: "IHC and sequencing",
    prognosticImplication: "IDH-wildtype = poorer prognosis, older patients, median survival 15 months"
  },
  mgmtStatus: {
    tested: true,
    result: "Methylated",
    methylationPercentage: "45%",
    method: "Pyrosequencing",
    therapeuticImplication: "MGMT methylated - good candidate for temozolomide, expect better response"
  },
  codeletionStatus: {
    tested: true,
    result: "Intact",
    method: "FISH"
  },
  ki67ProliferationIndex: {
    tested: true,
    percentage: "30%",
    interpretation: "High proliferation index",
    prognosticImplication: "Aggressive tumor biology"
  },
  treatmentRecommendations: {
    chemotherapyGuidance: "MGMT methylated - proceed with TMZ chemotherapy per Stupp protocol",
    radiationGuidance: "60 Gy in 30 fractions with concurrent TMZ",
    targetedTherapy: [],
    prognosticCounseling: "IDH-wildtype GBM with MGMT methylation: median survival 20-24 months with standard therapy"
  }
}
```

## Success Criteria

✅ Schema added without syntax errors
✅ Collection registered
✅ Collection schema defined
✅ Test PDF extracts molecular markers
✅ MongoDB collection created
✅ IDH, MGMT, 1p/19q data captured
✅ Clinical trial eligibility identified
✅ Treatment recommendations based on markers

## Status

- [ ] Schema field added
- [ ] Collection registered
- [ ] Collection schema defined
- [ ] Tested with sample PDF
- [ ] MongoDB verified
- [ ] Task complete

---

**Next Task:** task-03-biologic-therapy.md
