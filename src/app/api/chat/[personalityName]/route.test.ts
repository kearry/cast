import { NextRequest } from 'next/server'; // Assuming NextResponse might be used or relevant for Response type
import { describe, expect, it, beforeEach, jest } from '@jest/globals';

// Define an interface for your actual module's exports if needed for casting requireActual
// This helps TypeScript understand the shape of the module you're partially mocking.
interface RouteModule {
  POST: (request: NextRequest, params: ChatRouteParamsType) => Promise<Response>;
  retrieveFromRagDatabase: (personalityName: string, userMessage: string) => Promise<string[]>;
  generateChatbotResponse: (personalityName: string, userMessage: string, context: string[]) => Promise<string>;
  saveConversationToRag: (personalityName: string, userMessage: string, botResponse: string) => Promise<{ success: boolean; message: string }>;
  // Add other exports if they exist and are relevant
}

// Step 1: Import the parts of the module we want to keep REAL.
// Cast to your defined RouteModule type for better type safety.
const { POST: actualPOSTHandler } = jest.requireActual('./route') as RouteModule;

// Step 2: Define our jest.fn() mocks with explicit return types for mocked functions.
const mockRetrieveFromRagDatabase = jest.fn<
  (personalityName: string, userMessage: string) => Promise<string[]>
>();
const mockGenerateChatbotResponse = jest.fn<
  (personalityName: string, userMessage: string, context: string[]) => Promise<string>
>();
const mockSaveConversationToRag = jest.fn<
  (personalityName: string, userMessage: string, botResponse: string) => Promise<{ success: boolean; message: string }>
>();

// Step 3: Mock the module.
jest.mock('./route', () => ({
  __esModule: true, // Important for ES modules
  POST: actualPOSTHandler, // Use the real POST handler
  retrieveFromRagDatabase: mockRetrieveFromRagDatabase, // Use our mock
  generateChatbotResponse: mockGenerateChatbotResponse, // Use our mock
  saveConversationToRag: mockSaveConversationToRag,     // Use our mock
}));

// Step 4: Import from './route' AFTER jest.mock.
// Only import what's needed. POST will be the actual handler.
// The other functions (retrieveFromRagDatabase, etc.) are mocked and accessed
// via the mockRetrieveFromRagDatabase (etc.) variables defined above.
import { POST } from './route';

// Define routeParams with the correct type structure.
interface ChatRouteParamsType { params: { personalityName: string } }

// Define a type for the expected request body.
interface MockRequestBody {
  userMessage?: string; // userMessage is optional for some test cases
}

