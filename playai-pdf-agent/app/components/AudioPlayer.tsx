"use client";

import { useState, useRef, useEffect } from 'react';
import { FiPlay, FiPause, FiRefreshCw } from 'react-icons/fi';

interface AudioPlayerProps {
  audioUrls: string[];
  isLoading: boolean;
  isPlaying?: boolean;
  onPlayPause?: (isPlaying: boolean) => void;
  onReset?: () => void;
}

export default function AudioPlayer({ 
  audioUrls, 
  isLoading, 
  isPlaying: externalIsPlaying, 
  onPlayPause,
  onReset
}: AudioPlayerProps) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [internalIsPlaying, setInternalIsPlaying] = useState(false);
  const [isAudioReady, setIsAudioReady] = useState(false);
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  
  const queuedUrls = useRef<string[]>([]);
  const isPlayingRef = useRef<boolean>(false);
  const isLoadingAudio = useRef<boolean>(false);
  const minTrackDuration = useRef<number>(0); 
  const playbackStartTime = useRef<number>(0);
  
  const isPlaying = externalIsPlaying !== undefined ? externalIsPlaying : internalIsPlaying;

  // plays audio with error handling
  const safePlay = () => {
    const audio = audioRef.current;
    if (!audio || audio.paused === false || isLoadingAudio.current) return;
    
    playbackStartTime.current = Date.now();
    console.log("starting playback");
    isPlayingRef.current = true;
    isLoadingAudio.current = true;
    
    audio.play()
      .then(() => {
        isLoadingAudio.current = false;
      })
      .catch(error => {
        console.error("error playing audio:", error);
        isPlayingRef.current = false;
        isLoadingAudio.current = false;
        setInternalIsPlaying(false);
        if (onPlayPause) onPlayPause(false);
      });
  };
  
  // pauses audio playback
  const safePause = () => {
    const audio = audioRef.current;
    if (!audio || audio.paused === true) return;
    
    console.log("pausing playback");
    isPlayingRef.current = false;
    audio.pause();
  };
  
  // keeps track of available audio segments
  useEffect(() => {
    if (audioUrls.length > 0) {
      console.log(`got ${audioUrls.length} audio segments`);
      
      queuedUrls.current = [...audioUrls];
      
      const audio = audioRef.current;
      if (!audio?.src && audioUrls.length > 0) {
        console.log(`setting first audio source`);
        audio.src = audioUrls[0];
        setIsAudioReady(false);
      }
    }
  }, [audioUrls]);
  
  // handles audio events like end of track
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    
    // figures out track duration when loaded
    const handleDurationChange = () => {
      setIsAudioReady(true);
      if (audio.duration && !isNaN(audio.duration)) {
        minTrackDuration.current = Math.max(1, audio.duration - 0.5);
        console.log(`track length: ${audio.duration.toFixed(2)}s`);
      } else {
        minTrackDuration.current = 2; 
      }
    };
    
    // plays next track when current one ends
    const handleEnded = () => {
      console.log(`track ${currentTrackIndex + 1} ended`);
      
      if (currentTrackIndex < queuedUrls.current.length - 1) {
        const nextIndex = currentTrackIndex + 1;
        console.log(`playing next track ${nextIndex + 1}`);
        
        setCurrentTrackIndex(nextIndex);
      } else {
        console.log('reached end of all tracks');
        isPlayingRef.current = false;
        setInternalIsPlaying(false);
        if (onPlayPause) onPlayPause(false);
      }
    };
    
    // tries to recover from audio errors
    const handleError = (e: Event) => {
      console.error("audio error:", e);
      if (queuedUrls.current[currentTrackIndex]) {
        console.log("trying to reload audio");
        audio.src = queuedUrls.current[currentTrackIndex];
        audio.load();
      }
    };
    
    // detects when we're near the end of a track
    const handleTimeUpdate = () => {
      if (!isPlayingRef.current || audio.paused) return;
      
      if (audio.currentTime > 0 && 
          audio.duration > 0 && 
          !isNaN(audio.duration) &&
          audio.currentTime >= audio.duration - 0.1) {
        
        console.log(`detected end of track: ${audio.currentTime.toFixed(2)}/${audio.duration.toFixed(2)}`);
        
        const playedTime = (Date.now() - playbackStartTime.current) / 1000;
        if (playedTime < 0.5) {
          console.log("ignoring - too short");
          return;
        }
        
        if (currentTrackIndex < queuedUrls.current.length - 1) {
          const nextIndex = currentTrackIndex + 1;
          console.log(`moving to track ${nextIndex + 1}`);
          setCurrentTrackIndex(nextIndex);
        } else {
          console.log('all done playing');
          isPlayingRef.current = false;
          setInternalIsPlaying(false);
          if (onPlayPause) onPlayPause(false);
        }
      }
    };
    
    audio.addEventListener('loadedmetadata', handleDurationChange);
    audio.addEventListener('durationchange', handleDurationChange);
    audio.addEventListener('ended', handleEnded);
    audio.addEventListener('error', handleError);
    audio.addEventListener('timeupdate', handleTimeUpdate);
    
    return () => {
      audio.removeEventListener('loadedmetadata', handleDurationChange);
      audio.removeEventListener('durationchange', handleDurationChange);
      audio.removeEventListener('ended', handleEnded);
      audio.removeEventListener('error', handleError);
      audio.removeEventListener('timeupdate', handleTimeUpdate);
    };
  }, [currentTrackIndex, onPlayPause]);

  // switches to a different track when needed
  useEffect(() => {
    const audio = audioRef.current;
    if (!audio || queuedUrls.current.length === 0) return;
    
    const currentUrl = queuedUrls.current[currentTrackIndex];
    if (currentUrl) {
      console.log(`switching to track ${currentTrackIndex + 1}`);
      
      const wasPlaying = isPlayingRef.current;
      
      audio.pause();
      audio.src = currentUrl;
      audio.load();
      
      if (wasPlaying) {
        playbackStartTime.current = Date.now();
        
        setTimeout(() => {
          if (isPlayingRef.current) {
            audio.play().catch(err => {
              console.error("error playing after track change:", err);
            });
          }
        }, 100);
      }
    }
  }, [currentTrackIndex]);

  // syncs with external play/pause controls
  useEffect(() => {
    isPlayingRef.current = !!externalIsPlaying;
    
    const audio = audioRef.current;
    if (!audio) return;
    
    if (externalIsPlaying) {
      if (audio.paused) {
        safePlay();
      }
    } else {
      if (!audio.paused) {
        safePause();
      }
    }
  }, [externalIsPlaying]);

  // handles play/pause button clicks
  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    
    const newPlayingState = !isPlaying;
    isPlayingRef.current = newPlayingState;
    
    if (newPlayingState) {
      safePlay();
    } else {
      safePause();
    }
    
    setInternalIsPlaying(newPlayingState);
    if (onPlayPause) onPlayPause(newPlayingState);
  };

  // resets to beginning of audio
  const resetAudio = () => {
    const audio = audioRef.current;
    if (!audio) return;
    
    // Keep track of playing state before reset
    const wasPlaying = isPlayingRef.current;
    
    // Pause temporarily
    audio.pause();
    
    // Reset position to beginning
    audio.currentTime = 0;
    
    // Reset track to first one
    setCurrentTrackIndex(0);
    
    // Update internal state
    setInternalIsPlaying(false);
    
    // Notify parent component
    if (onPlayPause) onPlayPause(false);
    if (onReset) onReset();
    
    // If we were playing before, resume after a short delay to allow state to update
    if (wasPlaying) {
      setTimeout(() => {
        if (audioRef.current) {
          setInternalIsPlaying(true);
          if (onPlayPause) onPlayPause(true);
          safePlay();
        }
      }, 50);
    }
  };

  return (
    <div className="audio-player mt-4">
      <audio
        ref={audioRef}
        preload="auto"
        onPlay={() => {
          setInternalIsPlaying(true);
          if (onPlayPause) onPlayPause(true);
        }}
        onPause={() => {
          if (!isPlayingRef.current) {
            setInternalIsPlaying(false);
            if (onPlayPause) onPlayPause(false);
          }
        }}
      />
      
      <div className="flex items-center justify-center">
        <button
          onClick={togglePlay}
          disabled={isLoading && audioUrls.length === 0}
          className={`w-12 h-12 rounded-full flex items-center justify-center transition-colors mr-4
          ${(isLoading && audioUrls.length === 0) ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 
            isLoadingAudio.current ? 'bg-blue-400 text-white animate-pulse' : 
            !isAudioReady ? 'bg-blue-400 text-white' : 
            'bg-blue-600 text-white hover:bg-blue-700'}`}
          aria-label={isPlaying ? "Pause" : "Play"}
        >
          {isPlaying ? (
            <FiPause className="h-5 w-5" />
          ) : (
            <FiPlay className="h-5 w-5 ml-1" />
          )}
        </button>
        
        <button
          onClick={resetAudio}
          disabled={isLoading && audioUrls.length === 0}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors
          ${(isLoading && audioUrls.length === 0) ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 
            'bg-gray-600 text-white hover:bg-gray-700'}`}
          aria-label="Reset"
        >
          <FiRefreshCw className="h-4 w-4" />
        </button>
      </div>
      
      {audioUrls.length > 0 && (
        <div className="text-xs text-gray-500 text-center mt-2">
          {isLoading && currentTrackIndex === 0 && !isAudioReady ? 'Preparing audio...' : 
            isLoadingAudio.current ? 'Loading audio...' :
            audioUrls.length > 1 ? `Segment ${currentTrackIndex + 1} of ${audioUrls.length}` : 'Audio ready'}
        </div>
      )}
    </div>
  );
}