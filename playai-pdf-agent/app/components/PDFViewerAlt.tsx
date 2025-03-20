"use client";

import { useState, useEffect } from 'react';
import { PLAYAI_VOICES, generateSpeech } from '../../utils/api';
import AudioPlayer from './AudioPlayer';
import Script from 'next/script';
import { FiChevronLeft, FiChevronRight, FiPlay, FiLoader } from 'react-icons/fi';

// Check if pdfjs is already loaded to avoid duplicate scripts
let isPdfJsLoaded = false;

interface PDFViewerProps {
  file: File;
  onTextExtracted: (text: string) => void;
}

export default function PDFViewerAlt({ file, onTextExtracted }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number>(1);
  const [pageNumber, setPageNumber] = useState<number>(1);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [fileUrl, setFileUrl] = useState<string | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isGeneratingSpeech, setIsGeneratingSpeech] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pageText, setPageText] = useState<string>('');
  const [extractingText, setExtractingText] = useState<boolean>(false);
  const [pdfJsReady, setPdfJsReady] = useState<boolean>(isPdfJsLoaded);
  const [showText, setShowText] = useState<boolean>(true);

  useEffect(() => {
    if (file && pdfJsReady) {
      const url = URL.createObjectURL(file);
      setFileUrl(url);
      setIsLoading(false);
      
      loadPdfDetails(file);
      
      return () => {
        URL.revokeObjectURL(url);
        if (audioUrl) URL.revokeObjectURL(audioUrl);
      };
    }
  }, [file, pdfJsReady]);
  
  const handlePdfJsLoad = () => {
    isPdfJsLoaded = true;
    setPdfJsReady(true);
  };
  
  // Load PDF and get total page count
  const loadPdfDetails = async (file: File) => {
    if (!window.pdfjsLib) return;

    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      setNumPages(pdf.numPages);
      extractTextFromPage(pdf, 1);
    } catch (err) {
      console.error("Error loading PDF:", err);
      setError(err instanceof Error ? err.message : "Failed to load PDF");
    }
  };
  
  // Extract text from current PDF page
  const extractTextFromPage = async (pdf: any, pageNum: number) => {
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

  // Handle page navigation and text extraction
  const handlePageChange = async (newPage: number) => {
    if (newPage < 1 || newPage > numPages || !window.pdfjsLib) return;
    setPageNumber(newPage);
    
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    
    try {
      const arrayBuffer = await file.arrayBuffer();
      const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      extractTextFromPage(pdf, newPage);
    } catch (err) {
      console.error("Error changing page:", err);
    }
  };

  // Convert page text to speech
  const handleReadPage = async () => {
    if (isGeneratingSpeech || extractingText) return;
    
    if (audioUrl) {
      URL.revokeObjectURL(audioUrl);
      setAudioUrl(null);
    }
    
    setIsGeneratingSpeech(true);
    setError(null);
    
    try {
      let textToRead = pageText;
      
      // Fallback if text extraction failed
      if (!textToRead && window.pdfjsLib) {
        try {
          const arrayBuffer = await file.arrayBuffer();
          const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
          textToRead = await extractTextFromPage(pdf, pageNumber);
        } catch (err) {
          console.error("Error extracting text:", err);
        }
      }
      
      if (!textToRead || textToRead.trim() === '') {
        textToRead = `This is page ${pageNumber} of ${numPages} from the document "${file.name}". ` +
          `Unfortunately, I could not extract any text content from this page. ` +
          `This might be because the PDF contains images or scanned content.`;
      }
      
      const url = await generateSpeech({
        text: textToRead,
        voice: PLAYAI_VOICES[0].value,
        temperature: 0.5,
        speed: 1.0
      });
      
      setAudioUrl(url);
    } catch (err) {
      console.error("Error generating speech:", err);
      setError(err instanceof Error ? err.message : "Failed to generate speech");
    } finally {
      setIsGeneratingSpeech(false);
    }
  };
  
  const toggleTextVisibility = () => {
    setShowText(prev => !prev);
  };

  return (
    <div className="pdf-viewer">
      <Script
        src="https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js"
        onLoad={handlePdfJsLoad}
        strategy="beforeInteractive"
      />
      
      <div className="bg-gray-100 rounded-lg p-4 mb-4">
        <div className="flex flex-wrap justify-between items-center gap-4">
          <div className="flex items-center space-x-2">
            <button 
              onClick={() => handlePageChange(pageNumber - 1)} 
              disabled={pageNumber <= 1}
              className="p-2 rounded-full bg-white text-blue-600 hover:bg-blue-50 disabled:opacity-50 disabled:bg-gray-100 transition-colors border border-gray-200 shadow-sm"
              aria-label="Previous page"
            >
              <FiChevronLeft size={20} />
            </button>
            
            <div className="bg-white px-4 py-2 rounded-md border border-gray-200 shadow-sm">
              <span className="font-medium">Page {pageNumber}</span>
              <span className="text-gray-500"> of {numPages}</span>
            </div>
            
            <button 
              onClick={() => handlePageChange(pageNumber + 1)} 
              disabled={pageNumber >= numPages}
              className="p-2 rounded-full bg-white text-blue-600 hover:bg-blue-50 disabled:opacity-50 disabled:bg-gray-100 transition-colors border border-gray-200 shadow-sm"
              aria-label="Next page"
            >
              <FiChevronRight size={20} />
            </button>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={toggleTextVisibility}
              className={`px-4 py-2 rounded-md border text-sm font-medium transition-colors ${
                showText 
                  ? 'bg-blue-100 border-blue-200 text-blue-800' 
                  : 'bg-white border-gray-200 text-gray-700'
              }`}
            >
              {showText ? "Hide Text" : "Show Text"}
            </button>
            
            <button
              onClick={handleReadPage}
              disabled={isGeneratingSpeech || extractingText || !pdfJsReady}
              className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md font-medium transition-colors disabled:bg-blue-300 flex items-center"
            >
              {isGeneratingSpeech || extractingText ? (
                <>
                  <FiLoader className="animate-spin mr-2" />
                  {isGeneratingSpeech ? 'Generating Audio...' : 'Extracting Text...'}
                </>
              ) : !pdfJsReady ? (
                <>
                  <FiLoader className="animate-spin mr-2" />
                  Loading PDF.js...
                </>
              ) : (
                <>
                  <FiPlay className="mr-2" />
                  Read Aloud
                </>
              )}
            </button>
          </div>
        </div>
      </div>
      
      {error && (
        <div className="mb-4 p-4 border-l-4 border-red-500 bg-red-50 text-red-800 rounded-r-md">
          <p className="font-medium">Error</p>
          <p>{error}</p>
        </div>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className={`lg:col-span-3 order-2 lg:order-1 ${(isLoading || !pdfJsReady) ? 'flex items-center justify-center' : ''}`}>
          <div className="border border-gray-200 rounded-lg overflow-hidden shadow-md h-[600px]">
            {isLoading || !pdfJsReady ? (
              <div className="flex flex-col items-center justify-center h-full w-full bg-gray-50">
                <div className="animate-spin h-12 w-12 border-4 border-blue-500 rounded-full border-t-transparent mb-4"></div>
                <p className="text-gray-600">{!pdfJsReady ? 'Loading PDF.js...' : 'Loading document...'}</p>
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
        
        <div className="space-y-4 lg:col-span-2 order-1 lg:order-2">
          {audioUrl && (
            <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4">
              <h3 className="text-lg font-medium mb-3 text-gray-800">Audio Player</h3>
              <AudioPlayer audioUrl={audioUrl} isLoading={false} />
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
        </div>
      </div>
    </div>
  );
}

declare global {
  interface Window {
    pdfjsLib: any;
  }
}