# AI Podcast Generator

A Next.js application that converts text scripts into podcast-style audio using Google's Multi-Speaker TTS.

## Features

- **Google Multi-Speaker TTS**: Natural conversation flow with seamless speaker transitions
- Automatically identify speakers in the script
- Process dialogue with special handling for actions/sound effects
- Use different voices for different speakers
- Download generated podcasts as MP3/WAV files
- Chatbot interface for AI personality conversations


## Getting Started

### Prerequisites

- Node.js 16.x or later
- npm or yarn
- Google API key (for Gemini Multi-Speaker TTS)

### Environment Setup

1. Clone the repository
2. Create a `.env.local` file in the root directory with the following variables:

```
GOOGLE_API_KEY=your_google_api_key_here
HOST_DEFAULT_VOICE=Kore
GUEST_DEFAULT_VOICE=Puck
HOST_DEFAULT_TONE="Speak in a clear, professional tone."
GUEST_DEFAULT_TONE="Speak in a natural, conversational tone."
HOST_DEFAULT_NAME=Samantha
GUEST_DEFAULT_NAME=Michael
SPEAKER3_DEFAULT_NAME=Patrick
SPEAKER4_DEFAULT_NAME=Danny
SPEAKER3_DEFAULT_VOICE=Charon
SPEAKER4_DEFAULT_VOICE=Aoede
SPEAKER3_DEFAULT_TONE=""
SPEAKER4_DEFAULT_TONE=""
```

### Installation

```bash
# Install dependencies
npm install
# or
yarn install

# Run the development server
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the application.

## Using the App

### Podcast Generator

1. **Generate with Google Multi-Speaker TTS**

2. **Enter your podcast script** in the text area
   - Format each line with the speaker name followed by a colon (e.g., "Host: Welcome to the show!")
   - For actions or sound effects, use parentheses (e.g., "Host: (laughs) That was funny!")

3. **Select the number of speakers (1–4)**
   - Gemini TTS supports a maximum of 2 speakers

3. **Configure voices**:
   - Choose from 5 specialized conversation voices

4. **Generate and download** your podcast

### Chatbot Interface

Access the chatbot at `/chatbot` to:
- Chat with AI personalities (Einstein, Cleopatra, Shakespeare, etc.)
- Create new chatbot personalities
- Experience RAG-based conversations

## Example Script Format

```
Host: Welcome to our podcast on AI technology!

Guest: (enthusiastically) I'm excited to be here. Today we're discussing the future of AI.

Host: Let's start with the basics. What is artificial intelligence?

Guest: Simply put, it's the simulation of human intelligence by machines.
```

## Voice Options

### Google Multi-Speaker TTS Voices
- Puck (Male, Youthful), Charon (Male, Mature)
- Kore (Female, Young), Fenrir (Male, Mature), Aoede (Female, Mature)

## Technical Details

- **Frontend**: Next.js, React, Tailwind CSS
- **API**: Next.js API routes
- **Text-to-Speech**: 
  - Google Gemini Multi-Speaker TTS (`gemini-2.0-flash-exp`)
- **Audio Processing**: Buffer manipulation for combining audio segments
- **Testing**: Jest with comprehensive API route testing

## API Endpoints

- `/api/generate-audio` - Generate podcast audio
- `/api/process-script` - Parse and format scripts
- `/api/chat/[personalityName]` - Chatbot conversations
- `/api/create-chatbot` - Create new chatbot personalities

## License

This project is licensed under the MIT License - see the LICENSE file for details.