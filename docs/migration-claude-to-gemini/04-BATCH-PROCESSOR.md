# Task 04: Batch Processor Migration (Gemini 3.0)

**Goal:** Replace `claudeBatchProcessor.js` with a Google-based bulk document analysis solution using Gemini 3.0 models.

## The Challenge
*   **Claude:** Uses `messages.batches.create`. Processes async (50% cheaper) with a 24h turnaround.
*   **Google Gemini 3.0:** Google AI Studio offers a Batch API with similar 50% discounts.
    *   *Strategy:* Use Gemini 3.0 Flash for standard extractions and 3.0 Pro for complex, high-stakes medical summaries.

## Recommended Strategy: Gemini 3.0 Batch API
Since Gemini 3.0 Flash is extremely fast, we will build a `geminiBatchProcessor.js` that:
1.  Accepts a list of medical documents.
2.  Submits them to the Gemini 3.0 Batch API for maximum cost savings.
3.  **Real-time Option:** For "urgent" uploads, use concurrent real-time requests to 3.0 Flash.

## Implementation Steps

1.  **Create `geminiBatchProcessor.js`**
    *   Input: Array of documents (PDFs/Images).
    *   Logic:
        *   Utilize Google's `fileManager` API to upload documents. Gemini 3.0 has superior native PDF vision.
        *   Format requests for the Batch API (JSONL format).
        *   Aggregate results into the database.

2.  **Specialty Extraction Tuning**
    *   Gemini 3.0 handles massive documents natively. We can often send the whole PDF without pre-conversion.

3.  **Cost Analysis**
    *   Update `costTrackingService.js` to reflect Gemini 3.0 tiered pricing.