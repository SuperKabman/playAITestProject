"use client";

import { useState, useEffect, useRef } from 'react';
import { PLAYAI_VOICES, generateSpeech } from '../../utils/api';
import VoiceSelector from './VoiceSelector';
import AudioPlayer from './AudioPlayer';

interface TextToSpeechProps {
  text: string;
}

// breaks text into smaller pieces for tts processing
const splitIntoChunks = (text: string, maxChunkLength = 150): string[] => {
  if (!text) return [];
  
  const chunks: string[] = [];
  let currentChunk = '';
  
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  
  for (const sentence of sentences) {
    if (sentence.length > maxChunkLength) {
      if (currentChunk) {
        chunks.push(currentChunk);
        currentChunk = '';
      }
      
      let remainingSentence = sentence;
      while (remainingSentence.length > 0) {
        let breakPoint = Math.min(maxChunkLength, remainingSentence.length);
        if (breakPoint < remainingSentence.length) {
          const lastSpace = remainingSentence.lastIndexOf(' ', breakPoint);
          const lastComma = remainingSentence.lastIndexOf(',', breakPoint);
          if (lastSpace > 0) {
            breakPoint = lastSpace;
          } else if (lastComma > 0) {
            breakPoint = lastComma + 1;
          }
        }
        
        chunks.push(remainingSentence.substring(0, breakPoint).trim());
        remainingSentence = remainingSentence.substring(breakPoint).trim();
      }
    } 
    else if (currentChunk.length + sentence.length > maxChunkLength) {
      if (currentChunk) {
        chunks.push(currentChunk);
      }
      currentChunk = sentence;
    } 
    else {
      currentChunk += sentence;
    }
  }
  
  if (currentChunk) {
    chunks.push(currentChunk);
  }
  
  return chunks;
};

