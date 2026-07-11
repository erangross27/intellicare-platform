#!/usr/bin/env python3
"""
Remove Extracted Function Implementations from agentServiceV4.js

This script removes all function implementations that have been extracted
to separate service files, while keeping the delegation layer intact.
"""

import re
import sys

# List of all functions to remove
FUNCTIONS_TO_REMOVE = [
    # Patient Service
    'searchPatients', 'searchPatientsByName', 'findPatient', 'listAllPatients',
    'getPatientDetails', 'updatePatient', 'addPatient', 'deletePatientBySearch',
    'importPatientsFromCSV', 'getPatientsNeedingFollowUp', 'getPatientFollowUpDetails',
    'scheduleFollowUp', 'updateFollowUpStatus', 'deleteFollowUp', 'getPatientsForFollowUp',
    'addPatientCondition', 'updatePatientCondition', 'getPatientConditions',
    'getConditionStatistics', 'getPatientsList', 'addMedicalHistory',
    'updateMedicalHistory', 'deleteMedicalHistory', 'getPatientEngagementInsights',
    'anonymizePatientData', 'getPatientConsents', 'assignDocumentToPatient',
    'checkPatientsForAllergies', 'generatePatientReport',

    # Appointment Service
    'scheduleAppointment', 'rescheduleAppointment', 'cancelAppointment',
    'updateAppointment', 'createAppointment', 'findAvailableSlots',
    'getProviderAppointments', 'sendAppointmentConfirmationRequest',

    # Document Service
    'processUploadedDocuments', 'getDocuments', 'searchDocuments',
    'deleteDocument', 'retrievePendingUpload', 'analyzePendingDocument',
    'batchAnalyzeDocuments', 'uploadImagingResult',

    # Medication Service
    'addMedication', 'getMedications', 'checkDrugInteractions',
    'checkDrugAllergy', 'checkDrugSafety', 'sendMedicationRefillReminders',

    # Prescription Service
    'createPrescription', 'getPrescriptions',

    # Lab Service
    'addLabResult', 'getLabResults', 'interpretLabResults', 'parseLabResults',
    'orderLabTest', 'addImagingResult', 'getImagingResults', 'orderImaging',
    'addVitalSigns', 'getVitalSigns', 'recordVitalSigns', 'addVaccination',
    'getVaccinations', 'getProviderAvailability', 'setProviderAvailability',

    # Provider Service
    'addProviderLicense', 'updateProviderLicense', 'removeProviderLicense',
    'getProviderLicense', 'checkProviderStatus', 'getProviders',
    'searchProviders', 'getProviderByNPI', 'setupUserAsProvider',
    'setupMultipleProviders', 'blockProviderTime', 'getProviderMeetings',
    'updateProviderSettings',

    # User Service
    'createUser', 'deleteUser', 'getUserDetails', 'getAllUsers',
    'searchUsers', 'addUserRole', 'removeUserRole', 'assignRole',
    'bulkUpdateRoles', 'getRoles', 'getUserPermissions',
    'updateUserPermissions', 'deactivateUser', 'resendEmailVerification',
    'importUsersFromCSV',

    # Clinic Service
    'createClinic', 'updateClinic', 'getAllClinics', 'getClinicInfo',
    'updateClinicSettings', 'discoverPractice', 'getClinicStatistics',
    'getClinicUsage', 'generateClinicReport', 'getClinicPermissions',
    'rotateClinicToken', 'validateClinicToken', 'getClinicAddress',

    # Communication Service
    'sendTestResultNotifications',
]


def find_function_boundaries(lines, start_line):
    """
    Find the start and end of a function by matching braces.
    Returns (start_index, end_index) or None if not found.

    CRITICAL: Must skip parameter list to avoid counting braces in default params like:
    async getPatientsList(params = {}, practiceContext, session) {
    """
    start_index = start_line
    first_line = lines[start_line].strip()

    # Phase 1: Find the closing ) of the parameter list
    found_param_close = False
    param_paren_count = 0
    in_string = False
    escape_next = False
    string_char = None
    param_close_line = start_line
    param_close_char_idx = 0

    for i in range(start_line, len(lines)):
        line = lines[i]

        for char_idx, char in enumerate(line):
            # Handle escape sequences
            if escape_next:
                escape_next = False
                continue
            if char == '\\':
                escape_next = True
                continue

            # Handle string boundaries
            if char in ['"', "'", '`']:
                if not in_string:
                    in_string = True
                    string_char = char
                elif char == string_char:
                    in_string = False
                    string_char = None
                continue

            # Only count parentheses outside of strings
            if not in_string:
                if char == '(':
                    param_paren_count += 1
                elif char == ')':
                    param_paren_count -= 1
                    if param_paren_count == 0:
                        # Found closing ) of parameters
                        found_param_close = True
                        param_close_line = i
                        param_close_char_idx = char_idx
                        break

        if found_param_close:
            break

    if not found_param_close:
        # Fallback to original algorithm if no parameters
        return find_function_boundaries_simple(lines, start_line)

    # Phase 2: Find the opening { of the function BODY (after the parameter list)
    # Start from the character AFTER the closing )
    found_opening_brace = False
    function_body_start_line = param_close_line
    function_body_start_char = 0

    # First check rest of the same line after the )
    for char_idx in range(param_close_char_idx + 1, len(lines[param_close_line])):
        if lines[param_close_line][char_idx] == '{':
            found_opening_brace = True
            function_body_start_line = param_close_line
            function_body_start_char = char_idx
            break

    # If not found on same line, check subsequent lines
    if not found_opening_brace:
        for i in range(param_close_line + 1, len(lines)):
            line = lines[i]
            for char_idx, char in enumerate(line):
                if char == '{':
                    found_opening_brace = True
                    function_body_start_line = i
                    function_body_start_char = char_idx
                    break
            if found_opening_brace:
                break

    if not found_opening_brace:
        return find_function_boundaries_simple(lines, start_line)

    # Phase 3: Now count braces to find the matching closing brace
    # CRITICAL: Start counting AFTER the opening brace we just found
    brace_count = 1  # We already found the opening {, start with count=1
    in_string = False
    escape_next = False
    string_char = None

    # Start from the character AFTER the opening brace
    for i in range(function_body_start_line, len(lines)):
        line = lines[i]

        # For the first line, skip characters up to and including the opening brace
        start_char = function_body_start_char + 1 if i == function_body_start_line else 0

        for char_idx in range(start_char, len(line)):
            char = line[char_idx]

            # Handle escape sequences
            if escape_next:
                escape_next = False
                continue
            if char == '\\':
                escape_next = True
                continue

            # Handle string boundaries
            if char in ['"', "'", '`']:
                if not in_string:
                    in_string = True
                    string_char = char
                elif char == string_char:
                    in_string = False
                    string_char = None
                continue

            # Only count braces outside of strings
            if not in_string:
                if char == '{':
                    brace_count += 1
                elif char == '}':
                    brace_count -= 1
                    if brace_count == 0:
                        # Found the matching closing brace!
                        return (start_index, i + 1)

    # If we didn't find closing brace, something's wrong
    if brace_count != 0:
        print(f"    ⚠️  Warning: Unmatched braces starting at line {start_line + 1}")

    return None


