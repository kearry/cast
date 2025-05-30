// src/app/api/generate-audio/route.ts
import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai';
import { GoogleGenAI } from '@google/genai';

// WAV header creation function for Gemini TTS PCM data
function createWavBuffer(pcmData: Buffer, sampleRate = 24000, channels = 1, bitsPerSample = 16): Buffer {
    const byteRate = sampleRate * channels * bitsPerSample / 8;
    const blockAlign = channels * bitsPerSample / 8;
    const dataSize = pcmData.length;
    const fileSize = 36 + dataSize;

    const header = Buffer.alloc(44);
    let offset = 0;

    // RIFF header
    header.write('RIFF', offset); offset += 4;
    header.writeUInt32LE(fileSize, offset); offset += 4;
    header.write('WAVE', offset); offset += 4;

    // fmt chunk
    header.write('fmt ', offset); offset += 4;
    header.writeUInt32LE(16, offset); offset += 4; // fmt chunk size
    header.writeUInt16LE(1, offset); offset += 2;  // audio format (PCM)
    header.writeUInt16LE(channels, offset); offset += 2;
    header.writeUInt32LE(sampleRate, offset); offset += 4;
    header.writeUInt32LE(byteRate, offset); offset += 4;
    header.writeUInt16LE(blockAlign, offset); offset += 2;
    header.writeUInt16LE(bitsPerSample, offset); offset += 2;

    // data chunk
    header.write('data', offset); offset += 4;
    header.writeUInt32LE(dataSize, offset);

    return Buffer.concat([header, pcmData]);
}

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Initialize Google Gemini client for TTS
const genAI = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY || '' });

// Helper function to get the last generated podcast's timestamp
function getLastTimestamp(): string | null {
    try {
        const generatedPodcastDir = path.join(process.cwd(), 'public', 'generated_podcasts');

        if (!fs.existsSync(generatedPodcastDir)) {
            fs.mkdirSync(generatedPodcastDir, { recursive: true });
            return null;
        }

        const files = fs.readdirSync(generatedPodcastDir);
        const timestamps = files
            .filter(file => file.endsWith('.mp3') || file.endsWith('.wav'))
            .map(file => file.split('_')[0])
            .filter(ts => !isNaN(Number(ts)))
            .sort((a, b) => Number(b) - Number(a));

        return timestamps.length > 0 ? timestamps[0] : null;
    } catch (error) {
        console.error("Error getting last timestamp:", error);
        return null;
    }
}

interface PodcastState {
    script: string;
    audioPath: string;
}

function savePodcastState(state: PodcastState, timestamp: string): void {
    console.log("Podcast state:", { timestamp, ...state });
}

// OpenAI TTS function (unchanged)
async function generateWithOpenAI(
    enhancedScript: string,
    hostVoice: string,
    hostTone: string,
    guestVoice: string,
    guestTone: string,
    responseFormat: string
): Promise<Buffer> {
    const dialoguePieces = enhancedScript
        .split('\n')
        .filter((line: string) => line.trim() !== "" && line.includes(":"));

    if (dialoguePieces.length === 0) {
        dialoguePieces.push(`Host: ${enhancedScript}`);
    }

    const generateAudioSegment = async (piece: string): Promise<Buffer> => {
        const [speaker, ...textParts] = piece.split(":");
        const text = textParts.join(":").trim().replace(/^\*\*\s+/, "");
        const isGuest = speaker.trim().toLowerCase().includes('guest');
        const voice = isGuest ? guestVoice : hostVoice;
        const toneInstruction = isGuest ? guestTone : hostTone;

        const openaiResponse = await openai.audio.speech.create({
            model: "gpt-4o-mini-tts",
            voice: voice,
            input: text,
            instructions: toneInstruction,
            response_format: responseFormat as 'mp3' | 'wav' | 'opus' | 'aac' | 'flac',
        });

        const arrayBuffer = await openaiResponse.arrayBuffer();
        return Buffer.from(arrayBuffer);
    };

    const audioSegments: Buffer[] = await Promise.all(
        dialoguePieces.map(generateAudioSegment)
    );
    return Buffer.concat(audioSegments);
}