export default function TextToSpeech({ text }: TextToSpeechProps) {
  const [selectedVoice, setSelectedVoice] = useState(PLAYAI_VOICES[0]);
  const [audioUrls, setAudioUrls] = useState<string[]>([]);
  const [processingChunks, setProcessingChunks] = useState(false);
  const [currentChunk, setCurrentChunk] = useState(0);
  const [totalChunks, setTotalChunks] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [temperature, setTemperature] = useState(0.5);
  const [speed, setSpeed] = useState(1.0);
  const isGenerating = useRef(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const shouldContinue = useRef(true);
  
  // clean up audio urls when done
  useEffect(() => {
    return () => {
      audioUrls.forEach(url => URL.revokeObjectURL(url));
    };
  }, [audioUrls]);

  // reset when text changes
  useEffect(() => {
    if (audioUrls.length > 0) {
      audioUrls.forEach(url => URL.revokeObjectURL(url));
      setAudioUrls([]);
      setCurrentChunk(0);
      setTotalChunks(0);
      setProcessingChunks(false);
    }
    
    console.log("Text received in TextToSpeech:", text ? `${text.substring(0, 50)}...` : '(empty)');
  }, [text]);

  // stops playback and cleans up resources
  const handleReset = () => {
    if (audioUrls.length > 0) {
      audioUrls.forEach(url => URL.revokeObjectURL(url));
      setAudioUrls([]);
    }
    setCurrentChunk(0);
    setTotalChunks(0);
    setProcessingChunks(false);
    setIsPlaying(false);
    shouldContinue.current = false;
  };

  // processes one chunk of text into audio
  const processChunk = async (chunk: string, index: number, total: number): Promise<string> => {
    const trimmedChunk = chunk.trim();
    if (!trimmedChunk) {
      return Promise.reject(new Error("Empty text chunk"));
    }
    
    console.log(`Processing chunk ${index + 1}/${total} (${trimmedChunk.length} chars): "${trimmedChunk.substring(0, 50)}..."`);
    
    return generateSpeech({
      text: trimmedChunk,
      voice: selectedVoice.value,
      temperature,
      speed
    });
  };

  // processes all chunks one after another
  const processChunksSequentially = async (chunks: string[]) => {
    // reset flag before we start
    shouldContinue.current = true;
    
    // do first chunk right away so user gets feedback fast
    console.log("Processing first chunk to start playback immediately");
    try {
      const firstUrl = await processChunk(chunks[0], 0, chunks.length);
      if (shouldContinue.current) {
        setAudioUrls([firstUrl]);
        setCurrentChunk(1);
      } else {
        console.log("Generation cancelled during first chunk");
        URL.revokeObjectURL(firstUrl);
        return;
      }
    } catch (error) {
      console.error("Error processing first chunk:", error);
      if (!shouldContinue.current) return;
    }
    
    console.log(`Processing remaining ${chunks.length - 1} chunks sequentially`);
    for (let i = 1; i < chunks.length; i++) {
      if (!shouldContinue.current) {
        console.log("Chunk processing cancelled");
        break;
      }
      
      try {
        const url = await processChunk(chunks[i], i, chunks.length);
        
        if (shouldContinue.current) {
          setAudioUrls(prev => [...prev, url]);
          setCurrentChunk(i + 1);
        } else {
          URL.revokeObjectURL(url);
        }
      } catch (error) {
        console.error(`Error processing chunk ${i}:`, error);
      }
    }
    
    console.log("Finished processing all chunks");
    setProcessingChunks(false);
    isGenerating.current = false;
  };

  // handles the play button click
  const handlePlayText = async () => {
    if (isPlaying) {
      setIsPlaying(false);
      isGenerating.current = false;
      shouldContinue.current = false;
      return;
    }
    
    if (audioUrls.length > 0) {
      setIsPlaying(true);
      return;
    }
    
    if (processingChunks || isGenerating.current) return;
    
    audioUrls.forEach(url => URL.revokeObjectURL(url));
    setAudioUrls([]);
    
    setProcessingChunks(true);
    setError(null);
    isGenerating.current = true;
    
    try {
      const textToRead = text || "something was wrong with text extraction";
      const chunks = splitIntoChunks(textToRead, 150);
      
      if (chunks.length === 0) {
        throw new Error("No text available to convert to speech");
      }
      
      setTotalChunks(chunks.length);
      
      // Start playing immediately - we'll add audio URLs as they become available
      setIsPlaying(true);
      
      // Process chunks sequentially using our new function
      // This runs in the background while UI remains responsive
      processChunksSequentially(chunks);
      
    } catch (err) {
      console.error("Error generating speech:", err);
      setError(err instanceof Error ? err.message : "Failed to generate speech");
      isGenerating.current = false;
      setProcessingChunks(false);
    }
  };

  // const cancelGeneration = () => {
  //   shouldContinue.current = false;
  //   isGenerating.current = false;
  //   setProcessingChunks(false);
  //   setIsPlaying(false);
  // };

  const progress = totalChunks > 0 ? Math.floor((currentChunk / totalChunks) * 100) : 0;

  return (
    <div className="text-to-speech mt-4 p-4 border rounded-md bg-white shadow-sm">
      <h3 className="text-lg font-semibold mb-3">Text to Speech</h3>
      
      <VoiceSelector 
        voices={PLAYAI_VOICES}
        selectedVoice={selectedVoice}
        onVoiceChange={setSelectedVoice}
      />
      
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Speed: {speed}x
        </label>
        <input
          type="range"
          min="0.5"
          max="2"
          step="0.1"
          value={speed}
          onChange={(e) => setSpeed(parseFloat(e.target.value))}
          className="w-full"
        />
      </div>
      
      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Temperature: {temperature}
        </label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={temperature}
          onChange={(e) => setTemperature(parseFloat(e.target.value))}
          className="w-full"
        />
      </div>
      
      <button
        onClick={handlePlayText}
        className={`w-full py-2 px-4 border border-transparent rounded-md shadow-sm text-white font-medium focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:bg-gray-300
          ${isPlaying ? 'bg-red-600 hover:bg-red-700' : 'bg-blue-600 hover:bg-blue-700'}`}
      >
        {isPlaying
          ? (processingChunks ? 'Processing & Playing...' : 'Pause')
          : (audioUrls.length > 0 ? 'Play Audio' : 'Read Aloud')
        }
      </button>
      
      {processingChunks && (
        <div className="mt-3">
          <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
            <div 
              className="h-full bg-blue-600 transition-all duration-300 ease-in-out" 
              style={{ width: `${progress}%` }}
            ></div>
          </div>
          <div className="flex justify-between text-xs text-gray-500 mt-1">
            <span>{isPlaying ? 'Playing while processing' : 'Processing audio'}</span>
            <span>{currentChunk}/{totalChunks} segments ({progress}%)</span>
          </div>
        </div>
      )}
      
      {error && (
        <div className="mt-2 text-red-600 text-sm">
          Error: {error}
        </div>
      )}
      
      {audioUrls.length > 0 && (
        <AudioPlayer 
          audioUrls={audioUrls} 
          isLoading={processingChunks}
          isPlaying={isPlaying}
          onPlayPause={setIsPlaying}
          onReset={handleReset}
        />
      )}
    </div>
  );
}