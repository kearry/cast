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

// Interface for podcast state
interface PodcastState {
    script: string;
    audioPath: string;
}

// Function to save podcast state
function savePodcastState(state: PodcastState, timestamp: string): void {
    console.log("Podcast state:", { timestamp, ...state });
}

export async function POST(req: NextRequest) {
    try {
        const {
            text: enhancedScript,
            hostVoice = 'nova',
            hostTone = '',
            guestVoice = 'coral',
            guestTone = '',
            responseFormat = 'mp3'
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
            dialoguePieces.push(`Host: ${enhancedScript}`);
        }

        const generateAudioSegment = async (piece: string): Promise<Buffer> => {
            const [speaker, ...textParts] = piece.split(":");
            const text = textParts.join(":").trim().replace(/^\*\*\s+/, "");

            // Determine if this is a host or guest based on the speaker name
            const isGuest = speaker.trim().toLowerCase().includes('guest');

            // Use the appropriate voice and tone based on speaker
            const voice = isGuest ? guestVoice : hostVoice;
            const toneInstruction = isGuest ? guestTone : hostTone;

            // Use OpenAI TTS with the new model and instructions parameter
            const openaiResponse = await openai.audio.speech.create({
                model: "gpt-4o-mini-tts",
                voice: voice,
                input: text,
                instructions: toneInstruction, // Use the instructions parameter for tone
                response_format: responseFormat as 'mp3' | 'wav' | 'opus' | 'aac' | 'flac',
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

        const fileExtension = responseFormat === 'wav' ? 'wav' : 'mp3'; // Default to mp3 for other formats for simplicity
        const audioFilePath = path.join(generatedPodcastDir, `${timestamp}_combined.${fileExtension}`);
        fs.writeFileSync(audioFilePath, combinedAudio);

        // Save podcast state
        savePodcastState({
            script: enhancedScript,
            audioPath: `/generated_podcasts/${timestamp}_combined.${fileExtension}`
        }, timestamp);

        return new Response(JSON.stringify({
            message: "Podcast created successfully",
            task_id: timestamp,
            script: enhancedScript,
            audioPath: `/generated_podcasts/${timestamp}_combined.${fileExtension}`
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