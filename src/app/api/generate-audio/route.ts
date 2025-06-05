// src/app/api/generate-audio/route.ts
import { NextRequest } from 'next/server';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
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

// Initialize Google Gemini client for TTS
const genAI = new GoogleGenAI({ apiKey: process.env.GOOGLE_API_KEY || '' });

// Speaker defaults can be configured via environment variables
const DEFAULT_HOST_VOICE = process.env.HOST_DEFAULT_VOICE || 'Kore';
const DEFAULT_GUEST_VOICE = process.env.GUEST_DEFAULT_VOICE || 'Puck';
const DEFAULT_SPEAKER3_VOICE = process.env.SPEAKER3_DEFAULT_VOICE || 'Charon';
const DEFAULT_SPEAKER4_VOICE = process.env.SPEAKER4_DEFAULT_VOICE || 'Aoede';
const DEFAULT_HOST_TONE = process.env.HOST_DEFAULT_TONE || '';
const DEFAULT_GUEST_TONE = process.env.GUEST_DEFAULT_TONE || '';
const DEFAULT_SPEAKER3_TONE = process.env.SPEAKER3_DEFAULT_TONE || '';
const DEFAULT_SPEAKER4_TONE = process.env.SPEAKER4_DEFAULT_TONE || '';

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


// Helper function to retry Gemini TTS calls with exponential backoff
async function retryGeminiTTS(
    genAI: any,
    requestConfig: any,
    batchIndex: number,
    maxRetries: number = 3
): Promise<any> {
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`Batch ${batchIndex + 1}, attempt ${attempt}/${maxRetries}`);

            const response = await genAI.models.generateContent(requestConfig);

            // Debug response structure for failed batches
            const candidate = response.candidates?.[0];
            console.log(`Batch ${batchIndex + 1} response structure:`, {
                hasCandidates: !!response.candidates,
                candidatesLength: response.candidates?.length || 0,
                hasContent: !!candidate?.content,
                hasParts: !!candidate?.content?.parts,
                partsLength: candidate?.content?.parts?.length || 0,
                hasInlineData: !!candidate?.content?.parts?.[0]?.inlineData,
                hasData: !!candidate?.content?.parts?.[0]?.inlineData?.data,
                dataLength: candidate?.content?.parts?.[0]?.inlineData?.data?.length || 0
            });

            if (!candidate?.content?.parts?.[0]?.inlineData?.data) {
                throw new Error(`No audio content received from Gemini TTS (attempt ${attempt})`);
            }

            return response;
        } catch (error) {
            lastError = error instanceof Error ? error : new Error('Unknown error');
            console.error(`Batch ${batchIndex + 1}, attempt ${attempt} failed:`, lastError.message);

            if (attempt < maxRetries) {
                // Exponential backoff: 3s, 6s, 12s
                const delay = 3000 * Math.pow(2, attempt - 1);
                console.log(`Retrying batch ${batchIndex + 1} in ${delay}ms...`);
                await new Promise(resolve => setTimeout(resolve, delay));
            }
        }
    }

    throw lastError || new Error(`Failed after ${maxRetries} attempts`);
}

