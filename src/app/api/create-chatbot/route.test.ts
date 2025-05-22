import { NextRequest } from 'next/server';

// Step 1: Import the parts of the module we want to keep REAL.
// We need to do this *before* jest.mock runs.
// jest.requireActual ensures we get the original implementations.
const { POST: actualPOSTHandler, RagDocument: ActualRagDocumentInterface } = jest.requireActual('./route');

// Step 2: Define our jest.fn() mocks.
const mockPerformDeepSearch = jest.fn();
const mockAddToRagDatabase = jest.fn();

// Step 3: Mock the module.
// For any function NOT listed here with a mock, its original implementation will be used
// (if it was part of originalModule or if jest.requireActual was used correctly).
// Here, we are explicitly saying what each export from './route' should be in the test environment.
jest.mock('./route', () => ({
  __esModule: true,
  POST: actualPOSTHandler, // Use the real POST handler
  RagDocument: ActualRagDocumentInterface, // Use the real interface (if it's an exported value, not just a type)
  performDeepSearch: mockPerformDeepSearch, // Use our mock for this
  addToRagDatabase: mockAddToRagDatabase,   // Use our mock for this
}));

// Step 4: Import from './route' AFTER jest.mock.
// POST will be the actual POST handler.
// performDeepSearch and addToRagDatabase will be the mocks defined above.
import { POST, performDeepSearch, addToRagDatabase } from './route';


describe('/api/create-chatbot POST', () => {
  let mockRequest: NextRequest;

  beforeEach(() => {
    // Clear the mocks we defined (mockPerformDeepSearch, mockAddToRagDatabase)
    mockPerformDeepSearch.mockClear();
    mockAddToRagDatabase.mockClear();

    // Default mock implementations
    mockPerformDeepSearch.mockResolvedValue(['mocked search result1', 'mocked search result2']);
    mockAddToRagDatabase.mockResolvedValue({ success: true, documentsAdded: 2 });
  });

  const createMockRequest = (body: any | null) => {
    return {
      json: jest.fn().mockResolvedValue(body),
      headers: new Headers({ 'Content-Type': 'application/json' }),
    } as unknown as NextRequest;
  };

  it('should return 200 and expected JSON on valid personalityName', async () => {
    mockRequest = createMockRequest({ personalityName: 'Test Bot' });
    const response = await POST(mockRequest); // Uses actualPOSTHandler
    const responseBody = await response.json();

    expect(response.status).toBe(200);
    expect(responseBody).toEqual({
      message: 'Chatbot creation process initiated for Test Bot',
      searchResults: ['mocked search result1', 'mocked search result2'],
      documentsAddedToRag: 2,
    });
  });

  it('should call performDeepSearch with personalityName', async () => {
    mockRequest = createMockRequest({ personalityName: 'Test Bot' });
    await POST(mockRequest);
    expect(mockPerformDeepSearch).toHaveBeenCalledWith('Test Bot');
  });

  it('should call addToRagDatabase with personalityName and search results', async () => {
    mockPerformDeepSearch.mockResolvedValue(['specific result']);
    mockRequest = createMockRequest({ personalityName: 'Test Bot' });
    await POST(mockRequest);
    expect(mockAddToRagDatabase).toHaveBeenCalledWith('Test Bot', ['specific result']);
  });

  it('should return 400 if personalityName is missing or empty', async () => {
    const cases = [{}, { personalityName: '' }];
    for (const body of cases) {
      mockRequest = createMockRequest(body);
      const response = await POST(mockRequest);
      const responseBody = await response.json();
      expect(response.status).toBe(400);
      expect(responseBody).toEqual({ error: 'personalityName is required' });
    }
  });

  it('should return 500 if performDeepSearch throws', async () => {
    mockPerformDeepSearch.mockRejectedValue(new Error('Search failed'));
    mockRequest = createMockRequest({ personalityName: 'Test Bot' });
    const response = await POST(mockRequest);
    const responseBody = await response.json();
    expect(response.status).toBe(500);
    expect(responseBody).toEqual({ error: 'Internal server error during chatbot creation process', details: 'Search failed' });
  });

  it('should return 500 if addToRagDatabase throws', async () => {
    mockAddToRagDatabase.mockRejectedValue(new Error('DB add failed'));
    mockRequest = createMockRequest({ personalityName: 'Test Bot' });
    const response = await POST(mockRequest);
    const responseBody = await response.json();
    expect(response.status).toBe(500);
    expect(responseBody).toEqual({ error: 'Internal server error during chatbot creation process', details: 'DB add failed' });
  });

  it('should return 500 if addToRagDatabase returns success: false', async () => {
    mockAddToRagDatabase.mockResolvedValue({ success: false, documentsAdded: 0 });
    mockRequest = createMockRequest({ personalityName: 'Test Bot' });
    const response = await POST(mockRequest);
    const responseBody = await response.json();
    expect(response.status).toBe(500);
    expect(responseBody).toEqual({ error: 'Failed to add documents to RAG database' });
  });
  
  it('should return 500 if request body parsing fails', async () => {
     const req = {
      json: jest.fn().mockRejectedValue(new Error("Failed to parse JSON")),
      headers: new Headers({'Content-Type': 'application/json'}),
    } as unknown as NextRequest;
    
    const response = await POST(req); // POST is the actual handler
    const responseBody = await response.json();

    expect(response.status).toBe(500);
    expect(responseBody).toEqual({ error: 'Internal server error during chatbot creation process', details: 'Failed to parse JSON' });
  });
});
