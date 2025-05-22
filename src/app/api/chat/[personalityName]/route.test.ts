import { NextRequest } from 'next/server';

// Step 1: Import the parts of the module we want to keep REAL.
const { POST: actualPOSTHandler } = jest.requireActual('./route');
// If ChatRouteParams was an exported value (not just a type), it would be:
// const { POST: actualPOSTHandler, ChatRouteParams: ActualChatRouteParams } = jest.requireActual('./route');


// Step 2: Define our jest.fn() mocks.
const mockRetrieveFromRagDatabase = jest.fn();
const mockGenerateChatbotResponse = jest.fn();
const mockSaveConversationToRag = jest.fn();

// Step 3: Mock the module.
jest.mock('./route', () => ({
  __esModule: true,
  POST: actualPOSTHandler, // Use the real POST handler
  // ChatRouteParams: ActualChatRouteParams, // Use real interface if it were an exported value
  retrieveFromRagDatabase: mockRetrieveFromRagDatabase, // Use our mock
  generateChatbotResponse: mockGenerateChatbotResponse, // Use our mock
  saveConversationToRag: mockSaveConversationToRag,     // Use our mock
}));

// Step 4: Import from './route' AFTER jest.mock.
// POST will be the actual POST handler.
// The others will be the mocks defined above.
import { POST, retrieveFromRagDatabase, generateChatbotResponse, saveConversationToRag } from './route';

// Define routeParams with the correct type structure, as ChatRouteParams might not be directly importable as a value.
interface ChatRouteParamsType { params: { personalityName: string } }


describe('/api/chat/[personalityName] POST', () => {
  let mockRequest: NextRequest;
  const mockPersonalityName = 'TestPersonality';
  const mockUserMessage = 'Hello, bot!';
  
  const routeParams: ChatRouteParamsType = { params: { personalityName: mockPersonalityName } };


  const createMockRequest = (body: any | null) => {
    return {
      json: jest.fn().mockResolvedValue(body),
      headers: new Headers({ 'Content-Type': 'application/json' }),
    } as unknown as NextRequest;
  };


  beforeEach(() => {
    mockRetrieveFromRagDatabase.mockClear();
    mockGenerateChatbotResponse.mockClear();
    mockSaveConversationToRag.mockClear();

    mockRetrieveFromRagDatabase.mockResolvedValue(['mocked context1', 'mocked context2']);
    mockGenerateChatbotResponse.mockResolvedValue('Mocked bot response.');
    mockSaveConversationToRag.mockResolvedValue({ success: true, message: 'Saved successfully' });
  });

  it('should return 200 and expected JSON on valid request', async () => {
    mockRequest = createMockRequest({ userMessage: mockUserMessage });
    const response = await POST(mockRequest, routeParams);
    const responseBody = await response.json();

    expect(response.status).toBe(200);
    expect(responseBody).toEqual({
      personality: mockPersonalityName,
      response: 'Mocked bot response.',
      retrievedContext: ['mocked context1', 'mocked context2'],
    });
  });

  it('should call retrieveFromRagDatabase with personalityName and userMessage', async () => {
    mockRequest = createMockRequest({ userMessage: mockUserMessage });
    await POST(mockRequest, routeParams);
    expect(mockRetrieveFromRagDatabase).toHaveBeenCalledWith(mockPersonalityName, mockUserMessage);
  });

  it('should call generateChatbotResponse with correct parameters', async () => {
    mockRetrieveFromRagDatabase.mockResolvedValue(['specific context']);
    mockRequest = createMockRequest({ userMessage: mockUserMessage });
    await POST(mockRequest, routeParams);
    expect(mockGenerateChatbotResponse).toHaveBeenCalledWith(mockPersonalityName, mockUserMessage, ['specific context']);
  });

  it('should call saveConversationToRag with correct parameters', async () => {
    mockGenerateChatbotResponse.mockResolvedValue('Specific reply');
    mockRequest = createMockRequest({ userMessage: mockUserMessage });
    await POST(mockRequest, routeParams);
    expect(mockSaveConversationToRag).toHaveBeenCalledWith(mockPersonalityName, mockUserMessage, 'Specific reply');
  });

  it('should return 400 if userMessage is missing or empty', async () => {
    const cases = [{}, { userMessage: '' }];
    for (const body of cases) {
      mockRequest = createMockRequest(body);
      const response = await POST(mockRequest, routeParams);
      const responseBody = await response.json();
      expect(response.status).toBe(400);
      expect(responseBody).toEqual({ error: 'userMessage is required in the request body' });
    }
  });

  it('should return 500 if retrieveFromRagDatabase throws', async () => {
    mockRetrieveFromRagDatabase.mockRejectedValue(new Error('RAG DB failed'));
    mockRequest = createMockRequest({ userMessage: mockUserMessage });
    const response = await POST(mockRequest, routeParams);
    const responseBody = await response.json();
    expect(response.status).toBe(500);
    expect(responseBody).toEqual({ error: 'Internal server error', details: 'RAG DB failed' });
  });

  it('should return 500 if generateChatbotResponse throws', async () => {
    mockGenerateChatbotResponse.mockRejectedValue(new Error('LLM failed'));
    mockRequest = createMockRequest({ userMessage: mockUserMessage });
    const response = await POST(mockRequest, routeParams);
    const responseBody = await response.json();
    expect(response.status).toBe(500);
    expect(responseBody).toEqual({ error: 'Internal server error', details: 'LLM failed' });
  });

  it('should return 200 and log error if saveConversationToRag returns success: false', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockSaveConversationToRag.mockResolvedValue({ success: false, message: 'RAG save error' });
    mockRequest = createMockRequest({ userMessage: mockUserMessage });
    const response = await POST(mockRequest, routeParams);
    await response.json(); 

    expect(response.status).toBe(200);
    expect(mockSaveConversationToRag).toHaveBeenCalled();
    await new Promise(process.nextTick); 
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('RAG Save Failed for TestPersonality: RAG save error'));
    consoleErrorSpy.mockRestore();
  });

  it('should return 200 and log error if saveConversationToRag throws', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockSaveConversationToRag.mockRejectedValue(new Error('Async RAG save exception'));
    mockRequest = createMockRequest({ userMessage: mockUserMessage });
    const response = await POST(mockRequest, routeParams);
    await response.json();

    expect(response.status).toBe(200);
    expect(mockSaveConversationToRag).toHaveBeenCalled();
    await new Promise(process.nextTick);
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining('Error during RAG save for TestPersonality'), expect.any(Error));
    consoleErrorSpy.mockRestore();
  });
  
  it('should return 400 if personalityName is missing from route params (simulated)', async () => {
    mockRequest = createMockRequest({ userMessage: mockUserMessage });
    const malformedRouteParams = { params: {} } as ChatRouteParamsType; 
    
    const response = await POST(mockRequest, malformedRouteParams);
    const responseBody = await response.json();

    expect(response.status).toBe(400);
    expect(responseBody).toEqual({ error: 'personalityName route parameter is required' });
  });

  it('should return 500 if request body parsing fails', async () => {
     const req = {
      json: jest.fn().mockRejectedValue(new Error("Failed to parse JSON")),
      headers: new Headers({'Content-Type': 'application/json'}),
    } as unknown as NextRequest;
    
    const response = await POST(req, routeParams);
    const responseBody = await response.json();

    expect(response.status).toBe(500);
    expect(responseBody).toEqual({ error: 'Internal server error', details: 'Failed to parse JSON' });
  });
});
