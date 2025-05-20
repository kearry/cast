// src/app/api/generate-audio/route.ts
import { NextRequest } from 'next/server'; // Import Next.js request/response objects
//import pdfParse from 'pdf-parse';       // Library to parse PDF files
import fs from 'fs';                       // Node.js file system module
import path from 'path';                    // Node.js path module for working with file paths
import axios from 'axios';                 // For making HTTP requests (to OpenAI API)
//import OpenAI from 'openai';               // OpenAI API client
import { v4 as uuidv4 } from 'uuid';       // For generating unique identifiers
import { console } from 'inspector';

const timestamp : string =  getLastTimestamp() || uuidv4();

// Helper function to get the last generated podcast's timestamp
function getLastTimestamp(): string | null {
    try {
        const generatedPodcastDir = path.join(process.cwd(), 'public', 'generated_podcasts'); // Path to the directory where podcasts are saved

        // Read all files in the directory
        const files = fs.readdirSync(generatedPodcastDir);


        const timestamps = files
            .filter(file => file.endsWith('.mp3'))  // Filter out only .mp3 files (our podcasts)
            .map(file => file.split('_')[0])          // Extract the timestamp part of the filename (e.g., "12345_combined.mp3" -> "12345")
            .filter(ts => !isNaN(Number(ts)))    // Filter out the non numeric timestamps which would cause issues while sorting
            .sort((a, b) => Number(b) - Number(a)); // Sort timestamps in descending order (newest first)




        return timestamps.length > 0 ? timestamps[0] : null; // Return the latest timestamp or null if no podcasts exist

    } catch (error) {
        console.error("Error getting last timestamp:", error);
        return null;
    }
}




// Interface for a chat model (defines the methods a chat model must have)
//interface ChatModel {
//    generateResponse(text: string): Promise<{ choices: { message: { content: string | null } }[] }>; // generateResponse takes text and returns a Promise
//}


/*
async function createChatModel(modelName: string, temperature: number, apiKey: string): Promise<ChatModel> {
    const openai = new OpenAI({ apiKey });  // Initialize the OpenAI API client

    return {
        generateResponse: async (text) => {      // The actual function that calls the OpenAI API
            try {
                const response = await openai.chat.completions.create({
                    model: modelName,             // Use the specified model name
                    temperature: temperature,     // Set the temperature (controls randomness of output)
                    messages: [{
                        role: 'user',
                        content: `Enhance and format this podcast transcript, identifying speakers and their dialogues clearly.  If no explicit speaker is mentioned, assign a generic speaker label like "Narrator" or "Speaker": \n\n${text}` // The prompt sent to the OpenAI model
                    }],
                });
                return response;                 // Return the OpenAI API response
            } catch (error) {
                console.error("Error generating response from OpenAI:", error);
                throw error;  // Re-throw the error so it can be handled in the calling function
            }
        },
    };
}
*/

interface PodcastState {
    script: string;
    audioPath: string;
}

function savePodcastState(state: PodcastState, timestamp: string): void {

    console.log("Podcast state:", { timestamp, ...state });
}

