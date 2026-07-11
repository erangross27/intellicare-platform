# Helper Functions to Extract from agentServiceV4.js

**Total:** 110 helper functions (non-async)

---

## utilityHelpers.js (Core Utilities - 15 functions)
- normalizePracticeContext
- createSecureContext
- cleanUndefinedProperties
- detectLanguage
- detectClinicCountry
- formatDate
- convertFieldName
- getFieldData
- calculateAge
- formatFileSize
- estimateTokens
- calculateCost
- parseCSVLine
- suggestUserFieldMappings
- formatFunctionResult

## aiHelpers.js (AI/Function Selection - 10 functions)
- getEssentialFunctions
- getMinimalFunctionsForClaude
- simplifyParameters
- getShortDescription
- getAllPlatformFunctions
- getCompleteSystemInstruction
- updateSessionContext
- getFunctionGroups
- categorizeFunctionName
- getSubcategory

## medicalHelpers.js (Medical Logic - 8 functions)
- detectMedicalIntent
- parseSearchCriteria
- detectSearchMode
- getConditionCollectionName
- isSensitiveFunction
- isCriticalFunction
- getCategoryIcon
- getServiceByName

## allergyHelpers.js (Allergy Management - 12 functions)
- groupAllergies
- generateAllergiesAlerts
- generateAllergiesSummary
- generateAllergiesMessage
- categorizeAllergyType
- parseReactionTypes
- getSeverityScore
- checkMedicationAllergyConflicts
- getCrossReactiveAllergens
- generateAllergyAlerts
- generateAllergyCard
- generateAllergyMessage

## medicationHelpers.js (Medication Formatting - 3 functions)
- formatMedicationDisplay
- generateMedicationSummary
- generateMedicationMessage

## documentHelpers.js (Document Analysis - 11 functions)
- generateDocumentSummary (appears twice!)
- generateDocumentMessage
- classifyDocumentType
- assessMedicalRelevance
- assessTextQuality
- assessDataCompleteness
- hasStructuredData
- generateAnalysisRecommendations
- generateAnalysisSummary
- hasVisualization
- getDisplayType

## chatHelpers.js (Chat/Session Management - 11 functions)
- generateSessionTopic
- determinePriority
- generateSessionSummary
- generateChatSessionMessage
- calculateSessionDuration
- determineSessionStatus
- highlightSearchTerms
- categorizeSessionTopic
- groupSessionsByTime
- generateSearchAnalytics
- generateSearchSummary

## searchHelpers.js (Search Utilities - 3 functions)
- getSearchTimeRange
- getMostCommonValue
- generateSearchMessage

## userHelpers.js (User/Role Management - 9 functions)
- generateRolePermissions
- generateWelcomeMessage
- generateUserSummary
- generateUserNextSteps
- generateCreateUserMessage
- generateRoleChangeSummary
- generateRoleUpdateMessage
- comparePermissions
- doesRoleChangeRequireTraining

## accessHelpers.js (Access Control - 1 function)
- getAccessChanges

## vaccinationHelpers.js (Vaccination Logic - 17 functions)
- calculateTimeSinceVaccination
- checkBoosterNeeded
- determineVaccinationStatus
- groupVaccinations
- analyzeVaccinationSchedule
- getRequiredVaccinesForAge
- generateVaccinationRecommendations
- getVaccinePriority
- generateVaccinationAlerts
- generateVaccinationSummary
- generateVaccinationsMessage
- validateVaccineForAge
- hasHighRiskConditions
- getVaccineSeriesInfo
- calculateNextDoseDate
- generateVaccinationCard
- generateVaccinationReminders

## reportHelpers.js (Report Generation - 8 functions)
- calculateCorrelation
- interpretCorrelation
- generateExecutiveReport
- generateDetailedReport
- getTopPerformingChannel
- generateNextSteps
- generateVerificationCode
- generateVaccinationMessage

## KEEP IN agentServiceV4.js (2 functions)
- constructor
- (any core initialization)

---

## Summary

**110 helper functions to extract** into 11 utility service files:
1. utilityHelpers.js (15)
2. aiHelpers.js (10)
3. medicalHelpers.js (8)
4. allergyHelpers.js (12)
5. medicationHelpers.js (3)
6. documentHelpers.js (11)
7. chatHelpers.js (11)
8. searchHelpers.js (3)
9. userHelpers.js (9)
10. accessHelpers.js (1)
11. vaccinationHelpers.js (17)
12. reportHelpers.js (8)

**These are pure utility functions** - no database access, just formatting, validation, and calculation logic.
