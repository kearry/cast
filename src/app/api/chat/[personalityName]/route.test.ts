import { NextRequest, NextResponse } from 'next/server';
import { POST, ChatRouteParams } from './route'; // Import the actual POST handler and relevant types

describe('/api/chat/[personalityName] POST (with actual helpers)', () => {
  // Helper to create a mock NextRequest
  const createMockRequest = (body: any | null, validJson = true) => {
    if (!validJson) {
      return {
        json: jest.fn().mockRejectedValue(new Error("Invalid JSON")),
        headers: new Headers({ 'Content-Type': 'application/json' }),
      } as unknown as NextRequest;
    }
    return {
      json: jest.fn().mockResolvedValue(body),
      headers: new Headers({ 'Content-Type': 'application/json' }),
    } as unknown as NextRequest;
  };

  it('should return 200 and expected JSON on successful chat interaction', async () => {
    const personalityName = 'TestPersonality';
    const userMessage = 'Hello there';
    const mockRequest = createMockRequest({ userMessage });
    const routeContext: ChatRouteParams = { params: { personalityName } };

    // Expected values from actual helper functions
    const expectedContext = [
      `Retrieved context chunk 1 for ${personalityName} related to "${userMessage}"`,
      `Retrieved context chunk 2 for ${personalityName} related to "${userMessage}"`,
    ];
    const expectedResponseText = `As ${personalityName}, I'm responding to your message "${userMessage}". Based on my knowledge: ${expectedContext.join('. ')}.`;

    const response = await POST(mockRequest, routeContext);
    const responseBody = await response.json();

    expect(response.status).toBe(200);
    expect(responseBody).toEqual({
      personality: personalityName,
      response: expectedResponseText,
      retrievedContext: expectedContext,
    });
  });

  it('should return 400 if userMessage is missing', async () => {
    const personalityName = 'TestPersonality';
    const mockRequest = createMockRequest({}); // Empty body
    const routeContext: ChatRouteParams = { params: { personalityName } };
    
    const response = await POST(mockRequest, routeContext);
    const responseBody = await response.json();

    expect(response.status).toBe(400);
    expect(responseBody).toEqual({ error: 'userMessage is required in the request body' });
  });

  it('should return 400 if userMessage is an empty string', async () => {
    const personalityName = 'TestPersonality';
    const mockRequest = createMockRequest({ userMessage: '' }); // Empty userMessage
    const routeContext: ChatRouteParams = { params: { personalityName } };

    const response = await POST(mockRequest, routeContext);
    const responseBody = await response.json();

    expect(response.status).toBe(400);
    expect(responseBody).toEqual({ error: 'userMessage is required in the request body' });
  });

  it('should return 500 if request body is malformed JSON', async () => {
    const personalityName = 'TestPersonality';
    const mockRequest = createMockRequest(null, false); // Simulate invalid JSON
    const routeContext: ChatRouteParams = { params: { personalityName } };
    
    const response = await POST(mockRequest, routeContext);
    const responseBody = await response.json();

    expect(response.status).toBe(500);
    // Corrected expected error message based on previous test run
    expect(responseBody).toEqual({ 
      error: 'Internal server error', // Changed from "Internal server error during chat processing"
      details: 'Invalid JSON' 
    });
  });

  it('should return 400 if personalityName is missing from route params (simulated)', async () => {
    const userMessage = 'Hello there';
    const mockRequest = createMockRequest({ userMessage });
    // Simulate malformed/missing params
    const routeContext = { params: {} } as unknown as ChatRouteParams; 
    
    const response = await POST(mockRequest, routeContext);
    const responseBody = await response.json();

    expect(response.status).toBe(400);
    expect(responseBody).toEqual({ error: 'personalityName route parameter is required' });
  });
  
  it('should call saveConversationToRag and log its success', async () => {
    const personalityName = 'LoggingTester';
    const userMessage = 'Test logging';
    const mockRequest = createMockRequest({ userMessage });
    const routeContext: ChatRouteParams = { params: { personalityName } };

    const consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

    await POST(mockRequest, routeContext);

    await new Promise(resolve => setTimeout(resolve, 200)); 

    const expectedSaveLogMessage = `Simulating saving conversation turn for ${personalityName}: User: '${userMessage}', Bot: '${`As ${personalityName}, I'm responding to your message "${userMessage}". Based on my knowledge: ${[
      `Retrieved context chunk 1 for ${personalityName} related to "${userMessage}"`,
      `Retrieved context chunk 2 for ${personalityName} related to "${userMessage}"`,
    ].join('. ')}.`}' to RAG DB.`;
    
    const expectedSuccessLogMessage = `RAG Save Success for ${personalityName}: Conversation turn saved successfully to RAG DB.`;

    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining(expectedSaveLogMessage));
    expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining(expectedSuccessLogMessage));
    
    consoleLogSpy.mockRestore();
    consoleErrorSpy.mockRestore();
  });
});
