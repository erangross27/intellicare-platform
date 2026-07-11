# TASK PLAN: Implement Proper Gemini Function Calling

## Research Findings

### ❌ Current Problem
- We're using Gemini API **incorrectly** - treating it like a text completion model
- Asking it to parse JSON manually instead of using **native function calling**
- **Gemini 2.0 Flash Lite does NOT support function calling** ❌
- Current approach: Text prompts → Hope AI understands → Parse JSON manually

### ✅ Correct Solution
- **Gemini 2.0 Flash** (not Lite) **DOES support function calling** ✅
- Use native `tools` parameter with `functionDeclarations`
- Model automatically calls functions and provides structured parameters
- No manual JSON parsing needed

## Key Discoveries

1. **Model Limitation**: `gemini-2.0-flash-lite` does NOT support function calling
2. **Correct Model**: `gemini-2.0-flash` DOES support function calling
3. **Native API**: Gemini has built-in function calling with automatic parameter extraction
4. **User Experience**: Users can have normal conversations, AI fills in the blanks automatically

## Implementation Plan

### Phase 1: Switch to Correct Model
- [ ] Change from `gemini-2.0-flash-lite` to `gemini-2.0-flash`
- [ ] Update model configuration in agentService.js
- [ ] Test cost difference (Flash vs Flash-Lite)

### Phase 2: Implement Native Function Calling
- [ ] Remove all text-based intent detection prompts
- [ ] Replace with native `functionDeclarations` using `tools` parameter
- [ ] Define functions with proper schemas:
  ```javascript
  const tools = [{
    functionDeclarations: [{
      name: "add_patient",
      description: "Add a new patient to the system",
      parameters: {
        type: "object",
        properties: {
          name: { type: "string", description: "Patient full name" },
          age: { type: "number", description: "Patient age" },
          nationalId: { type: "string", description: "National ID number" },
          email: { type: "string", description: "Email address" },
          phone: { type: "string", description: "Phone number" },
          address: { type: "string", description: "Home address" }
        },
        required: ["name", "age", "nationalId"]
      }
    }]
  }];
  ```

### Phase 3: Update Agent Service
- [ ] Remove `detectIntentWithGemini()` function
- [ ] Remove manual JSON parsing
- [ ] Use `response.functionCalls` instead of parsing text
- [ ] Handle function calls automatically:
  ```javascript
  if (response.functionCalls && response.functionCalls.length > 0) {
    const functionCall = response.functionCalls[0];
    // Execute the function with provided parameters
    const result = await this.executeFunction(functionCall.name, functionCall.args);
  }
  ```

### Phase 4: Natural Conversation Flow
- [ ] User can say: "אילנה לוי בת 64 מרחובות נקבה מייל ilana.levi@gmail.com"
- [ ] Gemini automatically extracts: `{name: "אילנה לוי", age: 64, email: "ilana.levi@gmail.com"}`
- [ ] If missing required fields, Gemini asks naturally: "מה מספר תעודת הזהות?"
- [ ] No manual prompt engineering needed

### Phase 5: Error Handling
- [ ] Handle missing required parameters automatically
- [ ] Gemini will ask for missing information naturally
- [ ] No more 400 errors from incomplete data
- [ ] Better user experience with clear requests

## Expected Benefits

1. **Natural Conversations**: Users can speak normally, AI understands context
2. **Automatic Extraction**: No need to hardcode every possible phrase
3. **Multilingual Support**: Works with Hebrew/English mixed input naturally
4. **Error Reduction**: No more manual JSON parsing errors
5. **Scalability**: No need to update prompts for every new use case

## Cost Considerations

- **Flash-Lite**: Cheaper but NO function calling
- **Flash**: More expensive but WITH function calling
- **Trade-off**: Higher cost vs. much better functionality
- **Recommendation**: Switch to Flash for better user experience

## Next Steps

1. **Test Flash model** with simple function calling example
2. **Measure cost difference** between Flash and Flash-Lite
3. **Implement one function** (add_patient) as proof of concept
4. **Gradually migrate** all agent functions to native function calling
5. **Remove all text-based prompts** from database

## Success Criteria

- [ ] User says: "הוסף מטופל יוחנן כהן בן 30 זכר ת.ז. 123456789"
- [ ] Agent automatically extracts all parameters
- [ ] Creates patient successfully without errors
- [ ] No manual prompt engineering required
- [ ] Works with any phrasing/language combination