describe('/api/chat/[personalityName] POST', () => {
  let mockRequest: NextRequest;
  const mockPersonalityName = 'TestPersonality';
  const mockUserMessage = 'Hello, bot!';

  const routeParams: ChatRouteParamsType = { params: { personalityName: mockPersonalityName } };

  // Helper function to create mock NextRequest objects
  const createMockRequest = (body: MockRequestBody | null) => {
    return {
      json: jest.fn<() => Promise<MockRequestBody | null>>().mockResolvedValue(body),
      headers: new Headers({ 'Content-Type': 'application/json' }),
      // Add any other NextRequest properties your POST handler might use
    } as unknown as NextRequest;
  };

  beforeEach(() => {
    // Clear mocks before each test
    mockRetrieveFromRagDatabase.mockClear();
    mockGenerateChatbotResponse.mockClear();
    mockSaveConversationToRag.mockClear();

    // Reset mocks to default resolved values
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
    const specificContext = ['specific context'];
    mockRetrieveFromRagDatabase.mockResolvedValue(specificContext);
    mockRequest = createMockRequest({ userMessage: mockUserMessage });

    await POST(mockRequest, routeParams);

    expect(mockGenerateChatbotResponse).toHaveBeenCalledWith(mockPersonalityName, mockUserMessage, specificContext);
  });

  it('should call saveConversationToRag with correct parameters', async () => {
    const specificReply = 'Specific reply';
    mockGenerateChatbotResponse.mockResolvedValue(specificReply);
    mockRequest = createMockRequest({ userMessage: mockUserMessage });

    await POST(mockRequest, routeParams);

    expect(mockSaveConversationToRag).toHaveBeenCalledWith(mockPersonalityName, mockUserMessage, specificReply);
  });

  it('should return 400 if userMessage is missing or empty', async () => {
    const cases: MockRequestBody[] = [{}, { userMessage: '' }]; // {} is a valid MockRequestBody
    for (const body of cases) {
      mockRequest = createMockRequest(body);
      const response = await POST(mockRequest, routeParams);
      const responseBody = await response.json();
      expect(response.status).toBe(400);
      expect(responseBody).toEqual({ error: 'userMessage is required in the request body' });
    }
  });

  it('should return 500 if retrieveFromRagDatabase throws', async () => {
    const errorMessage = 'RAG DB failed';
    mockRetrieveFromRagDatabase.mockRejectedValue(new Error(errorMessage));
    mockRequest = createMockRequest({ userMessage: mockUserMessage });

    const response = await POST(mockRequest, routeParams);
    const responseBody = await response.json();

    expect(response.status).toBe(500);
    expect(responseBody).toEqual({ error: 'Internal server error', details: errorMessage });
  });

  it('should return 500 if generateChatbotResponse throws', async () => {
    const errorMessage = 'LLM failed';
    mockGenerateChatbotResponse.mockRejectedValue(new Error(errorMessage));
    mockRequest = createMockRequest({ userMessage: mockUserMessage });

    const response = await POST(mockRequest, routeParams);
    const responseBody = await response.json();

    expect(response.status).toBe(500);
    expect(responseBody).toEqual({ error: 'Internal server error', details: errorMessage });
  });

  it('should return 200 and log error if saveConversationToRag returns success: false', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
    const saveErrorMessage = 'RAG save error';
    mockSaveConversationToRag.mockResolvedValue({ success: false, message: saveErrorMessage });
    mockRequest = createMockRequest({ userMessage: mockUserMessage });

    const response = await POST(mockRequest, routeParams);
    await response.json(); // Consume the response body to ensure all async operations complete

    expect(response.status).toBe(200); // Assuming the main flow completes successfully despite save error
    expect(mockSaveConversationToRag).toHaveBeenCalled();
    // Wait for any microtasks (like async logging) to complete
    await new Promise(process.nextTick);
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining(`RAG Save Failed for ${mockPersonalityName}: ${saveErrorMessage}`));

    consoleErrorSpy.mockRestore();
  });

  it('should return 200 and log error if saveConversationToRag throws', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => { });
    const asyncSaveExceptionMessage = 'Async RAG save exception';
    mockSaveConversationToRag.mockRejectedValue(new Error(asyncSaveExceptionMessage));
    mockRequest = createMockRequest({ userMessage: mockUserMessage });

    const response = await POST(mockRequest, routeParams);
    await response.json(); // Consume body

    expect(response.status).toBe(200);
    expect(mockSaveConversationToRag).toHaveBeenCalled();
    await new Promise(process.nextTick);
    expect(consoleErrorSpy).toHaveBeenCalledWith(expect.stringContaining(`Error during RAG save for ${mockPersonalityName}`), expect.any(Error));

    consoleErrorSpy.mockRestore();
  });

  it('should return 400 if personalityName is missing from route params (simulated)', async () => {
    mockRequest = createMockRequest({ userMessage: mockUserMessage });
    // Use 'as unknown as Type' for intentionally malformed data for testing
    const malformedRouteParams = { params: {} } as unknown as ChatRouteParamsType;

    const response = await POST(mockRequest, malformedRouteParams);
    const responseBody = await response.json();

    expect(response.status).toBe(400);
    expect(responseBody).toEqual({ error: 'personalityName route parameter is required' });
  });

  it('should return 500 if request body parsing fails', async () => {
    const parseErrorMessage = "Failed to parse JSON";
    const req = {
      json: jest.fn<() => Promise<MockRequestBody | null>>().mockRejectedValue(new Error(parseErrorMessage)),
      headers: new Headers({ 'Content-Type': 'application/json' }),
    } as unknown as NextRequest;

    const response = await POST(req, routeParams);
    const responseBody = await response.json();

    expect(response.status).toBe(500);
    expect(responseBody).toEqual({ error: 'Internal server error', details: parseErrorMessage });
  });
});