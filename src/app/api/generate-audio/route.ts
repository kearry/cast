// src/app/api/generate-audio/route.ts
import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
});

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

// Define voice mapping type
interface VoiceMapping {
    [speaker: string]: string;
}

export async function POST(req: NextRequest) {
    try {
        const {
            text: enhancedScript,
            hostVoice = 'nova',  // Default host voice
            guestVoice = 'alloy'  // Default guest voice
        } = await req.json();

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

        // Function to determine speaker category (host vs guest)
        const determineVoice = (speaker: string): string => {
            const speakerLower = speaker.trim().toLowerCase();

            // Default voice mapping
            if (speakerLower === 'host' || speakerLower.includes('host')) {
                return hostVoice;
            } else if (speakerLower === 'guest' || speakerLower.includes('guest')) {
                return guestVoice;
            } else if (speakerLower === 'narrator') {
                return 'echo'; // Narrator always uses echo
            } else {
                // For any other speakers
                return hostVoice; // Default to host voice
            }
        };

        const generateAudioSegment = async (piece: string): Promise<Buffer> => {
            const [speaker, ...textParts] = piece.split(":");
            const text = textParts.join(":").trim().replace(/^\*\*\s+/, "");

            // Get the appropriate voice for this speaker
            const voiceToUse = determineVoice(speaker);

            // Use OpenAI TTS
            const openaiResponse = await openai.audio.speech.create({
                model: "tts-1",
                voice: voiceToUse,
                input: text,
            });

            const arrayBuffer = await openaiResponse.arrayBuffer();
            return Buffer.from(arrayBuffer);
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