export async function POST(req: NextRequest) {
    console.log("Generating podcast audio..."); // Log the start of the podcast generation process
    try {

        //const { summarizerModel = "gpt-4o-mini", apiKey } = await req.json(); // Get request parameters

        // If timestamp is "last", get the last timestamp. Otherwise use the provided one or a new one.
 
        const openaiApiKey : string | undefined =  process.env.OPENAI_API_KEY; // Get OpenAI API key
        if (!openaiApiKey) {
            return new Response(JSON.stringify({ error: 'OpenAI API key is missing.' }), { status: 500 });
        }


        const formData = await req.formData() //get uploaded data
        //const file = formData.get('pdf_content') as File // get the file data
        const enhancedScript = formData.get('text') as string // get the enhanced script
        const voice = formData.get('voice') as string // get the voice
        console.log('voice', voice)


        //if (!file) {
        //    return new Response(JSON.stringify({ error: "File is required" }), { status: 400 }); // Return error if no file is uploaded
        //}


        //const pdfBuffer = Buffer.from(await file.arrayBuffer()); // Read the PDF file data into a buffer
        //const pdfData = await pdfParse(pdfBuffer);                 // Parse the PDF data
        //const text = pdfData.text;                               // Extract the text content from the PDF

        //if (!text.trim()) {                                      // Check if the extracted text is empty
        //    throw new Error("Extracted text is empty");          // Throw an error if the text is empty
        //}


        //const workflow = await createChatModel(summarizerModel, 0.7, openaiApiKey);   // Create an instance of the chat model
        //const response = await workflow.generateResponse(text);                         // Generate a response from the chat model

        //const enhancedScript = response.choices[0].message.content;  // Extract the enhanced script

        //if (!enhancedScript) {                                     // Check if enhanced script is present
        //    throw new Error("No enhanced script found in the response");  // Throw error if enhanced script is not found
        //}

        // Split the enhanced script into individual dialogue pieces
        const dialoguePieces = enhancedScript
            .split('\n')                                   // Split the script by new lines
            .filter((line: string) => line.trim() !== "" && line.includes(":")); // Remove empty lines and keep lines that include a colon (speaker: dialogue)

        if (dialoguePieces.length === 0) {             // If no dialogue pieces are found (no lines with colons),
            dialoguePieces.push(`Narrator: ${enhancedScript}`);  // Treat the entire script as a single dialogue spoken by a "Narrator"
        }


        const generateAudioSegment = async (piece: string) => {  // Function to generate audio for a single dialogue piece
            const [speaker, ...textParts] = piece.split(":");          // Split the dialogue piece into speaker and text
            const text = textParts.join(":").trim();                  // Reconstruct text, handling cases with multiple colons

            const voice = speaker.trim().toLowerCase() === "Kevin" ? "onyx" : "nova"; // Choose voice based on speaker (onyx for "Host", nova for others)
            console.log('text', text)
            const ttsResponse = await axios.post(
                "https://api.openai.com/v1/audio/speech",  // OpenAI TTS API endpoint
                {
                    model: "tts-1",                // TTS model to use
                    voice,                          // Selected voice
                    input: text,                    // Text to convert to speech
                },
                {
                    headers: {
                        Authorization: `Bearer ${openaiApiKey}`, // Authorization header with API key
                        "Content-Type": "application/json",      // Content-Type header
                    },
                    responseType: "arraybuffer",          // Specify response type as arraybuffer (for audio data)
                }
            );
            if (ttsResponse.data.length === 0) {
                console.log('No payload returned: ', ttsResponse)
                throw new Error('No payload returned')
            }

            return Buffer.from(ttsResponse.data);   // Convert the audio data to a Buffer
        };


        const audioSegments = await Promise.all(dialoguePieces.map(generateAudioSegment)); // Generate audio segments for all dialogue pieces in parallel
        const combinedAudio = Buffer.concat(audioSegments);    // Combine the audio segments into a single buffer



        const generatedPodcastDir = path.join(process.cwd(), 'public', 'generated_podcasts'); // Construct the path to save dir
        fs.mkdirSync(generatedPodcastDir, { recursive: true });               // Create the directory if it doesn't exist
        const audioFilePath = path.join(generatedPodcastDir, `${timestamp}_combined.mp3`); // Construct the full file path for the podcast


        fs.writeFileSync(audioFilePath, combinedAudio); // Write the combined audio to an mp3 file
        savePodcastState({ script: enhancedScript, audioPath: `/generated_podcasts/${timestamp}_combined.mp3` }, timestamp);  // Save the podcast state


        return new Response(JSON.stringify({  // Return a JSON response to the client
            message: "Podcast created successfully",  // Success message
            task_id: timestamp,                       // Timestamp/ID of the generated podcast
            script: enhancedScript,                 // Include the generated script in the response
            audioPath: `/generated_podcasts/${timestamp}_combined.mp3`   // Include the URL path to the audio file
        }), { status: 200 }); // Status code 200 (OK)

    } catch (error) {                         // Catch any errors during the process
        console.error("Error creating podcast:", error);  // Log the error
        return new Response(JSON.stringify({ error: "Failed to create podcast", task_id: timestamp }), { status: 500 }); // Return an error response (500 Internal Server Error)

    }
}