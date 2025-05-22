'use client';

import { useState, useEffect } from 'react';

interface ConversationEntry {
  speaker: 'user' | 'bot';
  text: string;
}

const LOCAL_STORAGE_KEY = 'chatPersonalityNames';
const DEFAULT_PERSONALITIES = ['Albert Einstein', 'Cleopatra', 'Shakespeare'];

export default function ChatbotPage() {
  const [personalityName, setPersonalityName] = useState<string>('');
  const [currentMessage, setCurrentMessage] = useState<string>('');
  const [conversationHistory, setConversationHistory] = useState<ConversationEntry[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const [availableChatbots, setAvailableChatbots] = useState<string[]>([]);
  const [newPersonalityToCreate, setNewPersonalityToCreate] = useState<string>('');
  const [isCreatingBot, setIsCreatingBot] = useState<boolean>(false);
  const [createBotError, setCreateBotError] = useState<string | null>(null);

  // Load available chatbots from localStorage on mount
  useEffect(() => {
    const storedPersonalities = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (storedPersonalities) {
      const parsedPersonalities = JSON.parse(storedPersonalities);
      setAvailableChatbots(parsedPersonalities);
      if (parsedPersonalities.length > 0) {
        setPersonalityName(parsedPersonalities[0]); // Set default selected personality
      }
    } else {
      setAvailableChatbots(DEFAULT_PERSONALITIES);
      localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(DEFAULT_PERSONALITIES));
      if (DEFAULT_PERSONALITIES.length > 0) {
        setPersonalityName(DEFAULT_PERSONALITIES[0]);
      }
    }
  }, []);

  const handleChatSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!personalityName.trim() || !currentMessage.trim()) {
      setError('Personality Name and User Message cannot be empty.');
      return;
    }
    setError(null);
    setIsLoading(true);

    const userEntry: ConversationEntry = { speaker: 'user', text: currentMessage };
    setConversationHistory(prev => [...prev, userEntry]);

    try {
      const response = await fetch(`/api/chat/${encodeURIComponent(personalityName)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userMessage: currentMessage }),
      });

      setCurrentMessage(''); 

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API request failed with status ${response.status}`);
      }

      const data = await response.json();
      const botEntry: ConversationEntry = { speaker: 'bot', text: data.response };
      setConversationHistory(prev => [...prev, botEntry]);

    } catch (err: any) {
      setError(err.message || 'Failed to get response from chatbot.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateChatbot = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newPersonalityToCreate.trim()) {
      setCreateBotError('New personality name cannot be empty.');
      return;
    }
    setCreateBotError(null);
    setIsCreatingBot(true);

    try {
      const response = await fetch('/api/create-chatbot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ personalityName: newPersonalityToCreate }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `API request failed with status ${response.status}`);
      }

      // const data = await response.json(); // Contains { message, searchResults, documentsAddedToRag }
      // console.log('Chatbot creation API success:', data.message);

      setAvailableChatbots(prev => {
        const updatedBots = [...prev, newPersonalityToCreate];
        localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(updatedBots));
        return updatedBots;
      });
      setPersonalityName(newPersonalityToCreate); // Select the new bot
      setNewPersonalityToCreate(''); // Clear input

    } catch (err: any) {
      setCreateBotError(err.message || 'Failed to create chatbot.');
    } finally {
      setIsCreatingBot(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center p-4">
      <header className="w-full max-w-4xl mb-8">
        <h1 className="text-4xl font-bold text-center text-purple-400">Chat with a Personality</h1>
      </header>

      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Left Column: Create and Select Chatbot */}
        <aside className="md:col-span-1 bg-gray-800 shadow-xl rounded-lg p-6 space-y-6 h-fit">
          <div>
            <h2 className="text-xl font-semibold text-purple-300 mb-3">Create New Chatbot</h2>
            <form onSubmit={handleCreateChatbot} className="space-y-3">
              <input
                type="text"
                value={newPersonalityToCreate}
                onChange={(e) => setNewPersonalityToCreate(e.target.value)}
                placeholder="Enter new personality name"
                className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm text-white"
              />
              <button
                type="submit"
                disabled={isCreatingBot || !newPersonalityToCreate.trim()}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50"
              >
                {isCreatingBot ? 'Creating...' : 'Create & Add'}
              </button>
              {createBotError && <p className="text-red-400 text-sm mt-1">{createBotError}</p>}
            </form>
          </div>
          <div>
            <label htmlFor="personalityNameSelect" className="block text-sm font-medium text-gray-300 mb-1">
              Select Personality
            </label>
            <select
              id="personalityNameSelect"
              value={personalityName}
              onChange={(e) => {
                setPersonalityName(e.target.value);
                setConversationHistory([]); // Clear history when changing personality
                setError(null); // Clear errors
              }}
              className="mt-1 block w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm text-white"
            >
              {availableChatbots.length === 0 && <option disabled>No personalities available</option>}
              {availableChatbots.map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </div>
        </aside>

        {/* Right Column: Chat Interface */}
        <main className="md:col-span-2 bg-gray-800 shadow-xl rounded-lg p-6">
          <form onSubmit={handleChatSubmit} className="space-y-4">
            <div>
              <label htmlFor="userMessage" className="block text-sm font-medium text-gray-300">
                Your Message (to <span className="font-semibold text-purple-300">{personalityName || "selected personality"}</span>)
              </label>
              <textarea
                id="userMessage"
                rows={3}
                value={currentMessage}
                onChange={(e) => setCurrentMessage(e.target.value)}
                className="mt-1 block w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md shadow-sm focus:outline-none focus:ring-purple-500 focus:border-purple-500 sm:text-sm text-white"
                placeholder="Type your message here..."
                disabled={!personalityName}
              />
            </div>

            <button
              type="submit"
              disabled={isLoading || !personalityName.trim() || !currentMessage.trim()}
              className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-purple-600 hover:bg-purple-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 disabled:opacity-50"
            >
              {isLoading ? 'Sending...' : 'Send Message'}
            </button>
          </form>

          {error && (
            <div className="mt-4 p-3 bg-red-700 border border-red-900 rounded-md text-white">
              <p>Error: {error}</p>
            </div>
          )}

          <div className="mt-6 space-y-4 h-96 overflow-y-auto p-4 bg-gray-700 rounded-md">
            {conversationHistory.length === 0 && (
              <p className="text-gray-400 text-center">
                {personalityName ? `Conversation with ${personalityName} will appear here.` : "Select a personality to begin."}
              </p>
            )}
            {conversationHistory.map((entry, index) => (
              <div
                key={index}
                className={`p-3 rounded-lg max-w-xl ${
                  entry.speaker === 'user' ? 'bg-blue-600 ml-auto' : 'bg-green-600 mr-auto'
                }`}
              >
                <p className="text-sm text-white">
                  <span className="font-semibold capitalize">{entry.speaker}: </span>
                  {entry.text}
                </p>
              </div>
            ))}
          </div>
        </main>
      </div>
    </div>
  );
}
