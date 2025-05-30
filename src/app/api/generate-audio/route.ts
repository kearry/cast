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

// Helper function to estimate dialogue duration (roughly 150 words per minute for speech)
function estimateDialogueDuration(text: string): number {
    const wordCount = text.split(/\s+/).length;
    return (wordCount / 150) * 60; // Convert to seconds
}

// Helper function to create batches based on estimated duration
function createBatches<T>(items: T[], maxBatchDuration: number, getItemDuration: (item: T) => number): T[][] {
    const batches: T[][] = [];
    let currentBatch: T[] = [];
    let currentBatchDuration = 0;

    for (const item of items) {
        const itemDuration = getItemDuration(item);

        // If adding this item would exceed the batch limit, start a new batch
        if (currentBatch.length > 0 && currentBatchDuration + itemDuration > maxBatchDuration) {
            batches.push([...currentBatch]);
            currentBatch = [item];
            currentBatchDuration = itemDuration;
        } else {
            currentBatch.push(item);
            currentBatchDuration += itemDuration;
        }
    }

    // Add the last batch if it has items
    if (currentBatch.length > 0) {
        batches.push(currentBatch);
    }

    return batches;
}

// OpenAI TTS function with batching
async function generateWithOpenAI(
    enhancedScript: string,
    hostVoice: string,
    hostTone: string,
    guestVoice: string,
    guestTone: string,
    responseFormat: string,
    onProgress?: (progress: string) => void
): Promise<Buffer> {
    const dialoguePieces = enhancedScript
        .split('\n')
        .filter((line: string) => line.trim() !== "" && line.includes(":"));

    if (dialoguePieces.length === 0) {
        dialoguePieces.push(`Host: ${enhancedScript}`);
    }

    // Create batches with max 3-4 minutes per batch to stay well under API limits
    const MAX_BATCH_DURATION = 200; // 3.33 minutes in seconds
    const batches = createBatches(
        dialoguePieces,
        MAX_BATCH_DURATION,
        (piece) => {
            const [, ...textParts] = piece.split(":");
            const text = textParts.join(":").trim().replace(/^\*\*\s+/, "");
            return estimateDialogueDuration(text);
        }
    );

    console.log(`Processing ${dialoguePieces.length} dialogue pieces in ${batches.length} batches`);

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

    const batchAudioBuffers: Buffer[] = [];

    for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
        const batch = batches[batchIndex];
        onProgress?.(`Processing batch ${batchIndex + 1} of ${batches.length} (${batch.length} segments)...`);

        try {
            // Process all segments in the current batch
            const batchSegments: Buffer[] = await Promise.all(
                batch.map(generateAudioSegment)
            );

            // Combine segments in this batch
            const batchAudio = Buffer.concat(batchSegments);
            batchAudioBuffers.push(batchAudio);

            console.log(`Completed batch ${batchIndex + 1}/${batches.length}, size: ${batchAudio.length} bytes`);

            // Add a small delay between batches to avoid rate limiting
            if (batchIndex < batches.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 1000));
            }
        } catch (error) {
            console.error(`Error processing batch ${batchIndex + 1}:`, error);
            throw new Error(`Failed to process batch ${batchIndex + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    onProgress?.('Combining all audio batches...');
    const finalAudio = Buffer.concat(batchAudioBuffers);
    console.log(`Final combined audio size: ${finalAudio.length} bytes`);

    return finalAudio;
}

// Gemini TTS function with batching
async function generateWithGeminiTTS(
    enhancedScript: string,
    hostVoice: string,
    guestVoice: string,
    hostStyleInstructions?: string,
    guestStyleInstructions?: string,
    onProgress?: (progress: string) => void
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

        // Create batches - smaller for Gemini due to longer processing time
        const MAX_BATCH_DURATION = 150; // 2.5 minutes per batch
        const batches = createBatches(
            dialoguePieces,
            MAX_BATCH_DURATION,
            (piece) => {
                const [, ...textParts] = piece.split(":");
                const text = textParts.join(":").trim();
                return estimateDialogueDuration(text);
            }
        );

        console.log(`Processing ${dialoguePieces.length} dialogue pieces in ${batches.length} batches for Gemini TTS`);

        const batchAudioBuffers: Buffer[] = [];

        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
            const batch = batches[batchIndex];
            onProgress?.(`Processing Gemini batch ${batchIndex + 1} of ${batches.length} (${batch.length} segments)...`);

            // Create script for this batch
            const batchScript = batch.join('\n');

            // Build the prompt with individual speaker style instructions
            let prompt = '';

            // Add individual speaker style instructions if provided
            const styleInstructions: string[] = [];
            speakersArray.forEach(speaker => {
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

            prompt += `TTS the following conversation:\n${batchScript}`;

            try {
                const response = await genAI.models.generateContent({
                    model: "gemini-2.5-flash-preview-tts",
                    contents: [{ parts: [{ text: prompt }] }],
                    config: {
                        responseModalities: ['AUDIO'],
                        speechConfig: speakersArray.length > 1 ? {
                            multiSpeakerVoiceConfig: {
                                speakerVoiceConfigs: speakersArray.map((speaker) => {
                                    const isSecondSpeaker = speaker.toLowerCase().includes('guest') ||
                                        speaker.toLowerCase().includes('expert') ||
                                        speaker.toLowerCase().includes('jane') ||
                                        speaker.toLowerCase().includes('interviewer') ||
                                        speaker.toLowerCase() !== 'host' && speaker.toLowerCase() !== 'narrator';

                                    const voiceName = isSecondSpeaker ? guestVoice : hostVoice;

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
                if (!candidate?.content?.parts?.[0]?.inlineData?.data) {
                    throw new Error(`No audio content received from Gemini TTS for batch ${batchIndex + 1}`);
                }

                // Convert base64 audio data to buffer
                const pcmData = Buffer.from(candidate.content.parts[0].inlineData.data, 'base64');

                if (pcmData.length === 0) {
                    throw new Error(`Generated PCM data is empty for batch ${batchIndex + 1}`);
                }

                // For batch processing, we need to combine raw PCM data first, then create WAV header
                batchAudioBuffers.push(pcmData);

                console.log(`Completed Gemini batch ${batchIndex + 1}/${batches.length}, PCM size: ${pcmData.length} bytes`);

                // Add delay between Gemini API calls to avoid rate limiting
                if (batchIndex < batches.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
            } catch (error) {
                console.error(`Error processing Gemini batch ${batchIndex + 1}:`, error);
                throw new Error(`Failed to process Gemini batch ${batchIndex + 1}: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }

        onProgress?.('Combining all Gemini audio batches...');

        // Combine all PCM data first
        const combinedPcmData = Buffer.concat(batchAudioBuffers);

        // Create proper WAV file with headers for the combined data
        const wavBuffer = createWavBuffer(combinedPcmData, 24000, 1, 16);

        console.log(`Final Gemini combined audio - PCM size: ${combinedPcmData.length}, WAV size: ${wavBuffer.length} bytes`);

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

        // Progress callback for batch processing
        const onProgress = (progress: string) => {
            console.log(`[${timestamp}] ${progress}`);
        };

        // Generate audio based on selected TTS engine
        if (ttsEngine === 'gemini') {
            combinedAudio = await generateWithGeminiTTS(
                enhancedScript,
                geminiHostVoice,
                geminiGuestVoice,
                hostTone, // Host style instructions
                guestTone, // Guest style instructions
                onProgress
            );
        } else {
            combinedAudio = await generateWithOpenAI(
                enhancedScript,
                hostVoice,
                hostTone,
                guestVoice,
                guestTone,
                responseFormat,
                onProgress
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