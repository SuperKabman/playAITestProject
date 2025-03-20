"use client";

import { useState, useEffect, useRef } from 'react';
import { PLAYAI_VOICES, generateSpeech } from '../../utils/api';
import AudioPlayer from './AudioPlayer';
import VoiceSelector from './VoiceSelector';

import { FiChevronLeft, FiChevronRight, FiPlay, FiLoader, FiPause, FiMic, FiMicOff } from 'react-icons/fi';
import { getDocument, PDFDocumentProxy } from 'pdfjs-dist/build/pdf';
import 'pdfjs-dist/build/pdf.worker.entry';

interface PDFViewerProps {
  file: File;
  onTextExtracted: (text: string) => void;
}

interface Voice {
  name: string;
  accent: string;
  language: string;
  languageCode: string;
  value: string;
  sample: string;
  gender: string;
  style: string;
}

export default function PDFViewer({ file, onTextExtracted }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(1);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [audioUrls, setAudioUrls] = useState<string[]>([]);
  const [isGeneratingSpeech, setIsGeneratingSpeech] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageText, setPageText] = useState<string>('');
  const [extractingText, setExtractingText] = useState<boolean>(false);
  const [showText, setShowText] = useState<boolean>(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [selectedVoice, setSelectedVoice] = useState<Voice>(PLAYAI_VOICES[0]);
  const shouldContinueGenerating = useRef(true);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [totalChunks, setTotalChunks] = useState(0);
  const [processedChunks, setProcessedChunks] = useState(0);
  const [temperature, setTemperature] = useState<number>(0.5);
  const [speed, setSpeed] = useState<number>(1.0);

  // loads and displays the pdf file
  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file);
      setFileUrl(url);
      setIsLoading(false);
      
      loadPdfDetails(file);
      
      return () => {
        URL.revokeObjectURL(url);
        if (audioUrls.length > 0) {
          audioUrls.forEach(url => URL.revokeObjectURL(url));
          setAudioUrls([]);
        }
      };
    }
  }, [file]);
  
  // grabs pdf info and sets page count
  const loadPdfDetails = async (file: File) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await getDocument({ data: arrayBuffer }).promise;
      setNumPages(pdf.numPages);
      
      extractTextFromPage(pdf, 1);
    } catch (err) {
      console.error("Error loading PDF:", err);
      setError(err instanceof Error ? err.message : "Failed to load PDF");
    }
  };
  
  // pulls out text from the pdf pages
  const extractTextFromPage = async (pdf: PDFDocumentProxy, pageNum: number) => {
    setExtractingText(true);
    setPageText('');
    
    try {
      const page = await pdf.getPage(pageNum);
      const textContent = await page.getTextContent();
      
      const text = textContent.items
        .map((item: any) => item.str)
        .join(' ');
        
      setPageText(text);
      onTextExtracted(text);
      return text;
    } catch (err) {
      console.error(`Error extracting text from page ${pageNum}:`, err);
      return '';
    } finally {
      setExtractingText(false);
    }
  };

  // handles moving between different pages
  const handlePageChange = async (newPage: number) => {
    if (newPage < 1 || newPage > numPages) return;
    setPageNumber(newPage);
    
    if (audioUrls.length > 0) {
      audioUrls.forEach(url => URL.revokeObjectURL(url));
      setAudioUrls([]);
    }
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await getDocument({ data: arrayBuffer }).promise;
      extractTextFromPage(pdf, newPage);
    } catch (err) {
      console.error("Error changing page:", err);
    }
  };

  // breaks text into smaller chunks for the tts api
  const splitTextIntoChunks = (text: string): string[] => {
    if (!text) return [];
    
    const minChunkSize = 100;
    const maxChunkSize = 200;
    
    const cleanText = text.replace(/\s+/g, ' ').trim();
    
    if (cleanText.length < maxChunkSize * 1.5) {
      return [cleanText];
    }
    
    const chunks: string[] = [];
    
    const sentenceRegex = /[^.!?]+[.!?]+/g;
    const sentences = cleanText.match(sentenceRegex) || [cleanText];
    let currentChunk = '';
    
    for (const sentence of sentences) {
      const trimmedSentence = sentence.trim();
      
      if (!trimmedSentence) continue;
      
      if (trimmedSentence.length > maxChunkSize) {
        if (currentChunk) {
          chunks.push(currentChunk.trim());
          currentChunk = '';
        }
        
        let sentenceParts = [];
        let start = 0;
        
        while (start < trimmedSentence.length) {
          let end = Math.min(start + maxChunkSize, trimmedSentence.length);
          
          if (end < trimmedSentence.length) {
            const lastSpace = trimmedSentence.lastIndexOf(' ', end);
            if (lastSpace > start + minChunkSize) {
              end = lastSpace;
            }
          }
          
          sentenceParts.push(trimmedSentence.substring(start, end).trim());
          start = end;
        }
        
        chunks.push(...sentenceParts.filter(part => part.length > 0));
      }
      else if (currentChunk && (currentChunk.length + trimmedSentence.length) > maxChunkSize) {
        chunks.push(currentChunk.trim());
        currentChunk = trimmedSentence;
      } 
      else {
        if (currentChunk && currentChunk.length > 0) currentChunk += ' ';
        currentChunk += trimmedSentence;
      }
    }
    
    if (currentChunk && currentChunk.trim().length > 0) {
      chunks.push(currentChunk.trim());
    }
    
    console.log(`Created ${chunks.length} text chunks ranging from ${
      Math.min(...chunks.map(c => c.length))} to ${
      Math.max(...chunks.map(c => c.length))} chars`);
      
    return chunks;
  };

  // stops ongoing audio and resets progress
  const handleReset = () => {
    setIsPlaying(false);
    shouldContinueGenerating.current = false;
    setProcessingProgress(0);
    setProcessedChunks(0);
    setTotalChunks(0);
  };

  // converts a chunk of text to speech
  const processTextChunk = async (chunk: string): Promise<string> => {
    const trimmedChunk = chunk.trim();
    
    if (!trimmedChunk) {
      return Promise.reject(new Error("Cannot process empty text"));
    }
    
    console.log(`Processing chunk (${trimmedChunk.length} chars): "${trimmedChunk.substring(0, 50)}..." with voice ${selectedVoice.name}`);
    
    return generateSpeech({
      text: trimmedChunk,
      voice: selectedVoice.value,
      temperature,
      speed
    });
  };

  // processes all text chunks one by one in order
  const processChunksSequentially = async (chunks: string[]) => {
    shouldContinueGenerating.current = true;
    setTotalChunks(chunks.length);
    setProcessedChunks(0);
    setProcessingProgress(0);
    
    try {
      console.log("Processing first chunk to start playback immediately");
      const firstUrl = await processTextChunk(chunks[0]);
      
      if (!shouldContinueGenerating.current) {
        console.log("Generation cancelled during first chunk");
        URL.revokeObjectURL(firstUrl);
        return;
      }
      
      console.log("First chunk processed successfully, starting playback");
      setAudioUrls([firstUrl]);
      setProcessedChunks(1);
      setProcessingProgress(Math.round((1 / chunks.length) * 100));
      
    } catch (error) {
      console.error("Error processing first chunk:", error);
      if (!shouldContinueGenerating.current) return;
    }
    
    if (chunks.length > 1) {
      for (let i = 1; i < chunks.length; i++) {
        if (!shouldContinueGenerating.current) {
          console.log("Generation cancelled, stopping chunk processing");
          break;
        }
        
        try {
          console.log(`Processing chunk ${i+1}/${chunks.length}`);
          const newUrl = await processTextChunk(chunks[i]);
          
          if (shouldContinueGenerating.current) {
            setAudioUrls(prev => [...prev, newUrl]);
            console.log(`Added chunk ${i+1} to audio queue`);
            
            // Update progress
            setProcessedChunks(i + 1);
            setProcessingProgress(Math.round(((i + 1) / chunks.length) * 100));
          } else {
            URL.revokeObjectURL(newUrl);
          }
          
          if (i < chunks.length - 1) {
            await new Promise(r => setTimeout(r, 50));
          }
        } catch (error) {
          console.error(`Error processing chunk ${i+1}:`, error);
        }
      }
    }
    
    console.log("Finished processing all chunks");
    setIsGeneratingSpeech(false);
  };

  // starts or stops the speech playback
  const togglePlayback = async () => {
    if (isPlaying) {
      setIsPlaying(false);
      shouldContinueGenerating.current = false;
      return;
    }
    
    if (audioUrls.length > 0) {
      setIsPlaying(true);
      return;
    }
    
    if (isGeneratingSpeech || extractingText) return;
    
    setIsGeneratingSpeech(true);
    setError(null);
    
    try {
      // give quick feedback to user
      setIsPlaying(true);
      
      let textToRead = pageText;
      
      if (!textToRead || textToRead.trim() === '') {
        try {
          setExtractingText(true);
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await getDocument({ data: arrayBuffer }).promise;
          textToRead = await extractTextFromPage(pdf, pageNumber);
          setExtractingText(false);
        } catch (err) {
          console.error("Error extracting text:", err);
          setExtractingText(false);
        }
      }
      
      if (!textToRead || textToRead.trim() === '') {
        textToRead = `This is page ${pageNumber} of ${numPages} from the document "${file.name}". ` +
          `Unfortunately, I could not extract any text content from this page. ` +
          `This might be because the PDF contains images or scanned content.`;
      }
      
      const chunks = splitTextIntoChunks(textToRead);
      console.log(`Split text into ${chunks.length} chunks for streaming`);
      
      if (chunks.length === 0) {
        throw new Error("No text chunks generated for conversion to speech");
      }
      
      if (audioUrls.length > 0) {
        audioUrls.forEach(url => URL.revokeObjectURL(url));
        setAudioUrls([]);
      }
      
      processChunksSequentially(chunks);
      
    } catch (err) {
      console.error("Error in audio processing:", err);
      setError(err instanceof Error ? err.message : "Failed to process audio");
      setIsPlaying(false);
      setIsGeneratingSpeech(false);
    }
  };

  // shows or hides the text panel
  const toggleTextVisibility = () => {
    setShowText(prev => !prev);
  };

  return (
    <div className="pdf-viewer">
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 order-2 lg:order-1 space-y-4">
          <div className="bg-gray-100 rounded-lg p-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-medium text-gray-800">Navigation</h3>
              <div className="flex items-center">
                <button
                  onClick={toggleTextVisibility}
                  className={`px-3 py-1 rounded-md text-xs border transition-colors ${
                    showText 
                      ? 'bg-blue-100 border-blue-200 text-blue-800' 
                      : 'bg-white border-gray-200 text-gray-700'
                  }`}
                >
                  {showText ? "Hide Text" : "Show Text"}
                </button>
              </div>
            </div>
          
            <div className="flex items-center justify-between">
              <button 
                onClick={() => handlePageChange(pageNumber - 1)} 
                disabled={pageNumber <= 1}
                className="p-2 rounded-md bg-white text-blue-600 hover:bg-blue-50 disabled:opacity-50 disabled:bg-gray-100 transition-colors border border-gray-200 shadow-sm"
              >
                <FiChevronLeft size={20} />
              </button>
              
              <div className="bg-white px-4 py-2 rounded-md border border-gray-200 shadow-sm">
                <span className="font-medium text-gray-700">Page {pageNumber}</span>
                <span className="text-gray-700"> of {numPages}</span>
              </div>
              
              <button 
                onClick={() => handlePageChange(pageNumber + 1)} 
                disabled={pageNumber >= numPages}
                className="p-2 rounded-md bg-white text-blue-600 hover:bg-blue-50 disabled:opacity-50 disabled:bg-gray-100 transition-colors border border-gray-200 shadow-sm"
              >
                <FiChevronRight size={20} />
              </button>
            </div>
          </div>
          
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
            <h3 className="text-lg font-medium mb-3 text-gray-800">Voice Settings</h3>
            <VoiceSelector
              voices={PLAYAI_VOICES}
              selectedVoice={selectedVoice}
              onVoiceChange={setSelectedVoice}
            />
            
            <div className="mb-4 mt-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Temperature: {temperature.toFixed(2)}
              </label>
              <div className="flex items-center">
                <span className="text-xs text-gray-500 mr-2">Natural</span>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={temperature}
                  onChange={(e) => setTemperature(parseFloat(e.target.value))}
                  className="flex-grow h-2 rounded-lg appearance-none cursor-pointer bg-gray-200"
                />
                <span className="text-xs text-gray-500 ml-2">Variable</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Determines how random the voice sounds. Higher values increase variability.
              </p>
            </div>
            
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Speed: {speed.toFixed(1)}x
              </label>
              <div className="flex items-center">
                <span className="text-xs text-gray-500 mr-2">Slow</span>
                <input
                  type="range"
                  min="0.5"
                  max="2"
                  step="0.1"
                  value={speed}
                  onChange={(e) => setSpeed(parseFloat(e.target.value))}
                  className="flex-grow h-2 rounded-lg appearance-none cursor-pointer bg-gray-200"
                />
                <span className="text-xs text-gray-500 ml-2">Fast</span>
              </div>
              <p className="text-xs text-gray-500 mt-1">
                Adjusts speech rate from 0.5x (slow) to 2x (fast).
              </p>
            </div>
            
            <button
              onClick={togglePlayback}
              disabled={extractingText}
              className={`w-full mt-4 py-2 px-4 rounded-md font-medium transition-colors disabled:bg-gray-300 flex items-center justify-center
                ${isGeneratingSpeech ? 'bg-blue-400 cursor-default' : 
                  isPlaying ? 'bg-red-600 hover:bg-red-700 text-white' : 'bg-blue-600 hover:bg-blue-700 text-white'}`}
            >
              {isGeneratingSpeech ? (
                <>
                  <FiLoader className="animate-spin mr-2" />
                  Generating Audio...
                </>
              ) : extractingText ? (
                <>
                  <FiLoader className="animate-spin mr-2" />
                  Extracting Text...
                </>
              ) : isPlaying ? (
                <>
                  <FiPause className="mr-2" />
                  Stop
                </>
              ) : (
                <>
                  <FiPlay className="mr-2" />
                  Read Aloud
                </>
              )}
            </button>
            
            {(isGeneratingSpeech || processingProgress > 0) && (
              <div className="mt-3">
                <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-blue-600 transition-all duration-300 ease-in-out" 
                    style={{ width: `${processingProgress}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-xs text-gray-500 mt-1">
                  <span>Processing audio</span>
                  <span>{processedChunks}/{totalChunks} segments ({processingProgress}%)</span>
                </div>
              </div>
            )}
          </div>
          
          {audioUrls.length > 0 && (
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
              <h3 className="text-lg font-medium mb-3 text-gray-800">Audio Player</h3>
              <AudioPlayer 
                audioUrls={audioUrls} 
                isLoading={isGeneratingSpeech}
                isPlaying={isPlaying}
                onPlayPause={setIsPlaying}
                onReset={handleReset}
              />
            </div>
          )}
          
          {pageText && showText && (
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
              <h3 className="text-lg font-medium mb-3 text-gray-800">Extracted Text</h3>
              <div className="max-h-[300px] overflow-auto bg-gray-50 p-3 rounded-md text-gray-700">
                {pageText || "No text extracted from this page."}
              </div>
            </div>
          )}
          
          {error && (
            <div className="p-4 border-l-4 border-red-500 bg-red-50 text-red-800 rounded-r-md">
              <p className="font-medium">Error</p>
              <p>{error}</p>
            </div>
          )}
        </div>
        
        <div className={`lg:col-span-8 order-1 lg:order-2 ${isLoading ? 'flex items-center justify-center' : ''}`}>
          <div className="border border-gray-200 rounded-lg overflow-hidden shadow-md h-[750px] lg:h-[850px]">
            {isLoading ? (
              <div className="flex items-center justify-center h-full w-full bg-gray-50">
                <div className="animate-spin h-12 w-12 border-4 border-blue-500 rounded-full border-t-transparent"></div>
              </div>
            ) : (
              <iframe 
                src={`${fileUrl}#page=${pageNumber}`}
                className="w-full h-full"
                title="PDF Viewer"
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}