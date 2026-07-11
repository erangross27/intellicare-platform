#!/usr/bin/env python3
"""Test brace matching for getPatientsList"""

# Read the file
with open('services/agentServiceV4-WORKING-COPY.js', 'r') as f:
    lines = f.readlines()

# Test on getPatientsList (line 17486)
test_line = 17485  # 0-indexed

print(f"Line {test_line + 1}: {lines[test_line][:80]}")

# Find closing ) of parameters
param_paren_count = 0
in_string = False
string_char = None
found_param_close = False
param_close_line = test_line
param_close_char_idx = 0

for i in range(test_line, min(test_line + 5, len(lines))):
    line = lines[i]
    print(f"\nLine {i+1}: {line[:100]}")

    for char_idx, char in enumerate(line):
        if char in ['"', "'", '`']:
            if not in_string:
                in_string = True
                string_char = char
            elif char == string_char:
                in_string = False
                string_char = None
            continue

        if not in_string:
            if char == '(':
                param_paren_count += 1
                print(f"  char {char_idx}: '(' paren_count={param_paren_count}")
            elif char == ')':
                param_paren_count -= 1
                print(f"  char {char_idx}: ')' paren_count={param_paren_count}")
                if param_paren_count == 0:
                    found_param_close = True
                    param_close_line = i
                    param_close_char_idx = char_idx
                    print(f"  ✓ Found closing ) at line {i+1}, char {char_idx}")
                    break

    if found_param_close:
        break

if not found_param_close:
    print("ERROR: Could not find closing )")
    exit(1)

# Now find opening { after the )
print(f"\n\nSearching for {{ after character {param_close_char_idx} on line {param_close_line+1}")
print(f"Rest of line: {lines[param_close_line][param_close_char_idx:].strip()}")

found_opening_brace = False
function_body_start = param_close_line

# Check rest of same line
for char_idx in range(param_close_char_idx + 1, len(lines[param_close_line])):
    if lines[param_close_line][char_idx] == '{':
        found_opening_brace = True
        function_body_start = param_close_line
        print(f"✓ Found opening {{ at line {param_close_line+1}, char {char_idx}")
        break

if not found_opening_brace:
    print("ERROR: Could not find opening {")
    exit(1)

# Now count braces
print(f"\n\nCounting braces starting from line {function_body_start+1}...")
brace_count = 0
in_string = False
string_char = None

for i in range(function_body_start, min(function_body_start + 100, len(lines))):
    line = lines[i]

    for char in line:
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
                if i <= function_body_start + 5:
                    print(f"  Line {i+1}: '{char}' count={brace_count}")
            elif char == '}':
                brace_count -= 1
                if i <= function_body_start + 5:
                    print(f"  Line {i+1}: '{char}' count={brace_count}")
                if brace_count == 0:
                    print(f"✓ Function ends at line {i+1}")
                    print(f"  Total lines: {i+1 - test_line}")
                    exit(0)

print(f"ERROR: Brace count never reached 0. Final count: {brace_count}")
