# AI Podcast Generator

A Next.js application that converts text scripts into podcast-style audio using AI voices from OpenAI and Google's Multi-Speaker TTS.

## Features

- **Dual TTS Engines**: Choose between OpenAI TTS and Google's Multi-Speaker TTS
- **OpenAI TTS**: Individual speaker control with custom tones and 10 voice options
- **Google Multi-Speaker TTS**: Natural conversation flow with seamless speaker transitions
- Automatically identify speakers in the script
- Process dialogue with special handling for actions/sound effects
- Use different voices for different speakers
- Download generated podcasts as MP3/WAV files
- Chatbot interface for AI personality conversations

## TTS Engine Comparison

| Feature | OpenAI TTS | Google Multi-Speaker TTS |
|---------|------------|--------------------------|
| Voice Quality | High quality, 10 voices | Natural conversation flow |
| Speaker Control | Individual tone control | Automatic transitions |
| Audio Formats | MP3, WAV, Opus, AAC, FLAC | MP3 |
| Processing | Sequential segments | Single conversation |
| Best For | Podcasts with distinct speakers | Natural dialogue |

## Getting Started

### Prerequisites

- Node.js 16.x or later
- npm or yarn
- OpenAI API key (for OpenAI TTS)
- Google API key (for Gemini Multi-Speaker TTS)

### Environment Setup

1. Clone the repository
2. Create a `.env.local` file in the root directory with the following variables:

```
OPENAI_API_KEY=your_openai_api_key_here
GOOGLE_API_KEY=your_google_api_key_here
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

1. **Choose TTS Engine**:
   - **OpenAI TTS**: For individual speaker control and custom tones
   - **Google Multi-Speaker TTS**: For natural conversation flow

2. **Enter your podcast script** in the text area
   - Format each line with the speaker name followed by a colon (e.g., "Host: Welcome to the show!")
   - For actions or sound effects, use parentheses (e.g., "Host: (laughs) That was funny!")

3. **Configure voices**:
   - **OpenAI TTS**: Select voices and customize speaking tones
   - **Google Multi-Speaker TTS**: Choose from 5 specialized conversation voices

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

### OpenAI TTS Voices
- Alloy (Neutral), Ash (Male), Ballad (Male)
- Coral (Female), Echo (Male), Fable (Male)
- Nova (Female), Onyx (Male), Sage (Male), Shimmer (Female)

### Google Multi-Speaker TTS Voices
- Puck (Male, Youthful), Charon (Male, Mature)
- Kore (Female, Young), Fenrir (Male, Mature), Aoede (Female, Mature)

## Technical Details

- **Frontend**: Next.js, React, Tailwind CSS
- **API**: Next.js API routes
- **Text-to-Speech**: 
  - OpenAI TTS API (`gpt-4o-mini-tts`)
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