// Fixed Gemini TTS function with consistent speaker order and sequential handling
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

        // Extract unique speakers and create CONSISTENT mapping
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

        // CREATE CONSISTENT SPEAKER-TO-VOICE MAPPING ONCE WITH DETERMINISTIC ORDER
        const speakerVoiceMapping = new Map<string, { voiceName: string; styleInstructions: string; order: number }>();

        // Sort speakers deterministically to ensure consistent order across batches
        const sortedSpeakers = speakersArray.sort((a, b) => {
            // Put "Host" first, then others alphabetically
            if (a.toLowerCase().includes('host') && !b.toLowerCase().includes('host')) return -1;
            if (!a.toLowerCase().includes('host') && b.toLowerCase().includes('host')) return 1;
            return a.localeCompare(b);
        });

        sortedSpeakers.forEach((speaker, index) => {
            const isSecondSpeaker = speaker.toLowerCase().includes('guest') ||
                speaker.toLowerCase().includes('expert') ||
                speaker.toLowerCase().includes('jane') ||
                speaker.toLowerCase().includes('interviewer') ||
                (speaker.toLowerCase() !== 'host' && speaker.toLowerCase() !== 'narrator');

            const voiceName = isSecondSpeaker ? guestVoice : hostVoice;
            const styleInstructions = isSecondSpeaker ? guestStyleInstructions : hostStyleInstructions;

            speakerVoiceMapping.set(speaker, {
                voiceName,
                styleInstructions: styleInstructions || '',
                order: index
            });
        });

        console.log('Consistent speaker mapping created:',
            Array.from(speakerVoiceMapping.entries())
                .sort(([, a], [, b]) => a.order - b.order)
                .map(([speaker, config]) => `${speaker} (${config.order}) -> ${config.voiceName}`)
                .join(', ')
        );

        // Consolidate sequential same-speaker dialogue to reduce confusion
        const consolidatedDialogue: string[] = [];
        let currentSpeaker = '';
        let currentText = '';

        dialoguePieces.forEach(piece => {
            const [speaker, ...textParts] = piece.split(":");
            const text = textParts.join(":").trim();
            const cleanSpeaker = speaker.trim();

            if (cleanSpeaker === currentSpeaker) {
                // Same speaker continuing - append to current text
                currentText += ' ' + text;
            } else {
                // Different speaker - save previous and start new
                if (currentSpeaker && currentText) {
                    consolidatedDialogue.push(`${currentSpeaker}: ${currentText}`);
                }
                currentSpeaker = cleanSpeaker;
                currentText = text;
            }
        });

        // Don't forget the last piece
        if (currentSpeaker && currentText) {
            consolidatedDialogue.push(`${currentSpeaker}: ${currentText}`);
        }

        console.log(`Consolidated ${dialoguePieces.length} pieces into ${consolidatedDialogue.length} consolidated dialogue segments`);

        // Create smaller batches to reduce API failure rate
        const MAX_BATCH_DURATION = 120; // 2 minutes per batch
        const batches = createBatches(
            consolidatedDialogue,
            MAX_BATCH_DURATION,
            (piece) => {
                const [, ...textParts] = piece.split(":");
                const text = textParts.join(":").trim();
                return estimateDialogueDuration(text);
            }
        );

        console.log(`Processing ${consolidatedDialogue.length} consolidated dialogue pieces in ${batches.length} batches for Gemini TTS`);

        const batchAudioBuffers: Buffer[] = [];

        for (let batchIndex = 0; batchIndex < batches.length; batchIndex++) {
            const batch = batches[batchIndex];
            onProgress?.(`Processing Gemini batch ${batchIndex + 1} of ${batches.length} (${batch.length} segments)...`);

            // Create script for this batch
            const batchScript = batch.join('\n');

            // Find which speakers are in THIS batch (but maintain consistent mapping AND ORDER)
            const batchSpeakers = new Set<string>();
            batch.forEach(piece => {
                const [speaker] = piece.split(":");
                batchSpeakers.add(speaker.trim());
            });

            // CRITICAL: Always use the same order for speakers across ALL batches
            const batchSpeakersArray = Array.from(batchSpeakers).sort((a, b) => {
                const orderA = speakerVoiceMapping.get(a)?.order ?? 999;
                const orderB = speakerVoiceMapping.get(b)?.order ?? 999;
                return orderA - orderB;
            });

            console.log(`Batch ${batchIndex + 1} speakers in consistent order:`,
                batchSpeakersArray.map(speaker => {
                    const config = speakerVoiceMapping.get(speaker);
                    return `${speaker} (${config?.order}) -> ${config?.voiceName}`;
                }).join(', ')
            );

            // Build the prompt with individual speaker style instructions using CONSISTENT mapping
            let prompt = '';

            // Add individual speaker style instructions if provided
            const styleInstructions: string[] = [];
            batchSpeakersArray.forEach(speaker => {
                const speakerConfig = speakerVoiceMapping.get(speaker);
                if (speakerConfig && speakerConfig.styleInstructions.trim()) {
                    styleInstructions.push(`Make ${speaker} ${speakerConfig.styleInstructions.trim()}`);
                }
            });

            if (styleInstructions.length > 0) {
                prompt += `${styleInstructions.join(', and ')}: \n\n`;
            }

            prompt += `TTS the following conversation:\n${batchScript}`;

            // Prepare request configuration using CONSISTENT speaker mapping AND ORDER
            const requestConfig = {
                model: "gemini-2.5-flash-preview-tts",
                contents: [{ parts: [{ text: prompt }] }],
                config: {
                    responseModalities: ['AUDIO'],
                    speechConfig: batchSpeakersArray.length > 1 ? {
                        multiSpeakerVoiceConfig: {
                            // CRITICAL: Speakers must be in the same order every time
                            speakerVoiceConfigs: batchSpeakersArray.map((speaker) => {
                                const speakerConfig = speakerVoiceMapping.get(speaker);
                                if (!speakerConfig) {
                                    throw new Error(`No voice mapping found for speaker: ${speaker}`);
                                }

                                console.log(`Batch ${batchIndex + 1}: Mapping ${speaker} (order ${speakerConfig.order}) -> ${speakerConfig.voiceName}`);

                                return {
                                    speaker: speaker,
                                    voiceConfig: {
                                        prebuiltVoiceConfig: {
                                            voiceName: speakerConfig.voiceName
                                        }
                                    }
                                };
                            })
                        }
                    } : {
                        voiceConfig: {
                            prebuiltVoiceConfig: {
                                voiceName: speakerVoiceMapping.get(batchSpeakersArray[0])?.voiceName || hostVoice
                            }
                        }
                    }
                }
            };

            try {
                // Use retry logic for this batch (with consistent mapping preserved)
                const response = await retryGeminiTTS(genAI, requestConfig, batchIndex);

                // Extract audio data from response
                const candidate = response.candidates?.[0];
                const pcmData = Buffer.from(candidate.content.parts[0].inlineData.data, 'base64');

                if (pcmData.length === 0) {
                    throw new Error(`Generated PCM data is empty for batch ${batchIndex + 1}`);
                }

                // For batch processing, we need to combine raw PCM data first, then create WAV header
                batchAudioBuffers.push(pcmData);

                console.log(`Completed Gemini batch ${batchIndex + 1}/${batches.length}, PCM size: ${pcmData.length} bytes`);

                // Add delay between successful batches to avoid rate limiting
                if (batchIndex < batches.length - 1) {
                    await new Promise(resolve => setTimeout(resolve, 1500));
                }
            } catch (error) {
                console.error(`Failed to process Gemini batch ${batchIndex + 1} after all retries:`, error);

                // Provide more context about which batch failed
                const failedBatchContent = batch.map((line, i) => `${i + 1}: ${line}`).join('\n');
                const failedBatchSpeakers = batchSpeakersArray.map(speaker => {
                    const config = speakerVoiceMapping.get(speaker);
                    return `${speaker} (order ${config?.order}) -> ${config?.voiceName}`;
                }).join(', ');

                console.error(`Failed batch content:\n${failedBatchContent}`);
                console.error(`Failed batch speaker mapping: ${failedBatchSpeakers}`);

                throw new Error(`Failed to process Gemini batch ${batchIndex + 1} after retries: ${error instanceof Error ? error.message : 'Unknown error'}`);
            }
        }

        onProgress?.('Combining all Gemini audio batches...');

        // Combine all PCM data first
        const combinedPcmData = Buffer.concat(batchAudioBuffers);

        // Create proper WAV file with headers for the combined data
        const wavBuffer = createWavBuffer(combinedPcmData, 24000, 1, 16);

        console.log(`Final Gemini combined audio - PCM size: ${combinedPcmData.length}, WAV size: ${wavBuffer.length} bytes`);
        console.log('Final speaker mapping used:',
            Array.from(speakerVoiceMapping.entries())
                .sort(([, a], [, b]) => a.order - b.order)
                .map(([speaker, config]) => `${speaker} (order ${config.order}) -> ${config.voiceName}`)
                .join(', ')
        );

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
    hostTone?: string;
    guestTone?: string;
    geminiHostVoice?: string;
    geminiGuestVoice?: string;
    speakerVoices?: string[];
    speakerTones?: string[];
    speakerNames?: string[];
    numSpeakers?: number;
}

