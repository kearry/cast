'use client';
import { useState } from 'react';
import axios from 'axios';

// Voice options for OpenAI TTS
const OPENAI_VOICES = [
  { id: 'alloy', name: 'Alloy (Neutral)' },
  { id: 'ash', name: 'Ash (Male)' },
  { id: 'ballad', name: 'Ballad (Male)' },
  { id: 'coral', name: 'Coral (Female)' },
  { id: 'echo', name: 'Echo (Male)' },
  { id: 'fable', name: 'Fable (Male)' },
  { id: 'nova', name: 'Nova (Female)' },
  { id: 'onyx', name: 'Onyx (Male)' },
  { id: 'sage', name: 'Sage (Male)' },
  { id: 'shimmer', name: 'Shimmer (Female)' }
];

// Real Gemini TTS Voice Options (from official documentation)
const GEMINI_VOICES = [
  { id: 'Zephyr', name: 'Zephyr (Bright)' },
  { id: 'Puck', name: 'Puck (Upbeat)' },
  { id: 'Charon', name: 'Charon (Informative)' },
  { id: 'Kore', name: 'Kore (Firm)' },
  { id: 'Fenrir', name: 'Fenrir (Excitable)' },
  { id: 'Leda', name: 'Leda (Youthful)' },
  { id: 'Orus', name: 'Orus (Firm)' },
  { id: 'Aoede', name: 'Aoede (Breezy)' },
  { id: 'Callirhoe', name: 'Callirhoe (Easy-going)' },
  { id: 'Autonoe', name: 'Autonoe (Bright)' },
  { id: 'Enceladus', name: 'Enceladus (Breathy)' },
  { id: 'Iapetus', name: 'Iapetus (Clear)' },
  { id: 'Umbriel', name: 'Umbriel (Easy-going)' },
  { id: 'Algieba', name: 'Algieba (Smooth)' },
  { id: 'Despina', name: 'Despina (Smooth)' },
  { id: 'Erinome', name: 'Erinome (Clear)' },
  { id: 'Algenib', name: 'Algenib (Gravelly)' },
  { id: 'Rasalgethi', name: 'Rasalgethi (Informative)' },
  { id: 'Laomedeia', name: 'Laomedeia (Upbeat)' },
  { id: 'Achernar', name: 'Achernar (Soft)' },
  { id: 'Alnilam', name: 'Alnilam (Firm)' },
  { id: 'Schedar', name: 'Schedar (Even)' },
  { id: 'Gacrux', name: 'Gacrux (Mature)' },
  { id: 'Pulcherrima', name: 'Pulcherrima (Forward)' },
  { id: 'Achird', name: 'Achird (Friendly)' },
  { id: 'Zubenelgenubi', name: 'Zubenelgenubi (Casual)' },
  { id: 'Vindemiatrix', name: 'Vindemiatrix (Gentle)' },
  { id: 'Sadachbia', name: 'Sadachbia (Lively)' },
  { id: 'Sadaltager', name: 'Sadaltager (Knowledgeable)' },
  { id: 'Sulafar', name: 'Sulafar (Warm)' }
];

// Audio format options (OpenAI only)
const AUDIO_FORMATS = [
  { id: 'mp3', name: 'MP3' },
  { id: 'wav', name: 'WAV' },
  { id: 'opus', name: 'Opus' },
  { id: 'aac', name: 'AAC' },
  { id: 'flac', name: 'FLAC' }
];

// TTS Engine options
const TTS_ENGINES = [
  { id: 'openai', name: 'OpenAI TTS (Individual Control)' },
  { id: 'gemini', name: 'Google Gemini Multi-Speaker TTS (Natural Conversation)' }
];

