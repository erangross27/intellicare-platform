#!/usr/bin/env python3
"""
Safe function removal - uses simple line-by-line brace counting
Handles template literals by treating ` quotes like other quotes
"""

import re
import sys

FUNCTIONS_TO_REMOVE = [
    'searchPatients', 'searchPatientsByName', 'findPatient', 'listAllPatients',
    'getPatientDetails', 'updatePatient', 'addPatient', 'deletePatientBySearch',
    'importPatientsFromCSV', 'getPatientsNeedingFollowUp', 'getPatientFollowUpDetails',
    'scheduleFollowUp', 'updateFollowUpStatus', 'deleteFollowUp', 'getPatientsForFollowUp',
    'addPatientCondition', 'updatePatientCondition', 'getPatientConditions',
    'getConditionStatistics', 'getPatientsList', 'addMedicalHistory',
    'updateMedicalHistory', 'deleteMedicalHistory', 'getPatientEngagementInsights',
    'anonymizePatientData', 'getPatientConsents', 'assignDocumentToPatient',
    'checkPatientsForAllergies', 'generatePatientReport',
    'scheduleAppointment', 'rescheduleAppointment', 'cancelAppointment',
    'updateAppointment', 'createAppointment', 'findAvailableSlots',
    'getProviderAppointments', 'sendAppointmentConfirmationRequest',
    'processUploadedDocuments', 'getDocuments', 'searchDocuments',
    'deleteDocument', 'retrievePendingUpload', 'analyzePendingDocument',
    'batchAnalyzeDocuments', 'uploadImagingResult',
    'addMedication', 'getMedications', 'checkDrugInteractions',
    'checkDrugAllergy', 'checkDrugSafety', 'sendMedicationRefillReminders',
    'createPrescription', 'getPrescriptions',
    'addLabResult', 'getLabResults', 'interpretLabResults', 'parseLabResults',
    'orderLabTest', 'addImagingResult', 'getImagingResults', 'orderImaging',
    'addVitalSigns', 'getVitalSigns', 'recordVitalSigns', 'addVaccination',
    'getVaccinations', 'getProviderAvailability', 'setProviderAvailability',
    'addProviderLicense', 'updateProviderLicense', 'removeProviderLicense',
    'getProviderLicense', 'checkProviderStatus', 'getProviders',
    'searchProviders', 'getProviderByNPI', 'setupUserAsProvider',
    'setupMultipleProviders', 'blockProviderTime', 'getProviderMeetings',
    'updateProviderSettings',
    'createUser', 'deleteUser', 'getUserDetails', 'getAllUsers',
    'searchUsers', 'addUserRole', 'removeUserRole', 'assignRole',
    'bulkUpdateRoles', 'getRoles', 'getUserPermissions',
    'updateUserPermissions', 'deactivateUser', 'resendEmailVerification',
    'importUsersFromCSV',
    'createClinic', 'updateClinic', 'getAllClinics', 'getClinicInfo',
    'updateClinicSettings', 'discoverPractice', 'getClinicStatistics',
    'getClinicUsage', 'generateClinicReport', 'getClinicPermissions',
    'rotateClinicToken', 'validateClinicToken', 'getClinicAddress',
    'sendTestResultNotifications',
]

def count_braces_simple(lines, start_line, max_lines=15000):
    """
    Simple brace counter that counts { and } while respecting strings.
    Returns end line or None if can't find within max_lines.
    """
    brace_count = 0
    in_string = False
    string_char = None

    for i in range(start_line, min(start_line + max_lines, len(lines))):
        line = lines[i]

        j = 0
        while j < len(line):
            char = line[j]

            # Handle string start/end
            if char in ['"', "'", '`'] and (j == 0 or line[j-1] != '\\'):
                if not in_string:
                    in_string = True
                    string_char = char
                elif char == string_char:
                    in_string = False
                    string_char = None

            # Count braces only outside strings
            elif not in_string:
                if char == '{':
                    brace_count += 1
                elif char == '}':
                    brace_count -= 1
                    if brace_count == 0:
                        return i + 1  # Return line AFTER closing brace

            j += 1

    return None

def remove_functions(input_file, output_file):
    with open(input_file, 'r') as f:
        lines = f.readlines()

    total_lines = len(lines)
    lines_to_remove = set()
    removed_functions = []

    for func_name in FUNCTIONS_TO_REMOVE:
        # Match: "  async functionName("
        pattern = re.compile(rf'^  async {re.escape(func_name)}\(')

        for i, line in enumerate(lines):
            if pattern.match(line):
                end_line = count_braces_simple(lines, i, max_lines=500)

                if end_line:
                    # Mark lines for removal
                    for idx in range(i, end_line):
                        lines_to_remove.add(idx)

                    removed_functions.append({
                        'name': func_name,
                        'start': i + 1,
                        'end': end_line,
                        'lines': end_line - i
                    })

                    print(f"✓ Found {func_name} at lines {i + 1}-{end_line} ({end_line - i} lines)")
                else:
                    print(f"⚠️  Found {func_name} at line {i + 1} but couldn't find end within 15000 lines - SKIPPING")

                break  # Found this function, move to next

    # Create new content
    new_lines = [line for i, line in enumerate(lines) if i not in lines_to_remove]

    # Write output
    with open(output_file, 'w') as f:
        f.writelines(new_lines)

    lines_removed = len(lines) - len(new_lines)

    # Summary
    print(f"\n{'='*70}")
    print(f"SUMMARY:")
    print(f"{'='*70}")
    print(f"Original file size: {total_lines} lines")
    print(f"Functions found: {len(removed_functions)} / {len(FUNCTIONS_TO_REMOVE)}")
    print(f"Lines removed: {lines_removed}")
    print(f"New file size: {len(new_lines)} lines")
    print(f"Reduction: {lines_removed / total_lines * 100:.1f}%")

    # Show missing
    found_names = {f['name'] for f in removed_functions}
    missing = set(FUNCTIONS_TO_REMOVE) - found_names

    if missing:
        print(f"\n⚠️  Functions not found (may already be removed or delegate):")
        for name in sorted(missing):
            print(f"  - {name}")

    return removed_functions, lines_removed

if __name__ == '__main__':
    input_file = 'services/agentServiceV4-WORKING-COPY.js'
    output_file = 'services/agentServiceV4-CLEANED.js'

    print("🔄 Removing extracted function implementations from agentServiceV4-WORKING-COPY.js\n")

    try:
        removed, lines_removed = remove_functions(input_file, output_file)

        print(f"\n✅ Cleanup complete!")
        print(f"📄 Output written to: {output_file}")
        print(f"\nNext steps:")
        print(f"  1. Test syntax: node -c {output_file}")
        print(f"  2. If valid: cp {output_file} services/agentServiceV4.js")
        print(f"  3. If issues: Fix script and run again")

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
