// src/app/api/generate-audio/route.ts
import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import OpenAI from 'openai';
import textToSpeech from '@google-cloud/text-to-speech';

// Initialize OpenAI client *outside* the POST handler (more efficient)
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Initialize Google Cloud Text-to-Speech client
const googleTTS = new textToSpeech.TextToSpeechClient({
    credentials: JSON.parse(fs.readFileSync(process.env.GOOGLE_APPLICATION_CREDENTIALS!, 'utf8')), // Or provide path to credentials file.
});

// Helper function to get the last generated podcast's timestamp
function getLastTimestamp(): string | null {
    try {
        const generatedPodcastDir = path.join(process.cwd(), 'public', 'generated_podcasts');
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



// Interface for podcast state (to be saved - if needed)
interface PodcastState {
    script: string;
    audioPath: string;
}


// Function to save podcast state (replace with your implementation if you need state persistence.)
function savePodcastState(state: PodcastState, timestamp: string): void {
    console.log("Podcast state:", { timestamp, ...state }); // Placeholder:  Implement actual saving logic
}

export async function POST(req: NextRequest) {
    try {
        const { text: enhancedScript, voice } = await req.json(); // Get the script and requested voice from the request body
        const timestamp = getLastTimestamp() || uuidv4(); // Determine the timestamp (either get the latest or generate new one)



        const dialoguePieces = enhancedScript
            .split('\n')
            .filter((line: string) => line.trim() !== "" && line.includes(":"));

        if (dialoguePieces.length === 0) {
            dialoguePieces.push(`Narrator: ${enhancedScript}`); // Default to "Narrator" if no dialogues.
        }

        const generateAudioSegment = async (piece: string): Promise<Buffer> => {
            const [speaker, ...textParts] = piece.split(":");
            const text = textParts.join(":").trim().replace(/^\*\*\s+/, "");
            /*
                        let speakerVoice = 'nova'; // Default voice
            
                        if (speaker === "**Kevin") {
                            console.log("Using Kevin's voice for speaker:", speaker);
                            speakerVoice = "onyx";  // Use 'onyx' for Kevin
                        } else if (voice && voice !== 'nova') {  // If general voice is specified and not default use that
                            console.log("Using specified voice for speaker:", speaker);
                            speakerVoice = "nova"
                        }
                        console.log("Generating audio for:", { speaker, text, speakerVoice });
            
                        const response = await openai.audio.speech.create({
                            model: "tts-1",
                            voice: speakerVoice,  // Use the chosen voice
                            input: text,
                        });
            
                        const arrayBuffer = await response.arrayBuffer();
                        return Buffer.from(arrayBuffer);  // Return a Buffer
                    };
            */
            let audioBuffer: Buffer;

            if (speaker.trim().toLowerCase().endsWith("kevin")) {  // Use Google TTS for Kevin
                let speakerVoice = voice || 'nova';
                if (voice && voice !== 'nova') {
                    speakerVoice = voice
                }

                const openaiResponse = await openai.audio.speech.create({
                    model: "tts-1",
                    voice: speakerVoice,
                    input: text,
                });

                const arrayBuffer = await openaiResponse.arrayBuffer();
                audioBuffer = Buffer.from(arrayBuffer);
            }
            else {  // Use OpenAI TTS for other speakers
                const [googleResponse] = await googleTTS.synthesizeSpeech({
                    input: { text },
                    voice: { languageCode: 'en-US', name: 'en-US-Wavenet-D' }, // Choose your desired voice
                    audioConfig: { audioEncoding: 'MP3' },
                });
                audioBuffer = googleResponse.audioContent as Buffer;
            }
            return audioBuffer;

        };

        const audioSegments: Buffer[] = await Promise.all(dialoguePieces.map(generateAudioSegment));  // Type annotation
        const combinedAudio = Buffer.concat(audioSegments);


        // Save audio file
        const generatedPodcastDir = path.join(process.cwd(), 'public', 'generated_podcasts');
        fs.mkdirSync(generatedPodcastDir, { recursive: true });
        const audioFilePath = path.join(generatedPodcastDir, `${timestamp}_combined.mp3`);
        fs.writeFileSync(audioFilePath, combinedAudio);



        savePodcastState({ script: enhancedScript, audioPath: `/generated_podcasts/${timestamp}_combined.mp3` }, timestamp);


        return new Response(JSON.stringify({  // Send successful response to frontend
            message: "Podcast created successfully",
            task_id: timestamp,
            script: enhancedScript,
            audioPath: `/generated_podcasts/${timestamp}_combined.mp3`
        }), { status: 200 });

    } catch (error: unknown) {
        console.error("Error creating podcast:", error);
        if (error instanceof Error) {
            if (error.message) {
                // The error message is available
                console.error('OpenAI API Error:', error.message);
            } else {
                // Something happened in setting up the request that triggered an Error
                console.error('OpenAI API Error:', error.message);

            }
            console.error("Full OpenAI API Error:", error);

            // Important to send a 500 response to the frontend so it knows of failure.
            return new Response(JSON.stringify({ error: error.message || 'Failed to generate audio' }), { status: 500, headers: { 'Content-Type': 'application/json' } });

        }
    }
}