// Corrected Gemini TTS function using validated API structure
async function generateWithGeminiTTS(
    enhancedScript: string,
    hostVoice: string,
    guestVoice: string,
    hostStyleInstructions?: string,
    guestStyleInstructions?: string
): Promise<Buffer> {
    try {
        // Parse script to identify speakers
        const dialoguePieces = enhancedScript
            .split('\n')
            .filter((line: string) => line.trim() !== "" && line.includes(":"));

        if (dialoguePieces.length === 0) {
            throw new Error('No dialogue found in script');
        }

        // Extract unique speakers
        const speakers = new Set<string>();
        dialoguePieces.forEach(piece => {
            const [speaker] = piece.split(":");
            speakers.add(speaker.trim());
        });

        const speakersArray = Array.from(speakers);

        // Gemini TTS supports maximum 2 speakers
        if (speakersArray.length > 2) {
            throw new Error(`Gemini TTS supports maximum 2 speakers. Found ${speakersArray.length}: ${speakersArray.join(', ')}`);
        }

        // Build the prompt with individual speaker style instructions
        let prompt = '';

        // Add individual speaker style instructions if provided
        const styleInstructions: string[] = [];
        speakersArray.forEach(speaker => {
            // Better speaker detection logic - same as voice assignment
            const isSecondSpeaker = speaker.toLowerCase().includes('guest') ||
                speaker.toLowerCase().includes('expert') ||
                speaker.toLowerCase().includes('jane') ||
                speaker.toLowerCase().includes('interviewer') ||
                speaker.toLowerCase() !== 'host' && speaker.toLowerCase() !== 'narrator';

            const speakerStyle = isSecondSpeaker ? guestStyleInstructions : hostStyleInstructions;

            if (speakerStyle && speakerStyle.trim()) {
                styleInstructions.push(`Make ${speaker} ${speakerStyle.trim()}`);
            }
        });

        if (styleInstructions.length > 0) {
            prompt += `${styleInstructions.join(', and ')}: \n\n`;
        }

        prompt += `TTS the following conversation:\n${enhancedScript}`;

        console.log('Generating audio with Gemini TTS for speakers:', speakersArray);
        console.log('Style instructions:', styleInstructions.join(', '));

        // Use the validated API structure from working examples
        const response = await genAI.models.generateContent({
            model: "gemini-2.5-flash-preview-tts",
            contents: [{ parts: [{ text: prompt }] }],
            config: {
                responseModalities: ['AUDIO'],
                speechConfig: speakersArray.length > 1 ? {
                    multiSpeakerVoiceConfig: {
                        speakerVoiceConfigs: speakersArray.map((speaker) => {
                            // Better speaker detection logic - check for various guest/second speaker names
                            const isSecondSpeaker = speaker.toLowerCase().includes('guest') ||
                                speaker.toLowerCase().includes('expert') ||
                                speaker.toLowerCase().includes('jane') ||
                                speaker.toLowerCase().includes('interviewer') ||
                                speaker.toLowerCase() !== 'host' && speaker.toLowerCase() !== 'narrator';

                            const voiceName = isSecondSpeaker ? guestVoice : hostVoice;

                            console.log(`Speaker "${speaker}" assigned voice "${voiceName}" (isSecondSpeaker: ${isSecondSpeaker})`);

                            return {
                                speaker: speaker,
                                voiceConfig: {
                                    prebuiltVoiceConfig: {
                                        voiceName: voiceName
                                    }
                                }
                            };
                        })
                    }
                } : {
                    voiceConfig: {
                        prebuiltVoiceConfig: {
                            voiceName: hostVoice
                        }
                    }
                }
            }
        });

        // Extract audio data from response
        const candidate = response.candidates?.[0];
        if (!candidate?.content?.parts?.[0]) {
            throw new Error('No audio content received from Gemini TTS');
        }

        const part = candidate.content.parts[0];
        console.log('Response part structure:', {
            hasInlineData: !!part.inlineData,
            hasData: !!part.inlineData?.data,
            dataType: typeof part.inlineData?.data,
            dataLength: part.inlineData?.data?.length || 0
        });

        if (!part.inlineData?.data) {
            console.error('Full response structure:', JSON.stringify(response, null, 2));
            throw new Error('No inline audio data found in Gemini TTS response');
        }

        // Convert base64 audio data to buffer
        const pcmData = Buffer.from(part.inlineData.data, 'base64');
        console.log('PCM data extracted:', {
            pcmLength: pcmData.length,
            base64Length: part.inlineData.data.length
        });

        if (pcmData.length === 0) {
            throw new Error('Generated PCM data is empty - check if Gemini TTS API call succeeded');
        }

        // Create proper WAV file with headers (Gemini returns raw PCM data)
        const wavBuffer = createWavBuffer(pcmData, 24000, 1, 16);
        console.log('WAV file created:', {
            pcmSize: pcmData.length,
            wavSize: wavBuffer.length,
            headerSize: wavBuffer.length - pcmData.length
        });

        console.log('Successfully generated audio with Gemini TTS');
        return wavBuffer;

    } catch (error) {
        console.error('Gemini TTS Error:', error);

        // Provide more specific error messages
        if (error instanceof Error) {
            if (error.message.includes('API key')) {
                throw new Error('Invalid Google API key or Gemini API access issue');
            } else if (error.message.includes('quota') || error.message.includes('limit')) {
                throw new Error('Gemini API quota exceeded or rate limit reached');
            } else if (error.message.includes('model')) {
                throw new Error('Gemini TTS model not available - ensure you have access to gemini-2.5-flash-preview-tts');
            }
        }

        throw new Error(`Gemini TTS failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
}

interface RequestBody {
    text: string;
    ttsEngine?: string;
    hostVoice?: string;
    hostTone?: string;
    guestVoice?: string;
    guestTone?: string;
    responseFormat?: string;
    geminiHostVoice?: string;
    geminiGuestVoice?: string;
}

export async function POST(req: NextRequest) {
    try {
        const {
            text: enhancedScript,
            ttsEngine = 'openai',
            hostVoice = 'nova', // OpenAI default
            hostTone = '',
            guestVoice = 'coral', // OpenAI default
            guestTone = '',
            responseFormat = 'mp3',
            // Gemini-specific voice defaults
            geminiHostVoice = 'Kore',
            geminiGuestVoice = 'Puck'
        }: RequestBody = await req.json();

        if (!enhancedScript) {
            return new Response(JSON.stringify({ error: 'Script text is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Validate API keys
        if (ttsEngine === 'openai' && !process.env.OPENAI_API_KEY) {
            return new Response(JSON.stringify({ error: 'OpenAI API key is required for OpenAI TTS' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        if (ttsEngine === 'gemini' && !process.env.GOOGLE_API_KEY) {
            return new Response(JSON.stringify({ error: 'Google API key is required for Gemini TTS' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const timestamp = getLastTimestamp() || uuidv4();
        let combinedAudio: Buffer;

        // Generate audio based on selected TTS engine
        if (ttsEngine === 'gemini') {
            combinedAudio = await generateWithGeminiTTS(
                enhancedScript,
                geminiHostVoice,
                geminiGuestVoice,
                hostTone, // Host style instructions
                guestTone // Guest style instructions
            );
        } else {
            combinedAudio = await generateWithOpenAI(
                enhancedScript,
                hostVoice,
                hostTone,
                guestVoice,
                guestTone,
                responseFormat
            );
        }

        // Save the audio file
        const generatedPodcastDir = path.join(process.cwd(), 'public', 'generated_podcasts');
        fs.mkdirSync(generatedPodcastDir, { recursive: true });

        // Gemini TTS outputs WAV format (24kHz, 16-bit), OpenAI supports multiple formats
        const fileExtension = ttsEngine === 'gemini' ? 'wav' : (responseFormat === 'wav' ? 'wav' : 'mp3');
        const audioFilePath = path.join(generatedPodcastDir, `${timestamp}_combined.${fileExtension}`);

        console.log('Saving audio file:', {
            audioFilePath,
            bufferLength: combinedAudio.length,
            fileExtension,
            ttsEngine
        });

        fs.writeFileSync(audioFilePath, combinedAudio);

        // Verify the file was written correctly
        const stats = fs.statSync(audioFilePath);
        console.log('File written successfully:', {
            filePath: audioFilePath,
            fileSize: stats.size,
            expectedSize: combinedAudio.length
        });

        if (stats.size === 0) {
            throw new Error(`File was written but has zero size. Buffer length: ${combinedAudio.length}`);
        }

        savePodcastState({
            script: enhancedScript,
            audioPath: `/generated_podcasts/${timestamp}_combined.${fileExtension}`
        }, timestamp);

        return new Response(JSON.stringify({
            message: "Podcast created successfully",
            task_id: timestamp,
            script: enhancedScript,
            audioPath: `/generated_podcasts/${timestamp}_combined.${fileExtension}`,
            engine: ttsEngine,
            format: fileExtension,
            speakers_detected: ttsEngine === 'gemini' ? 'Auto-detected from script' : 'Individual processing'
        }), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
        });

    } catch (error: unknown) {
        console.error("Error creating podcast:", error);

        let errorMessage = 'Failed to generate audio';
        if (error instanceof Error) {
            errorMessage = error.message;
        }

        return new Response(JSON.stringify({
            error: errorMessage,
            engine: 'unknown'
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}