#!/usr/bin/env python3
"""
Rename files with 'clinic' in the name to 'practice'
Does NOT change 'clinical' which is a medical term
"""
import os
import shutil

def should_rename(filename):
    """Check if a file should be renamed"""
    # Don't rename clinical files (medical term)
    if 'clinical' in filename.lower():
        return False
    # Don't rename backup files
    if filename.endswith('.backup'):
        return False
    # Check if it has clinic in the name
    return 'clinic' in filename.lower()

def get_new_name(filename):
    """Get the new filename with clinic replaced by practice"""
    # Replace variations of clinic/clinics with practice/practices
    new_name = filename
    new_name = new_name.replace('clinic-', 'practice-')
    new_name = new_name.replace('clinics-', 'practices-')
    new_name = new_name.replace('test-clinic', 'test-practice')
    new_name = new_name.replace('cross-clinic', 'cross-practice')
    new_name = new_name.replace('stanford-clinic', 'stanford-practice')
    new_name = new_name.replace('clinic.', 'practice.')
    new_name = new_name.replace('clinics.', 'practices.')
    return new_name

def main():
    # Files to rename
    files_to_rename = [
        './clinic-creation-1756121300731.png',
        './clinic-creation-complete.png',
        './clinic-credentials.json',
        './clinic-registration-1756047916164.png',
        './clinic-registration-1756048008200.png',
        './clinic-step1-initial.png',
        './clinic-step11-complete.png',
        './clinic-users-data.json',
        './fresh-clinic-creation.png',
        './new-clinic-1756053435113.png',
        './scripts/clean-stanford-clinic.js',
        './test-3-clinic-created.png',
        './test-clinic-address.js',
        './test-clinic-creation.js',
        './tests/test-cross-clinic.js'
    ]

    print("Renaming clinic files to practice...\n")

    renamed_count = 0
    skipped_count = 0

    for old_path in files_to_rename:
        if os.path.exists(old_path):
            filename = os.path.basename(old_path)
            if should_rename(filename):
                new_filename = get_new_name(filename)
                new_path = os.path.join(os.path.dirname(old_path), new_filename)

                print(f"Renaming: {old_path}")
                print(f"   -> {new_path}")

                try:
                    os.rename(old_path, new_path)
                    renamed_count += 1
                    print("   Success\n")
                except Exception as e:
                    print(f"   Error: {e}\n")
            else:
                print(f"Skipping: {old_path} (should not be renamed)\n")
                skipped_count += 1
        else:
            print(f"Not found: {old_path}\n")

    print(f"\nRenaming complete!")
    print(f"  Renamed: {renamed_count} files")
    print(f"  Skipped: {skipped_count} files")

if __name__ == "__main__":
    main()