export async function POST(req: NextRequest) {
    try {
        const {
            text: enhancedScript,
            hostTone = DEFAULT_HOST_TONE,
            guestTone = DEFAULT_GUEST_TONE,
            geminiHostVoice = DEFAULT_HOST_VOICE,
            geminiGuestVoice = DEFAULT_GUEST_VOICE,
            speakerVoices = [],
            speakerTones = [],
            speakerNames = [],
            numSpeakers = 2
        }: RequestBody = await req.json();

        let finalHostVoice = geminiHostVoice;
        let finalGuestVoice = geminiGuestVoice;
        let finalHostTone = hostTone;
        let finalGuestTone = guestTone;

        if (Array.isArray(speakerVoices) && speakerVoices.length > 0) {
            finalHostVoice = speakerVoices[0] || finalHostVoice;
            if (speakerVoices.length > 1) {
                finalGuestVoice = speakerVoices[1] || finalGuestVoice;
            }
        }

        if (Array.isArray(speakerTones) && speakerTones.length > 0) {
            finalHostTone = speakerTones[0] ?? finalHostTone;
            if (speakerTones.length > 1) {
                finalGuestTone = speakerTones[1] ?? finalGuestTone;
            }
        }

        if (!enhancedScript) {
            return new Response(JSON.stringify({ error: 'Script text is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        // Validate API key
        if (!process.env.GOOGLE_API_KEY) {
            return new Response(JSON.stringify({ error: 'Google API key is required for Gemini TTS' }), {
                status: 500,
                headers: { 'Content-Type': 'application/json' }
            });
        }
        if (numSpeakers > 2) {
            return new Response(JSON.stringify({ error: 'Gemini TTS supports a maximum of 2 speakers' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' }
            });
        }

        const timestamp = getLastTimestamp() || uuidv4();
        let combinedAudio: Buffer;

        // Progress callback for batch processing
        const onProgress = (progress: string) => {
            console.log(`[${timestamp}] ${progress}`);
        };

        // Generate audio using Gemini TTS
        combinedAudio = await generateWithGeminiTTS(
            enhancedScript,
            finalHostVoice,
            finalGuestVoice,
            finalHostTone,
            finalGuestTone,
            onProgress
        );

        // Save the audio file
        const generatedPodcastDir = path.join(process.cwd(), 'public', 'generated_podcasts');
        fs.mkdirSync(generatedPodcastDir, { recursive: true });

        // Gemini TTS outputs WAV format (24kHz, 16-bit)
        const fileExtension = 'wav';
        const audioFilePath = path.join(generatedPodcastDir, `${timestamp}_combined.${fileExtension}`);

        console.log('Saving audio file:', {
            audioFilePath,
            bufferLength: combinedAudio.length,
            fileExtension,
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
            engine: 'gemini',
            format: fileExtension,
            speakers_detected: 'Auto-detected from script',
            speakerNames: Array.isArray(speakerNames) ? speakerNames.slice(0, numSpeakers) : []
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