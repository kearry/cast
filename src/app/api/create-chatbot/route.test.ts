import { NextRequest, NextResponse } from 'next/server';
import { describe, expect, jest, it, beforeEach } from '@jest/globals';

// Define an interface for the expected body of the request
interface CreateChatbotRequestBody {
  personalityName: string;
}

// If RagDocument is a TypeScript type/interface, it will be imported later.
// The specific 'ActualRagDocumentType' alias import has been removed as it was unused.

// Define an interface for the expected module structure (runtime values)
interface ActualRouteModule {
  POST: (req: NextRequest) => Promise<NextResponse>;
  performDeepSearch: (
    personalityName: string
  ) => Promise<string[]>;
  addToRagDatabase: (
    personalityName: string,
    searchResults: string[]
  ) => Promise<{ success: boolean; documentsAdded: number; error?: string }>;
}

// Step 1: Import the parts of the module we want to keep REAL.
const actualModule = jest.requireActual('./route') as ActualRouteModule;
const { POST: actualPOSTHandler } = actualModule;


// Step 2: Define our jest.fn() mocks with explicit types
const mockPerformDeepSearch = jest.fn<
  (personalityName: string) => Promise<string[]>
>();
const mockAddToRagDatabase = jest.fn<
  (
    personalityName: string,
    searchResults: string[]
  ) => Promise<{ success: boolean; documentsAdded: number; error?: string }>
>();

// Step 3: Mock the module.
jest.mock('./route', () => ({
  __esModule: true,
  POST: actualPOSTHandler,
  performDeepSearch: mockPerformDeepSearch,
  addToRagDatabase: mockAddToRagDatabase,
}));

// Step 4: Import from './route' AFTER jest.mock.
// RagDocument here would be the TypeScript type/interface if it's not a value,
// or the mocked value if it were mocked as a value.
/* eslint-disable @typescript-eslint/no-unused-vars */
import { POST, performDeepSearch, addToRagDatabase, RagDocument } from './route';
/* eslint-enable @typescript-eslint/no-unused-vars */


describe('/api/create-chatbot POST', () => {
  // ... rest of your test code from the previous version remains the same
  let mockRequest: NextRequest;

  beforeEach(() => {
    mockPerformDeepSearch.mockClear();
    mockAddToRagDatabase.mockClear();

    mockPerformDeepSearch.mockResolvedValue(['mocked search result1', 'mocked search result2']);
    mockAddToRagDatabase.mockResolvedValue({ success: true, documentsAdded: 2 });
  });

  const createMockRequest = (body: Partial<CreateChatbotRequestBody> | null) => {
    const mockJson = jest.fn<() => Promise<Partial<CreateChatbotRequestBody> | null>>()
      .mockResolvedValue(body);
    return {
      json: mockJson,
      headers: new Headers({ 'Content-Type': 'application/json' }),
    } as unknown as NextRequest;
  };

  it('should return 200 and expected JSON on valid personalityName', async () => {
    mockRequest = createMockRequest({ personalityName: 'Test Bot' });
    const response = await POST(mockRequest);
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
      mockRequest = createMockRequest(body as Partial<CreateChatbotRequestBody>);
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
    mockAddToRagDatabase.mockResolvedValue({ success: false, documentsAdded: 0, error: 'DB save error' });
    mockRequest = createMockRequest({ personalityName: 'Test Bot' });
    const response = await POST(mockRequest);
    const responseBody = await response.json();
    expect(response.status).toBe(500);
    expect(responseBody).toEqual({ error: 'Failed to add documents to RAG database', details: 'DB save error' });
  });

  it('should return 500 if request body parsing fails', async () => {
    const req = {
      json: jest.fn<() => Promise<Partial<CreateChatbotRequestBody> | null>>()
        .mockRejectedValue(new Error("Failed to parse JSON")),
      headers: new Headers({ 'Content-Type': 'application/json' }),
    } as unknown as NextRequest;

    const response = await POST(req);
    const responseBody = await response.json();

    expect(response.status).toBe(500);
    expect(responseBody).toEqual({ error: 'Internal server error during chatbot creation process', details: 'Failed to parse JSON' });
  });
});