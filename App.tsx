
import React, { useState, useRef, useCallback } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import type { LiveSession } from '@google/genai';
import { ResultDisplay } from './components/ResultDisplay';
import { ANIFIND_SYSTEM_INSTRUCTION } from './constants';
import { encode, createBlob } from './utils/audio';
import { MicrophoneIcon, StopIcon, LoadingIcon, MusicNoteIcon } from './components/icons';

type Status = 'idle' | 'recording' | 'processing' | 'success' | 'error';

export default function App() {
  const [status, setStatus] = useState<Status>('idle');
  const [transcribedText, setTranscribedText] = useState('');
  const [finalTranscription, setFinalTranscription] = useState('');
  const [analysisResult, setAnalysisResult] = useState('');
  const [error, setError] = useState<string | null>(null);

  const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);

  const startRecording = async () => {
    setStatus('recording');
    setError(null);
    setTranscribedText('');
    setFinalTranscription('');
    setAnalysisResult('');
    
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      sessionPromiseRef.current = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            console.log('Session opened.');
            if (!streamRef.current) return;
            // FIX: Cast window to `any` to allow access to webkitAudioContext for broader browser compatibility.
            audioContextRef.current = new ((window as any).AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
            const source = audioContextRef.current.createMediaStreamSource(streamRef.current);
            scriptProcessorRef.current = audioContextRef.current.createScriptProcessor(4096, 1, 1);
            
            scriptProcessorRef.current.onaudioprocess = (audioProcessingEvent) => {
              const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
              const pcmBlob = createBlob(inputData);
              if (sessionPromiseRef.current) {
                sessionPromiseRef.current.then((session) => {
                  session.sendRealtimeInput({ media: pcmBlob });
                });
              }
            };
            source.connect(scriptProcessorRef.current);
            scriptProcessorRef.current.connect(audioContextRef.current.destination);
          },
          onmessage: (message: LiveServerMessage) => {
            if (message.serverContent?.inputTranscription) {
              const text = message.serverContent.inputTranscription.text;
              setTranscribedText(prev => prev + text);
            }
          },
          onerror: (e: Error) => {
            console.error('Session error:', e);
            setError('An error occurred with the connection. Please try again.');
            setStatus('error');
            cleanup();
          },
          onclose: () => {
            console.log('Session closed.');
            cleanup();
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          inputAudioTranscription: {},
        },
      });

    } catch (err) {
      console.error('Failed to start recording:', err);
      setError('Could not access microphone. Please check your permissions and try again.');
      setStatus('error');
      cleanup();
    }
  };
  
  const stopRecordingAndAnalyze = useCallback(async () => {
    setStatus('processing');
    setFinalTranscription(transcribedText);

    if (sessionPromiseRef.current) {
      try {
        const session = await sessionPromiseRef.current;
        session.close();
      } catch (e) {
        console.error("Error closing session", e);
      }
    }
    sessionPromiseRef.current = null;
    cleanup();

    if (!transcribedText.trim()) {
      setError("No audio was transcribed. Please try recording again.");
      setStatus('error');
      return;
    }

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: transcribedText,
        config: {
          systemInstruction: ANIFIND_SYSTEM_INSTRUCTION,
        },
      });
      setAnalysisResult(response.text);
      setStatus('success');
    } catch (err) {
      console.error('Analysis error:', err);
      setError('Failed to analyze the transcription. Please try again.');
      setStatus('error');
    }
  }, [transcribedText]);

  const cleanup = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }
  };

  const reset = () => {
    setStatus('idle');
    setError(null);
    setTranscribedText('');
    setFinalTranscription('');
    setAnalysisResult('');
    cleanup();
  };

  const renderStatus = () => {
    switch (status) {
      case 'recording':
        return "Listening... Speak or play the song now.";
      case 'processing':
        return "Transcription complete. Finding your song...";
      case 'success':
        return "Here's what I found:";
      case 'error':
        return "An error occurred:";
      case 'idle':
      default:
        return "Press the button to start identifying an anime song.";
    }
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col items-center p-4 sm:p-6 lg:p-8">
      <div className="w-full max-w-3xl mx-auto">
        <header className="text-center mb-8">
          <div className="flex items-center justify-center gap-4 mb-2">
            <MusicNoteIcon className="h-10 w-10 text-cyan-400" />
            <h1 className="text-4xl sm:text-5xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-cyan-400 to-purple-500">
              AniFind
            </h1>
          </div>
          <p className="text-gray-400 text-lg">AI-powered Anime Song Finder</p>
        </header>

        <main className="bg-gray-800/50 backdrop-blur-sm rounded-2xl p-6 sm:p-8 shadow-2xl border border-gray-700">
          <div className="text-center mb-6">
            <p className="text-gray-300 text-lg">{renderStatus()}</p>
          </div>

          <div className="flex justify-center items-center mb-6">
            {status === 'idle' && (
              <button
                onClick={startRecording}
                className="flex items-center justify-center gap-3 px-8 py-4 bg-cyan-500 hover:bg-cyan-600 text-white font-bold rounded-full text-xl shadow-lg transform hover:scale-105 transition-all duration-300"
              >
                <MicrophoneIcon className="h-7 w-7" />
                Start Recording
              </button>
            )}
            {status === 'recording' && (
              <button
                onClick={stopRecordingAndAnalyze}
                className="flex items-center justify-center gap-3 px-8 py-4 bg-red-500 hover:bg-red-600 text-white font-bold rounded-full text-xl shadow-lg transform hover:scale-105 transition-all duration-300 animate-pulse"
              >
                <StopIcon className="h-7 w-7" />
                Stop & Analyze
              </button>
            )}
             {(status === 'success' || status === 'error') && status !== 'processing' && (
               <button
                onClick={reset}
                className="flex items-center justify-center gap-3 px-8 py-4 bg-purple-500 hover:bg-purple-600 text-white font-bold rounded-full text-xl shadow-lg transform hover:scale-105 transition-all duration-300"
              >
                Start Over
              </button>
            )}
            {status === 'processing' && (
              <div className="flex items-center justify-center gap-3 px-8 py-4 bg-gray-600 text-white font-bold rounded-full text-xl cursor-not-allowed">
                <LoadingIcon className="h-7 w-7 animate-spin" />
                Processing...
              </div>
            )}
          </div>
          
          {(status !== 'idle') && (
            <div className="bg-gray-900/70 rounded-xl p-4 min-h-[80px] border border-gray-700">
              <h3 className="font-semibold text-gray-400 mb-2">
                {status === 'processing' || status === 'success' || status === 'error' ? 'Final Transcription:' : 'Live Transcription:'}
              </h3>
              <p className="text-gray-200 italic">
                {status === 'processing' || status === 'success' || status === 'error' ? finalTranscription : transcribedText || "..."}
              </p>
            </div>
          )}

          {error && <div className="mt-6 text-center text-red-400 bg-red-900/50 p-4 rounded-lg">{error}</div>}

          <div className="mt-8">
            <ResultDisplay result={analysisResult} isLoading={status === 'processing'} />
          </div>
        </main>
      </div>
    </div>
  );
}
