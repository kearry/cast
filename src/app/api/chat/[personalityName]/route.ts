import { NextResponse } from 'next/server';

// Exporting interface in case it's used by helper tests, though not strictly necessary for this task
export interface ChatRouteParams {
  params: {
    personalityName: string;
  };
}

// Placeholder function to retrieve from RAG database
export async function retrieveFromRagDatabase(personalityName: string, userMessage: string): Promise<string[]> {
  // Simulate DB call delay
  await new Promise(resolve => setTimeout(resolve, 300));
  console.log(`Retrieving context for ${personalityName} based on message: "${userMessage}"`);
  return [
    `Retrieved context chunk 1 for ${personalityName} related to "${userMessage}"`,
    `Retrieved context chunk 2 for ${personalityName} related to "${userMessage}"`,
  ];
}

// Placeholder function to generate chatbot response
export async function generateChatbotResponse(personalityName: string, userMessage: string, context: string[]): Promise<string> {
  // Simulate LLM call delay
  await new Promise(resolve => setTimeout(resolve, 700));
  console.log(`Generating response for ${personalityName} to message: "${userMessage}" with context: ${context.join('; ')}`);
  return `As ${personalityName}, I'm responding to your message "${userMessage}". Based on my knowledge: ${context.join('. ')}.`;
}

// New placeholder function to save conversation turn to RAG
export async function saveConversationToRag(personalityName: string, userMessage: string, botResponse: string): Promise<{ success: boolean; message: string }> {
  // Simulate saving delay
  await new Promise(resolve => setTimeout(resolve, 100));
  const logMessage = `Simulating saving conversation turn for ${personalityName}: User: '${userMessage}', Bot: '${botResponse}' to RAG DB.`;
  console.log(logMessage);
  // In a real scenario, this would involve actual database operations.
  // For now, it always succeeds.
  return { success: true, message: "Conversation turn saved successfully to RAG DB." };
}

export async function POST(request: Request, { params }: ChatRouteParams) {
  try {
    const { personalityName } = params;
    const body = await request.json();
    const { userMessage } = body;

    if (!personalityName) {
      return NextResponse.json({ error: 'personalityName route parameter is required' }, { status: 400 });
    }

    if (!userMessage) {
      return NextResponse.json({ error: 'userMessage is required in the request body' }, { status: 400 });
    }

    // 1. Retrieve context from RAG database
    const retrievedContext = await retrieveFromRagDatabase(personalityName, userMessage);

    // 2. Generate chatbot response using the context
    const chatbotResponse = await generateChatbotResponse(personalityName, userMessage, retrievedContext);

    // 3. Save the conversation turn to RAG (fire-and-forget for now, but log result)
    saveConversationToRag(personalityName, userMessage, chatbotResponse)
      .then(saveResult => {
        if (saveResult.success) {
          console.log(`RAG Save Success for ${personalityName}: ${saveResult.message}`);
        } else {
          console.error(`RAG Save Failed for ${personalityName}: ${saveResult.message}`);
          // Depending on requirements, this could trigger more robust error handling/logging
        }
      })
      .catch(error => {
        console.error(`Error during RAG save for ${personalityName}:`, error);
        // Depending on requirements, this could trigger more robust error handling/logging
      });

    return NextResponse.json({
      personality: personalityName,
      response: chatbotResponse,
      retrievedContext: retrievedContext,
    });

  } catch (error) {
    console.error(`Error in chat endpoint for ${params?.personalityName}:`, error);
    let errorMessage = 'Internal server error during chat processing';
    if (error instanceof Error) {
        errorMessage = error.message;
    }
    return NextResponse.json({ error: 'Internal server error', details: errorMessage }, { status: 500 });
  }
}
