'use client';
import { useState, useEffect } from 'react';
import axios from 'axios';

// Defaults can be overridden via environment variables
const DEFAULT_HOST_VOICE = process.env.NEXT_PUBLIC_HOST_DEFAULT_VOICE || 'Kore';
const DEFAULT_GUEST_VOICE = process.env.NEXT_PUBLIC_GUEST_DEFAULT_VOICE || 'Puck';
const DEFAULT_SPEAKER3_VOICE = process.env.NEXT_PUBLIC_SPEAKER3_DEFAULT_VOICE || 'Charon';
const DEFAULT_SPEAKER4_VOICE = process.env.NEXT_PUBLIC_SPEAKER4_DEFAULT_VOICE || 'Aoede';

const DEFAULT_HOST_TONE =
  process.env.NEXT_PUBLIC_HOST_DEFAULT_TONE || 'Speak in a clear, professional tone.';
const DEFAULT_GUEST_TONE =
  process.env.NEXT_PUBLIC_GUEST_DEFAULT_TONE || 'Speak in a natural, conversational tone.';
const DEFAULT_SPEAKER3_TONE = process.env.NEXT_PUBLIC_SPEAKER3_DEFAULT_TONE || '';
const DEFAULT_SPEAKER4_TONE = process.env.NEXT_PUBLIC_SPEAKER4_DEFAULT_TONE || '';

// Default speaker names can be overridden via environment variables
const DEFAULT_HOST_NAME = process.env.NEXT_PUBLIC_HOST_DEFAULT_NAME || 'Samantha';
const DEFAULT_GUEST1_NAME = process.env.NEXT_PUBLIC_GUEST_DEFAULT_NAME || 'Michael';
const DEFAULT_GUEST2_NAME = process.env.NEXT_PUBLIC_SPEAKER3_DEFAULT_NAME || 'Patrick';
const DEFAULT_GUEST3_NAME = process.env.NEXT_PUBLIC_SPEAKER4_DEFAULT_NAME || 'Danny';

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
  { id: 'Callirrhoe', name: 'Callirrhoe (Easy-going)' },
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
  { id: 'Sulafat', name: 'Sulafat (Warm)' }
];

// Parse a script into dialogues (client-side version of server logic)
function parseScript(script: string): { speaker: string; text: string }[] {
  const dialogues: { speaker: string; text: string }[] = [];
  const lines = script.split('\n');

  let currentSpeaker = '';
  let currentText = '';

  // Improved regex to handle various script formats
  const speakerRegex = /^\s*(?:\*\*)?([^:[\]()]+)(?:\*\*)?\s*:\s*(.*)$/;
  // Alternative regex for bracket format: [Speaker] Text (requires text after bracket)
  const bracketRegex = /^\s*\[([^\]]+)\]\s+(.+)$/;

  for (const line of lines) {
    // Skip empty lines
    if (!line.trim()) continue;

    // Try different speaker formats
    const matchColon = line.match(speakerRegex);
    const matchBracket = line.match(bracketRegex);
    const match = matchColon || matchBracket;

    if (match) {
      const candidateSpeaker = match[1].trim();
      const candidateText = match[2].trim();
      const startsWithNumber = /^[0-9£$]/.test(candidateText);
      const isLikelySpeaker =
        candidateText.length > 0 &&
        candidateSpeaker.split(/\s+/).length <= 3 &&
        !startsWithNumber;

      if (isLikelySpeaker) {
        if (currentSpeaker) {
          dialogues.push({ speaker: currentSpeaker.trim(), text: currentText.trim() });
        }
        currentSpeaker = candidateSpeaker;
        currentText = candidateText;
        continue;
      }
    }

    if (currentSpeaker) {
      // This is a continuation of the current dialogue
      const trimmed = line.trim();
      const isStageDirection =
        (trimmed.startsWith('(') && trimmed.endsWith(')')) ||
        (trimmed.startsWith('[') && trimmed.endsWith(']'));

      if (isStageDirection) {
        // For stage directions, add them inline
        currentText += ' ' + line.trim();
      } else {
        // For regular text continuation, preserve paragraphs with spaces
        currentText += (currentText ? ' ' : '') + line.trim();
      }
    } else {
      // If there's no current speaker but we have text, treat it as narrator
      currentSpeaker = 'Narrator';
      currentText = line.trim();
    }
  }

  // Add the last dialogue if there is one
  if (currentSpeaker) {
    dialogues.push({ speaker: currentSpeaker.trim(), text: currentText.trim() });
  }

  // If no dialogues were found, create one with the entire script as narrator
  if (dialogues.length === 0 && script.trim()) {
    dialogues.push({ speaker: 'Narrator', text: script.trim() });
  }

  return dialogues;
}


