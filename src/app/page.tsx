'use client';
import { useState } from 'react';
import axios from 'axios';

export default function Home() {
  const [script, setScript] = useState('');
  const [audioPath, setAudioPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hostVoice, setHostVoice] = useState('nova');
  const [guestVoice, setGuestVoice] = useState('alloy');
  const [processingStep, setProcessingStep] = useState<string | null>(null);
  const [exampleShown, setExampleShown] = useState(false);

  const voices = [
    { id: 'nova', name: 'Nova (Female)' },
    { id: 'onyx', name: 'Onyx (Male)' },
    { id: 'shimmer', name: 'Shimmer (Female)' },
    { id: 'alloy', name: 'Alloy (Neutral)' },
    { id: 'echo', name: 'Echo (Male)' }
  ];

  const showExample = () => {
    const exampleScript = `Host: Welcome to our podcast on AI and technology!

Guest: Thanks for having me. I'm excited to discuss these topics.

Host: Today we're exploring the future of AI. What are your thoughts on recent developments?

Guest: (thoughtfully) I believe we're at a turning point. The advances in generative AI over the past year have been remarkable.

Host: That's fascinating. Can you elaborate on the potential impacts?

Guest: Sure! From healthcare diagnostics to creative assistance, these tools are transforming how we work and solve problems.

Host: And what about concerns people might have?

Guest: That's a great point. With any powerful technology, we need thoughtful guardrails and ethical considerations.`;

    setScript(exampleScript);
    setExampleShown(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setAudioPath(null);
    setProcessingStep('Analyzing script...');

    try {
      // Process script
      const response = await axios.post('/api/process-script', { script });
      const dialogues: { speaker: string; text: string }[] = response.data;

      if (!dialogues || dialogues.length === 0) {
        throw new Error('Failed to process script into dialogues');
      }

      setProcessingStep('Generating audio...');
      const enhancedScript = dialogues.map(d => `${d.speaker}: ${d.text}`).join('\n');

      // Generate audio
      const generateAudioResponse = await fetch('/api/generate-audio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          text: enhancedScript,
          hostVoice,
          guestVoice
        }),
      });

      if (!generateAudioResponse.ok) {
        const errorData = await generateAudioResponse.json();
        throw new Error(errorData.error || `Server error: ${generateAudioResponse.status}`);
      }

      const generateAudioData = await generateAudioResponse.json();
      setAudioPath(generateAudioData.audioPath);
      setProcessingStep(null);

    } catch (err: unknown) {
      console.error("Podcast generation error:", err);

      let errorMessage = 'An unexpected error occurred';
      if (err instanceof Error) {
        errorMessage = err.message;
      } else if (axios.isAxiosError(err) && err.response) {
        errorMessage = `Error: ${err.response.data.error || err.message}`;
      }

      setError(errorMessage);
      setProcessingStep(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 md:p-8">
      <div className="max-w-3xl mx-auto bg-white rounded-xl shadow-md overflow-hidden p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-6">Podcast Generator</h1>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="script" className="block text-sm font-medium text-gray-700 mb-1">
              Enter your podcast script
            </label>
            <textarea
              id="script"
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              value={script}
              onChange={(e) => setScript(e.target.value)}
              placeholder="Enter your podcast script with speaker names followed by colons (e.g., 'Host: Hello, welcome to our show!')"
              rows={10}
              required
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="hostVoice" className="block text-sm font-medium text-gray-700 mb-1">
                Host Voice
              </label>
              <select
                id="hostVoice"
                value={hostVoice}
                onChange={(e) => setHostVoice(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {voices.map(voice => (
                  <option key={`host-${voice.id}`} value={voice.id}>
                    {voice.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-sm text-gray-500">
                Used for speakers named &quot;Host&quot;
              </p>
            </div>

            <div>
              <label htmlFor="guestVoice" className="block text-sm font-medium text-gray-700 mb-1">
                Guest Voice
              </label>
              <select
                id="guestVoice"
                value={guestVoice}
                onChange={(e) => setGuestVoice(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {voices.map(voice => (
                  <option key={`guest-${voice.id}`} value={voice.id}>
                    {voice.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-sm text-gray-500">
                Used for speakers named &quot;Guest&quot;
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              type="submit"
              disabled={loading || !script.trim()}
              className="px-4 py-2 bg-blue-600 text-white rounded-md shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              {loading ? 'Generating...' : 'Generate Podcast'}
            </button>

            {!exampleShown && (
              <button
                type="button"
                onClick={showExample}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md shadow-sm hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2"
              >
                Show Example
              </button>
            )}
          </div>
        </form>

        {processingStep && (
          <div className="mt-4 p-3 bg-blue-50 text-blue-700 rounded">
            <div className="flex items-center">
              <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              {processingStep}
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 p-3 bg-red-50 text-red-700 rounded">
            <p className="font-medium">Error</p>
            <p>{error}</p>
          </div>
        )}

        {audioPath && (
          <div className="mt-6 p-4 bg-gray-50 rounded-md">
            <h2 className="text-lg font-medium text-gray-900 mb-2">Your Podcast</h2>
            <audio src={audioPath} controls className="w-full" />
            <div className="mt-2">
              <a
                href={audioPath}
                download
                className="inline-flex items-center px-3 py-1.5 text-sm bg-green-600 text-white rounded hover:bg-green-700"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                Download MP3
              </a>
            </div>
          </div>
        )}

        <div className="mt-8 border-t pt-6">
          <h2 className="text-lg font-medium text-gray-900 mb-2">How to Format Your Script</h2>
          <ul className="list-disc pl-5 space-y-1 text-gray-600">
            <li>Start each line of dialogue with the speaker&apos;s name followed by a colon (e.g., &quot;Host: Hello everyone&quot;).</li>
            <li>For sound effects or actions, use parentheses (e.g., &quot;Host: (laughs) That&apos;s a great point!&quot;).</li>
            <li>Speakers named &quot;Host&quot; will use the Host Voice, and speakers named &quot;Guest&quot; will use the Guest Voice.</li>
            <li>Other speakers will use the Host Voice by default.</li>
            <li>For best results, keep individual dialogue segments short and natural.</li>
          </ul>
        </div>
      </div>
    </div>
  );
}