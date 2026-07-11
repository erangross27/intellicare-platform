# Task 06: Testing & Validation

**Goal:** Verify the new Gemini-based system works correctly.

## 1. Unit Tests
*   Create `test-gemini-connection.js`: Simple "Hello World".
*   Create `test-gemini-functions.js`: Call `getPatient(id="123")` and verify Gemini calls the tool.

## 2. Integration Tests
*   **Chat Interface:**
    *   Send a message: "Who is patient Helen Cox?"
    *   Verify: Gemini calls `searchPatientsByName`, then `getPatientDetails`, then answers textually.
    *   Verify streaming works (typing effect).
*   **Document Analysis:**
    *   Upload a PDF.
    *   Verify `geminiBatchProcessor` (or parallel Flash calls) extracts the correct JSON schema.

## 3. Accuracy Benchmarking
*   Compare Claude vs. Gemini on a complex medical query.
    *   Query: "Analyze the trend in creatinine levels for patient X over the last 3 months."
    *   Metric: Did it call the right tools? Did it interpret "trend" correctly?

## 4. Cost Monitoring
*   Verify that `costTrackingService` accurately logs Gemini token usage.
*   Ensure we aren't accidentally triggering expensive calls (e.g., using Pro 1.5 where Flash would suffice).