export default function Home() {
  const [script, setScript] = useState('');
  const [audioPath, setAudioPath] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processingStep, setProcessingStep] = useState<string | null>(null);
  const [exampleShown, setExampleShown] = useState(false);

  // Shared settings for tone/style (used differently by each engine)
  const [hostTone, setHostTone] = useState(DEFAULT_HOST_TONE);
  const [guestTone, setGuestTone] = useState(DEFAULT_GUEST_TONE);

  // Gemini settings
  const [geminiHostVoice, setGeminiHostVoice] = useState(DEFAULT_HOST_VOICE);
  const [geminiGuestVoice, setGeminiGuestVoice] = useState(DEFAULT_GUEST_VOICE);
  const [extraSpeakers, setExtraSpeakers] = useState<{ name: string; voice: string; tone: string }[]>([]);

  const [hostName, setHostName] = useState(DEFAULT_HOST_NAME);
  const [guestName, setGuestName] = useState(DEFAULT_GUEST1_NAME);

  // Number of speakers (1-4)
  const [numSpeakers, setNumSpeakers] = useState<number>(2);

  useEffect(() => {
    setExtraSpeakers(prev => {
      const needed = Math.max(0, numSpeakers - 2);
      const updated = [...prev];
      if (updated.length < needed) {
        const defaults = [
          { name: DEFAULT_GUEST2_NAME, voice: DEFAULT_SPEAKER3_VOICE, tone: DEFAULT_SPEAKER3_TONE },
          { name: DEFAULT_GUEST3_NAME, voice: DEFAULT_SPEAKER4_VOICE, tone: DEFAULT_SPEAKER4_TONE }
        ];
        for (let i = updated.length; i < needed; i++) {
          updated.push(defaults[i] || { name: `speaker${i + 3}`, voice: GEMINI_VOICES[0].id, tone: '' });
        }
      } else if (updated.length > needed) {
        updated.splice(needed);
      }
      return updated;
    });
  }, [numSpeakers]);

  // Auto-detect speakers from the script and update fields
  useEffect(() => {
    if (!script.trim()) return;

    const dialogues = parseScript(script);
    const uniqueNames = Array.from(new Set(dialogues.map(d => d.speaker.trim()))).slice(0, 4);
    if (uniqueNames.length === 0) return;

    setHostName(uniqueNames[0] || DEFAULT_HOST_NAME);
    if (uniqueNames.length > 1) setGuestName(uniqueNames[1]);

    const extras = uniqueNames.slice(2).map((name, idx) => ({
      name,
      voice: extraSpeakers[idx]?.voice || (idx === 0 ? DEFAULT_SPEAKER3_VOICE : DEFAULT_SPEAKER4_VOICE),
      tone: extraSpeakers[idx]?.tone || (idx === 0 ? DEFAULT_SPEAKER3_TONE : DEFAULT_SPEAKER4_TONE),
    }));

    setExtraSpeakers(extras);
    setNumSpeakers(uniqueNames.length);
  }, [script]);

  const updateExtraSpeaker = (
    index: number,
    field: 'voice' | 'tone' | 'name',
    value: string
  ) => {
    setExtraSpeakers(prev => {
      const updated = [...prev];
      if (updated[index]) {
        updated[index] = { ...updated[index], [field]: value };
      }
      return updated;
    });
  };

  // Get current voice options (Gemini only)
  const getCurrentVoices = () => GEMINI_VOICES;

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

      setProcessingStep('Generating audio with Google Gemini Multi-Speaker TTS...');
      const enhancedScript = dialogues.map(d => `${d.speaker}: ${d.text}`).join('\n');

      // Build speaker configuration arrays
      const speakerVoices = [
        geminiHostVoice,
        geminiGuestVoice,
        ...extraSpeakers.map((s) => s.voice),
      ].slice(0, numSpeakers);

      const speakerTones = [
        hostTone,
        guestTone,
        ...extraSpeakers.map((s) => s.tone),
      ].slice(0, numSpeakers);

      const speakerNames = [
        hostName,
        guestName,
        ...extraSpeakers.map((s) => s.name),
      ].slice(0, numSpeakers);

      // Prepare request data based on TTS engine
      const requestData: any = {
        text: enhancedScript,
        speakerVoices,
        speakerTones,
        speakerNames,
        // Keep legacy fields for backward compatibility
        geminiHostVoice: speakerVoices[0],
        geminiGuestVoice: speakerVoices[1] || geminiGuestVoice,
        hostTone: speakerTones[0],
        guestTone: speakerTones[1] || guestTone,
        numSpeakers,
      };

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
          <div className="flex gap-4">
            <a href="/voices" className="text-blue-600 hover:text-blue-800 visited:text-purple-600">
              Voice Demos
            </a>
            <a href="/chatbot" className="text-blue-600 hover:text-blue-800 visited:text-purple-600">
              Try Chatbot
            </a>
          </div>
        </div>
        <p className="text-gray-500 mb-6">Generate podcasts using Google&apos;s Gemini 2.5 Multi-Speaker TTS</p>

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



        {/* Number of Speakers */}
        <div>
          <label htmlFor="numSpeakers" className="block text-sm font-medium text-gray-700 mb-1">
            Number of Speakers
          </label>
          <input
            id="numSpeakers"
            type="number"
            min={1}
            max={4}
            value={numSpeakers}
            onChange={(e) => setNumSpeakers(Number(e.target.value))}
            className="w-24 px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>

        {/* Voice Configuration */}
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <p className="col-span-2 text-sm text-gray-500">Speakers: {numSpeakers}</p>
{
            [
            {
              name: hostName,
              setName: setHostName,
              voice: geminiHostVoice,
              setVoice: setGeminiHostVoice,
              tone: hostTone,
              setTone: setHostTone,
              label: 'Speaker 1',
            },
            {
              name: guestName,
              setName: setGuestName,
              voice: geminiGuestVoice,
              setVoice: setGeminiGuestVoice,
              tone: guestTone,
              setTone: setGuestTone,
              label: 'Speaker 2',
            },
            ...extraSpeakers.map((s, i) => ({
              name: s.name,
              setName: (n: string) => updateExtraSpeaker(i, 'name', n),
              voice: s.voice,
              setVoice: (v: string) => updateExtraSpeaker(i, 'voice', v),
              tone: s.tone,
              setTone: (t: string) => updateExtraSpeaker(i, 'tone', t),
              label: `Speaker ${i + 3}`,
            })),
          ].slice(0, numSpeakers)
            .map((sp, idx) => (
              <div
                key={idx}
                className="space-y-3 p-4 border border-gray-200 rounded-md"
              >
                <h3 className="font-medium text-gray-800">{sp.label}</h3>
                <div>
                  <label htmlFor={`name-${idx}`} className="block text-sm text-gray-600">
                    Name
                  </label>
                  <input
                    id={`name-${idx}`}
                    type="text"
                    value={sp.name}
                    onChange={(e) => sp.setName(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
                <div>
                  <label
                    htmlFor={`voice-${idx}`}
                    className="block text-sm text-gray-600"
                  >
                    Voice
                  </label>
                  <select
                    id={`voice-${idx}`}
                    value={sp.voice}
                    onChange={(e) => sp.setVoice(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {currentVoices.map((voice) => (
                      <option key={`${idx}-${voice.id}`} value={voice.id}>
                        {voice.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    htmlFor={`tone-${idx}`}
                    className="block text-sm text-gray-600"
                  >
                    {sp.label.replace('Voice', 'Style Instructions')}
                  </label>
                  <textarea
                    id={`tone-${idx}`}
                    value={sp.tone}
                    onChange={(e) => sp.setTone(e.target.value)}
                    className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="e.g. professional, casual"
                    rows={2}
                  />
                  <p className="mt-1 text-xs text-gray-500">
                    How should this speaker sound?
                  </p>
                </div>
              </div>
            ))}
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
            <p className="mt-2 text-sm">
              Note: Gemini 2.5 TTS is in preview. Ensure you have access to the Gemini API and the TTS models.
            </p>
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
            <li><strong>Gemini TTS:</strong> Processes two speakers per request. The server splits multi-speaker scripts into multiple segments and merges the audio.</li>
            <li>Use individual style/tone instructions to control how each speaker sounds (professional vs casual, excited vs calm, etc.).</li>
          </ul>
        </div>

        <div className="mt-6 text-sm text-gray-500">
          <p>Using Google Gemini 2.5 Flash Preview TTS with 30 voices and 24 languages.</p>
        </div>
      </div>
    </div>
  );
}