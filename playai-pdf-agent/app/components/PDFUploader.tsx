"use client";

import { useState, useCallback } from 'react';
import { FiUpload, FiFile } from 'react-icons/fi';

interface PDFUploaderProps {
  onFileUpload: (file: File) => void;
}

export default function PDFUploader({ onFileUpload }: PDFUploaderProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // handles file being dragged into the dropzone
  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  // handles file being dragged out of the dropzone
  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  // keeps the drag visual active while dragging over
  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!isDragging) {
      setIsDragging(true);
    }
  }, [isDragging]);

  // makes sure the file is a valid pdf
  const validateFile = useCallback((file: File | null): boolean => {
    if (!file) {
      setError("No file selected");
      return false;
    }

    // check if pdf
    if (file.type !== 'application/pdf') {
      setError("Please upload a PDF file");
      return false;
    }

    // 10mb is plenty big enough
    if (file.size > 10 * 1024 * 1024) {
      setError("File size must be less than 10MB");
      return false;
    }

    setError(null);
    return true;
  }, []);

  // processes file drops onto the upload area
  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length) {
      const file = files[0];
      if (validateFile(file)) {
        setFileName(file.name);
        onFileUpload(file);
      }
    }
  }, [onFileUpload, validateFile]);

  // handles file selection from the file picker
  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    if (file && validateFile(file)) {
      setFileName(file.name);
      onFileUpload(file);
    }
  }, [onFileUpload, validateFile]);

  return (
    <div className="flex flex-col items-center">
      <div 
        className={`w-full border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors
          ${isDragging 
            ? 'border-blue-500 bg-blue-50' 
            : 'border-gray-300 hover:border-blue-400 hover:bg-gray-700'}`}
        onDragEnter={handleDragEnter}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => document.getElementById('pdf-upload')?.click()}
      >
        <input 
          id="pdf-upload" 
          type="file" 
          accept="application/pdf" 
          className="hidden" 
          onChange={handleFileChange}
        />
        
        <div className="flex flex-col items-center justify-center py-6">
          {fileName ? (
            <>
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 text-blue-600 mb-4">
                <FiFile size={32} />
              </div>
              <p className="text-lg font-medium text-white">{fileName}</p>
              <p className="text-sm text-gray-600 mt-1">File selected. Click to change.</p>
            </>
          ) : (
            <>
              <div className="flex items-center justify-center w-16 h-16 rounded-full bg-blue-100 text-blue-600 mb-4">
                <FiUpload size={32} />
              </div>
              <p className="text-lg font-medium text-white">Drag and drop your PDF here</p>
              <p className="text-sm text-gray-600 mt-1">or click to browse files</p>
            </>
          )}
        </div>
      </div>
      
      {error && (
        <div className="mt-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-md w-full">
          {error}
        </div>
      )}
      
      <div className="mt-6 text-center">
        <h3 className="text-lg font-medium text-white">How it works</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
          <div className="bg-gray-700 p-4 rounded-md">
            <div className="text-white-600 text-xl font-bold mb-2">1</div>
            <p className="text-white-700">Upload a PDF document</p>
          </div>
          <div className="bg-gray-700 p-4 rounded-md">
            <div className="text-white text-xl font-bold mb-2">2</div>
            <p className="text-white">Navigate through pages</p>
          </div>
          <div className="bg-gray-700 p-4 rounded-md">
            <div className="text-white text-xl font-bold mb-2">3</div>
            <p className="text-white">Listen to AI-generated audio</p>
          </div>
        </div>
      </div>
    </div>
  );
}