// src/app/api/generate-audio/route.ts
import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai';

// Fix: Import Google TTS properly
import * as googleTTS from '@google-cloud/text-to-speech';
const TextToSpeechClient = googleTTS.v1.TextToSpeechClient;

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

// Initialize Google Cloud Text-to-Speech client with safer initialization
let googleTTSClient: googleTTS.v1.TextToSpeechClient | null = null;
try {
    if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
        // Try to read credentials file if path is provided
        if (fs.existsSync(process.env.GOOGLE_APPLICATION_CREDENTIALS)) {
            googleTTSClient = new TextToSpeechClient({
                credentials: JSON.parse(
                    fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS, 'utf8')
                ),
            });
        } else {
            console.warn("Google credentials file not found at specified path. Google TTS will be unavailable.");
        }
    } else {
        console.warn("GOOGLE_APPLICATION_CREDENTIALS not set. Google TTS will be unavailable.");
    }
} catch (error) {
    console.error("Failed to initialize Google TTS client:", error);
}

// Helper function to get the last generated podcast's timestamp
function getLastTimestamp(): string | null {
    try {
        const generatedPodcastDir = path.join(process.cwd(), 'public', 'generated_podcasts');

        // Create directory if it doesn't exist
        if (!fs.existsSync(generatedPodcastDir)) {
            fs.mkdirSync(generatedPodcastDir, { recursive: true });
            return null;
        }

        const files = fs.readdirSync(generatedPodcastDir);

        // Extract and sort valid timestamps
        const timestamps = files
            .filter(file => file.endsWith('.mp3'))
            .map(file => file.split('_')[0])
            .filter(ts => !isNaN(Number(ts)))
            .sort((a, b) => Number(b) - Number(a));

        return timestamps.length > 0 ? timestamps[0] : null;
    } catch (error) {
        console.error("Error getting last timestamp:", error);
        return null;
    }
}

// Interface for podcast state
interface PodcastState {
    script: string;
    audioPath: string;
}

// Function to save podcast state (placeholder - implement if needed)
function savePodcastState(state: PodcastState, timestamp: string): void {
    console.log("Podcast state:", { timestamp, ...state });
}

export async function POST(req: NextRequest) {
    try {
        const { text: enhancedScript, voice: requestedVoice = 'nova' } = await req.json();
        if (!enhancedScript) {
            return new Response(JSON.stringify({ error: 'Script text is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const timestamp = getLastTimestamp() || uuidv4();

        // Split the script into dialogue pieces
        const dialoguePieces = enhancedScript
            .split('\n')
            .filter((line: string) => line.trim() !== "" && line.includes(":"));

        if (dialoguePieces.length === 0) {
            dialoguePieces.push(`Narrator: ${enhancedScript}`);
        }

        const generateAudioSegment = async (piece: string): Promise<Buffer> => {
            const [speaker, ...textParts] = piece.split(":");
            const text = textParts.join(":").trim().replace(/^\*\*\s+/, "");

            // Determine which TTS service to use based on speaker and available services
            const useGoogleTTS = speaker.trim().toLowerCase().includes("kevin") && googleTTSClient !== null;

            let audioBuffer: Buffer;

            if (useGoogleTTS) {
                // Use Google TTS for Kevin
                try {
                    const [googleResponse] = await googleTTSClient!.synthesizeSpeech({
                        input: { text },
                        voice: { languageCode: 'en-US', name: 'en-US-Wavenet-D' },
                        audioConfig: { audioEncoding: 'MP3' },
                    });

                    if (!googleResponse.audioContent) {
                        throw new Error('No audio content returned from Google TTS');
                    }

                    audioBuffer = Buffer.from(googleResponse.audioContent);
                } catch (error) {
                    console.error("Google TTS failed, falling back to OpenAI:", error);
                    // Fall back to OpenAI if Google TTS fails
                    const fallbackResponse = await openai.audio.speech.create({
                        model: "tts-1",
                        voice: "onyx", // Use onyx for Kevin as fallback
                        input: text,
                    });
                    const arrayBuffer = await fallbackResponse.arrayBuffer();
                    audioBuffer = Buffer.from(arrayBuffer);
                }
            } else {
                // Use OpenAI TTS for other speakers
                // For speakers other than Kevin, use the requested voice
                const openaiResponse = await openai.audio.speech.create({
                    model: "tts-1",
                    voice: requestedVoice,
                    input: text,
                });

                const arrayBuffer = await openaiResponse.arrayBuffer();
                audioBuffer = Buffer.from(arrayBuffer);
            }

            return audioBuffer;
        };

        // Generate all audio segments in parallel
        const audioSegments: Buffer[] = await Promise.all(
            dialoguePieces.map(generateAudioSegment)
        );
        const combinedAudio = Buffer.concat(audioSegments);

        // Ensure directory exists and save the audio file
        const generatedPodcastDir = path.join(process.cwd(), 'public', 'generated_podcasts');
        fs.mkdirSync(generatedPodcastDir, { recursive: true });
        const audioFilePath = path.join(generatedPodcastDir, `${timestamp}_combined.mp3`);
        fs.writeFileSync(audioFilePath, combinedAudio);

        // Save podcast state
        savePodcastState({
            script: enhancedScript,
            audioPath: `/generated_podcasts/${timestamp}_combined.mp3`
        }, timestamp);

        return new Response(JSON.stringify({
            message: "Podcast created successfully",
            task_id: timestamp,
            script: enhancedScript,
            audioPath: `/generated_podcasts/${timestamp}_combined.mp3`
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
            error: errorMessage
        }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' }
        });
    }
}