export default function Home() {
  const [script, setScript] = useState('');
  const [audioPath, setAudioPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processingStep, setProcessingStep] = useState<string | null>(null);
  const [exampleShown, setExampleShown] = useState(false);
  const [audioFormat, setAudioFormat] = useState('mp3');
  const [ttsEngine, setTtsEngine] = useState('openai');

  // OpenAI settings
  const [hostVoice, setHostVoice] = useState('nova');
  const [guestVoice, setGuestVoice] = useState('coral');

  // Shared settings for tone/style (used differently by each engine)
  const [hostTone, setHostTone] = useState('Speak in a clear, professional tone.');
  const [guestTone, setGuestTone] = useState('Speak in a natural, conversational tone.');

  // Gemini settings
  const [geminiHostVoice, setGeminiHostVoice] = useState('Kore');
  const [geminiGuestVoice, setGeminiGuestVoice] = useState('Puck');

  // Get current voice options based on selected TTS engine
  const getCurrentVoices = () => {
    return ttsEngine === 'gemini' ? GEMINI_VOICES : OPENAI_VOICES;
  };

  // Handle TTS engine change
  const handleEngineChange = (newEngine: string) => {
    setTtsEngine(newEngine);
    // Reset voices to defaults for the new engine
    if (newEngine === 'gemini') {
      setGeminiHostVoice('Kore');
      setGeminiGuestVoice('Puck');
      // Reset to style-focused instructions for Gemini
      setHostTone('sound professional and authoritative');
      setGuestTone('sound enthusiastic and knowledgeable');
    } else {
      setHostVoice('nova');
      setGuestVoice('coral');
      // Reset to tone-focused instructions for OpenAI
      setHostTone('Speak in a clear, professional tone.');
      setGuestTone('Speak in a natural, conversational tone.');
    }
  };

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

      setProcessingStep(`Generating audio with ${ttsEngine === 'gemini' ? 'Google Gemini Multi-Speaker TTS' : 'OpenAI TTS'}...`);
      const enhancedScript = dialogues.map(d => `${d.speaker}: ${d.text}`).join('\n');

      // Prepare request data based on TTS engine
      const requestData: any = {
        text: enhancedScript,
        ttsEngine,
        responseFormat: audioFormat
      };

      if (ttsEngine === 'gemini') {
        requestData.geminiHostVoice = geminiHostVoice;
        requestData.geminiGuestVoice = geminiGuestVoice;
        // For Gemini, we reuse hostTone and guestTone for individual speaker styles
        requestData.hostTone = hostTone; // Host style instructions
        requestData.guestTone = guestTone; // Guest style instructions
      } else {
        requestData.hostVoice = hostVoice;
        requestData.hostTone = hostTone;
        requestData.guestVoice = guestVoice;
        requestData.guestTone = guestTone;
      }

      // Generate audio
      const generateAudioResponse = await fetch('/api/generate-audio', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestData),
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

  const currentVoices = getCurrentVoices();

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 md:p-8">
      <div className="max-w-4xl mx-auto bg-white rounded-xl shadow-md overflow-hidden p-6">
        <div className="flex justify-between items-center mb-2">
          <h1 className="text-2xl font-bold text-gray-900">AI Podcast Generator</h1>
          <a href="/chatbot" className="text-blue-600 hover:text-blue-800 visited:text-purple-600">
            Try Chatbot
          </a>
        </div>
        <p className="text-gray-500 mb-6">Generate podcasts using OpenAI TTS or Google&apos;s Gemini 2.5 Multi-Speaker TTS</p>

        <form onSubmit={handleSubmit} className="space-y-6">
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

          {/* TTS Engine Selection */}
          <div>
            <label htmlFor="ttsEngine" className="block text-sm font-medium text-gray-700 mb-1">
              Text-to-Speech Engine
            </label>
            <select
              id="ttsEngine"
              value={ttsEngine}
              onChange={(e) => handleEngineChange(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {TTS_ENGINES.map(engine => (
                <option key={engine.id} value={engine.id}>
                  {engine.name}
                </option>
              ))}
            </select>
            <p className="mt-1 text-sm text-gray-500">
              {ttsEngine === 'gemini'
                ? 'Gemini 2.5 TTS creates natural conversations with up to 2 speakers, 30 voice options, and 24 language support.'
                : 'OpenAI TTS offers individual speaker control with custom tones and multiple audio formats.'
              }
            </p>
          </div>

          {/* Voice Configuration */}
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            {/* Host Voice Settings */}
            <div className="space-y-3 p-4 border border-gray-200 rounded-md">
              <h3 className="font-medium text-gray-800">Host Voice</h3>
              <div>
                <label htmlFor="hostVoice" className="block text-sm text-gray-600">
                  Voice
                </label>
                <select
                  id="hostVoice"
                  value={ttsEngine === 'gemini' ? geminiHostVoice : hostVoice}
                  onChange={(e) => ttsEngine === 'gemini' ? setGeminiHostVoice(e.target.value) : setHostVoice(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {currentVoices.map(voice => (
                    <option key={`host-${voice.id}`} value={voice.id}>
                      {voice.name}
                    </option>
                  ))}
                </select>
              </div>

              {(ttsEngine === 'openai' || ttsEngine === 'gemini') && (
                <div>
                  <label htmlFor="hostTone" className="block text-sm text-gray-600">
                    {ttsEngine === 'gemini' ? 'Host Style Instructions' : 'Speaking Tone'}
                  </label>
                  <textarea
                    id="hostTone"
                    value={hostTone}
                    onChange={(e) => setHostTone(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder={ttsEngine === 'gemini' ? 'sound professional and authoritative' : 'Speak in a clear, professional tone.'}
                    rows={2}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    {ttsEngine === 'gemini'
                      ? 'How should the host speak? (professional, excited, calm, etc.)'
                      : 'Example: "Speak in a cheerful and positive tone."'
                    }
                  </p>
                </div>
              )}
            </div>

            {/* Guest Voice Settings */}
            <div className="space-y-3 p-4 border border-gray-200 rounded-md">
              <h3 className="font-medium text-gray-800">Guest Voice</h3>
              <div>
                <label htmlFor="guestVoice" className="block text-sm text-gray-600">
                  Voice
                </label>
                <select
                  id="guestVoice"
                  value={ttsEngine === 'gemini' ? geminiGuestVoice : guestVoice}
                  onChange={(e) => ttsEngine === 'gemini' ? setGeminiGuestVoice(e.target.value) : setGuestVoice(e.target.value)}
                  className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {currentVoices.map(voice => (
                    <option key={`guest-${voice.id}`} value={voice.id}>
                      {voice.name}
                    </option>
                  ))}
                </select>
              </div>

              {(ttsEngine === 'openai' || ttsEngine === 'gemini') && (
                <div>
                  <label htmlFor="guestTone" className="block text-sm text-gray-600">
                    {ttsEngine === 'gemini' ? 'Guest Style Instructions' : 'Speaking Tone'}
                  </label>
                  <textarea
                    id="guestTone"
                    value={guestTone}
                    onChange={(e) => setGuestTone(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder={ttsEngine === 'gemini' ? 'sound enthusiastic and knowledgeable' : 'Speak in a natural, conversational tone.'}
                    rows={2}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    {ttsEngine === 'gemini'
                      ? 'How should the guest speak? (enthusiastic, thoughtful, casual, etc.)'
                      : 'Example: "Speak enthusiastically with occasional pauses."'
                    }
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Audio Format (OpenAI only) */}
          {ttsEngine === 'openai' && (
            <div>
              <label htmlFor="audioFormat" className="block text-sm font-medium text-gray-700 mb-1">
                Audio Format
              </label>
              <select
                id="audioFormat"
                value={audioFormat}
                onChange={(e) => setAudioFormat(e.target.value)}
                className="w-64 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {AUDIO_FORMATS.map(format => (
                  <option key={format.id} value={format.id}>
                    {format.name}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-sm text-gray-500">
                Gemini TTS outputs WAV format at 24kHz, 16-bit.
              </p>
            </div>
          )}

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
            {ttsEngine === 'gemini' && (
              <p className="mt-2 text-sm">
                Note: Gemini 2.5 TTS is in preview. Ensure you have access to the Gemini API and the TTS models.
              </p>
            )}
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
                Download Audio
              </a>
            </div>
          </div>
        )}

        <div className="mt-8 border-t pt-6">
          <h2 className="text-lg font-medium text-gray-900 mb-2">How to Format Your Script</h2>
          <ul className="list-disc pl-5 space-y-1 text-gray-600">
            <li>Start each line of dialogue with the speaker&apos;s name followed by a colon (e.g., &quot;Host: Hello everyone&quot;).</li>
            <li>For sound effects or actions, use parentheses (e.g., &quot;Host: (laughs) That&apos;s a great point!&quot;).</li>
            <li><strong>Gemini TTS:</strong> Supports up to 2 speakers with natural conversation flow, individual style control, and automatic language detection.</li>
            <li><strong>OpenAI TTS:</strong> Processes each speaker individually with custom tone control and multiple audio formats.</li>
            <li>Use individual style/tone instructions to control how each speaker sounds (professional vs casual, excited vs calm, etc.).</li>
          </ul>
        </div>

        <div className="mt-6 text-sm text-gray-500">
          <p>
            {ttsEngine === 'gemini'
              ? 'Using Google Gemini 2.5 Flash Preview TTS with 30 voices and 24 languages.'
              : 'Using OpenAI gpt-4o-mini-tts model with 10 voice options and 5 audio formats.'
            }
          </p>
        </div>
      </div>
    </div>
  );
}