def find_function_boundaries_simple(lines, start_line):
    """
    Simple brace matching for functions without parameters or as fallback.
    """
    brace_count = 0
    in_function = False
    start_index = start_line
    found_opening_brace = False
    in_string = False
    escape_next = False
    string_char = None

    for i in range(start_line, len(lines)):
        line = lines[i]

        for char in line:
            # Handle escape sequences
            if escape_next:
                escape_next = False
                continue
            if char == '\\':
                escape_next = True
                continue

            # Handle string boundaries
            if char in ['"', "'", '`']:
                if not in_string:
                    in_string = True
                    string_char = char
                elif char == string_char:
                    in_string = False
                    string_char = None
                continue

            if not in_string:
                if char == '{':
                    brace_count += 1
                    in_function = True
                    found_opening_brace = True
                elif char == '}':
                    brace_count -= 1
                    if in_function and brace_count == 0:
                        return (start_index, i + 1)

    if found_opening_brace and brace_count != 0:
        print(f"    ⚠️  Warning: Unmatched braces starting at line {start_line + 1}")

    return None


def remove_functions(input_file, output_file):
    """
    Remove extracted functions from the input file and write to output file.
    """
    # Read the file
    with open(input_file, 'r') as f:
        lines = f.readlines()

    total_lines = len(lines)
    removed_functions = []
    lines_removed = 0

    # Track which lines to remove
    lines_to_remove = set()

    # Find and mark all function implementations for removal
    for func_name in FUNCTIONS_TO_REMOVE:
        # Pattern to match: "  async functionName(" at the start of a line
        pattern = re.compile(rf'^  async {re.escape(func_name)}\(')

        for i, line in enumerate(lines):
            if pattern.match(line):
                # Found the function declaration
                boundaries = find_function_boundaries(lines, i)

                if boundaries:
                    start, end = boundaries
                    # Mark these lines for removal
                    for idx in range(start, end):
                        lines_to_remove.add(idx)

                    removed_functions.append({
                        'name': func_name,
                        'start': start + 1,  # 1-indexed for display
                        'end': end,
                        'lines': end - start
                    })

                    print(f"✓ Found {func_name} at lines {start + 1}-{end} ({end - start} lines)")
                    break

    # Create new content without removed lines
    new_lines = [line for i, line in enumerate(lines) if i not in lines_to_remove]

    # Write to output file
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

    # Show missing functions
    found_names = {f['name'] for f in removed_functions}
    missing = set(FUNCTIONS_TO_REMOVE) - found_names

    if missing:
        print(f"\n⚠️  Functions not found (may already be removed or delegate):")
        for name in sorted(missing):
            print(f"  - {name}")

    return removed_functions, lines_removed


if __name__ == '__main__':
    # Use working copy for testing
    input_file = '/home/erangross/Development/IntelliCare/apps/backend-api/services/agentServiceV4-WORKING-COPY.js'
    output_file = '/home/erangross/Development/IntelliCare/apps/backend-api/services/agentServiceV4-CLEANED.js'

    print("🔄 Removing extracted function implementations from agentServiceV4-WORKING-COPY.js\n")

    try:
        removed, lines_removed = remove_functions(input_file, output_file)

        print(f"\n✅ Cleanup complete!")
        print(f"📄 Output written to: {output_file}")
        print(f"\nNext steps:")
        print(f"  1. Test syntax: node -c {output_file}")
        print(f"  2. If valid: mv {output_file} /home/erangross/Development/IntelliCare/apps/backend-api/services/agentServiceV4.js")
        print(f"  3. If issues: Fix script and run again on WORKING-COPY")

    except Exception as e:
        print(f"❌ Error: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)
