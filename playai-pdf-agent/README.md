
# PlayAI PDF Reader

PlayAI PDF Reader is a Next.js application that allows users to upload PDF documents and listen to their content using AI-powered text-to-speech.

## Getting Started

First, clone the repository, then install dependencies:

```bash
npm install
# or
yarn install
```

Create a 

.env

 file with your PlayAI API credentials:
```
NEXT_PUBLIC_PLAYAI_API_KEY=your-api-key
NEXT_PUBLIC_PLAYAI_USER_ID=your-user-id
NEXT_PUBLIC_PLAYAI_TTS_API_URL=https://api.play.ai/api/v1/tts/stream
```

Run the development server:

```bash
npm run dev
# or
yarn dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to access the application.

## Features

- Upload PDF documents
- View PDF content with page navigation
- Extract text from PDF documents
- Generate high-quality voice audio from extracted text
- Multiple voice options to choose from
- Audio player controls (play, pause, reset)
- Text chunking for better speech synthesis

## Technologies Used

- **Next.js**: React framework for server-side rendering and static site generation
- **React**: UI component library
- **PDF.js**: PDF rendering and text extraction
- **TailwindCSS**: Utility-first CSS framework for styling
- **PlayAI API**: Text-to-speech generation

## Design Decisions

1. **PDF Processing**:
   - Two PDF viewer implementations available for compatibility across browsers
   - Text extraction with smart chunking algorithm for natural speech breaks

2. **Audio Processing**:
   - Asynchronous processing of text chunks to handle large documents
   - Progress tracking for audio generation
   - Seamless playback of generated audio segments

3. **UI/UX**:
   - Clean, responsive interface with Tailwind CSS
   - Dark theme for better reading experience
   - Minimal controls focused on the core functionality
   - Voice selection with multiple options for personalization

4. **Performance Optimizations**:
   - Lazy loading of PDF content
   - Efficient text chunking to avoid API limits
   - React's useCallback and useMemo for optimized rendering

## Deployment

The application can be easily deployed on Vercel, the platform from the creators of Next.js:

```bash
npm run build
```

For production deployment, connect your repository to Vercel or use the Vercel CLI for direct deployment.

## License

MIT