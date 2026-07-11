/**
 * artifactPanelHelper.js
 *
 * Helper utility to trigger the artifact panel from anywhere in the application.
 * Uses CustomEvent to communicate with ChatContainer.
 */

/**
 * Opens the artifact panel with specified parameters
 *
 * @param {string} patientId - Required: Patient ID
 * @param {string} category - Optional: Category name (e.g., 'medications', 'lab_results')
 * @param {string} documentId - Optional: Specific document ID to display
 *
 * @example
 * // Show all categories for a patient
 * openArtifactPanel('patient_123');
 *
 * @example
 * // Show all medications for a patient
 * openArtifactPanel('patient_123', 'medications');
 *
 * @example
 * // Show specific medication document
 * openArtifactPanel('patient_123', 'medications', 'doc_456');
 */
export function openArtifactPanel(patientId, category = null, documentId = null) {
  if (!patientId) {
    console.error('[artifactPanelHelper] Patient ID is required');
    return;
  }

  const event = new CustomEvent('openArtifactPanel', {
    detail: { patientId, category, documentId }
  });

  window.dispatchEvent(event);

  console.log('[artifactPanelHelper] Artifact panel opened:', { patientId, category, documentId });
}

/**
 * Opens artifact panel to show all medical categories for a patient
 *
 * @param {string} patientId - Patient ID
 */
export function showPatientCategories(patientId) {
  openArtifactPanel(patientId);
}

/**
 * Opens artifact panel to show documents in a specific category
 *
 * @param {string} patientId - Patient ID
 * @param {string} category - Category name (e.g., 'medications', 'lab_results')
 */
export function showCategoryDocuments(patientId, category) {
  openArtifactPanel(patientId, category);
}

/**
 * Opens artifact panel to show a specific document
 *
 * @param {string} patientId - Patient ID
 * @param {string} category - Category name
 * @param {string} documentId - Document ID
 */
export function showDocument(patientId, category, documentId) {
  openArtifactPanel(patientId, category, documentId);
}

export default {
  openArtifactPanel,
  showPatientCategories,
  showCategoryDocuments,
  showDocument
};
