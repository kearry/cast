import { NextRequest, NextResponse } from 'next/server';
import { POST } from './route'; // Import the actual POST handler

describe('/api/create-chatbot POST (with actual helpers)', () => {
  // Helper to create a mock NextRequest
  const createMockRequest = (body: any | null, validJson = true) => {
    if (!validJson) {
      // For simulating invalid JSON, we make .json() throw an error
      return {
        json: jest.fn().mockRejectedValue(new Error("Invalid JSON")),
        headers: new Headers({ 'Content-Type': 'application/json' }), // Still set headers
      } as unknown as NextRequest;
    }
    return {
      json: jest.fn().mockResolvedValue(body),
      headers: new Headers({ 'Content-Type': 'application/json' }),
    } as unknown as NextRequest;
  };

  it('should return 200 and expected JSON on valid personalityName', async () => {
    const personalityName = 'Test Bot';
    const mockRequest = createMockRequest({ personalityName });
    
    const response = await POST(mockRequest);
    const responseBody = await response.json();

    expect(response.status).toBe(200); 
    expect(responseBody).toEqual({
      message: `Chatbot creation process initiated for ${personalityName}`,
      searchResults: [ // Expected from actual performDeepSearch
        `Sample biography of ${personalityName}`,
        `Early life of ${personalityName}`,
        `Achievements of ${personalityName}`,
      ],
      documentsAddedToRag: 3, // Expected from actual addToRagDatabase (length of searchResults)
    });
  });

  it('should return 400 if personalityName is missing', async () => {
    const mockRequest = createMockRequest({}); // Empty body
    const response = await POST(mockRequest);
    const responseBody = await response.json();

    expect(response.status).toBe(400);
    expect(responseBody).toEqual({ error: 'personalityName is required' });
  });
  
  it('should return 400 if personalityName is an empty string', async () => {
    const mockRequest = createMockRequest({ personalityName: '' }); // Empty string
    const response = await POST(mockRequest);
    const responseBody = await response.json();

    expect(response.status).toBe(400);
    expect(responseBody).toEqual({ error: 'personalityName is required' });
  });

  it('should return 500 if request body is malformed JSON', async () => {
    // Simulate a request where .json() would fail by passing validJson = false
    const mockRequest = createMockRequest(null, false); 
    
    const response = await POST(mockRequest);
    const responseBody = await response.json();

    expect(response.status).toBe(500);
    expect(responseBody).toEqual({ 
      error: 'Internal server error during chatbot creation process', 
      details: 'Invalid JSON' // This detail comes from the error thrown by mockRequest.json()
    });
  });

  // Note: The placeholder functions performDeepSearch and addToRagDatabase
  // are designed to always succeed. Testing their specific failure cases
  // (e.g., if performDeepSearch itself threw an error) would require
  // re-introducing mocks for them, which is outside the scope of this specific task.
  // The current tests focus on the POST handler's logic around these successful placeholder calls.
});
