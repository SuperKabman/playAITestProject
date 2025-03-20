"use client";

import { useState, useCallback } from 'react';
import PDFViewer from './components/PDFViewer';
import PDFViewerAlt from './components/PDFViewerAlt';
import PDFUploader from './components/PDFUploader';

// main app component
export default function Home() {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [extractedText, setExtractedText] = useState<string>('');
  const [useAltViewer, setUseAltViewer] = useState<boolean>(false);

  // saves the file when user uploads it
  const handleFileUpload = useCallback((file: File) => {
    setSelectedFile(file);
    // Reset extracted text when a new file is uploaded
    setExtractedText('');
  }, []);
  
  // gets the text content from pdf
  const handleTextExtracted = useCallback((text: string) => {
    console.log(`Text extracted from PDF (${text.length} chars)`);
    setExtractedText(text);
  }, []);

  // switches between pdf viewer implementations
  const toggleViewer = useCallback(() => {
    setUseAltViewer(prev => !prev);
  }, []);

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="text-center mb-12">
        <h1 className="text-3xl md:text-4xl font-bold text-white mb-2">PlayAI PDF Reader</h1>
        <p className="text-lg text-white">Upload a PDF and listen to its contents with AI-powered text-to-speech</p>
      </div>
      
      {!selectedFile ? (
        <div className="max-w-3xl mx-auto">
          <PDFUploader onFileUpload={handleFileUpload} />
        </div>
      ) : (
        <div className="mb-8">
          <div className="flex justify-between items-center mb-6">
            <h2 className="text-xl font-semibold text-white">
              <span className="text-white mr-2">📄</span>
              {selectedFile.name}
            </h2>
            <div className="flex items-center gap-3">
          
              <button 
                onClick={() => setSelectedFile(null)} 
                className="px-4 py-2 text-sm text-gray-800 bg-gray-200 hover:bg-gray-300 rounded-md transition-colors"
              >
                Change PDF
              </button>
            </div>
          </div>
          
          {useAltViewer ? (
            <PDFViewerAlt 
              file={selectedFile} 
              onTextExtracted={handleTextExtracted}
            />
          ) : (
            <PDFViewer 
              file={selectedFile} 
              onTextExtracted={handleTextExtracted}
            />
          )}
        </div>
      )}
    </main>
  );
}