
import React, { useState, useRef, useCallback } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage } from '@google/genai';
import type { LiveSession } from '@google/genai';
import { ResultDisplay } from './components/ResultDisplay';
import { ANIFIND_SYSTEM_INSTRUCTION } from './constants';
import { createBlob } from './utils/audio';
import { MicrophoneIcon, StopIcon, LoadingIcon, MusicNoteIcon } from './components/icons';

type Status = 'idle' | 'recording' | 'processing' | 'success' | 'error';

type GroundingChunk = {
  web?: {
    uri: string;
    title: string;
  };
};

export default function App() {
  const [status, setStatus] = useState<Status>('idle');
  const [textInput, setTextInput] = useState('');
  const [transcribedText, setTranscribedText] = useState('');
  const [finalTranscription, setFinalTranscription] = useState('');
  const [analysisResult, setAnalysisResult] = useState('');
  const [groundingSources, setGroundingSources] = useState<GroundingChunk[]>([]);
  const [error, setError] = useState<string | null>(null);

  const sessionPromiseRef = useRef<Promise<LiveSession> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);

  const cleanup = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    if (scriptProcessorRef.current) {
      scriptProcessorRef.current.disconnect();
      scriptProcessorRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(console.error);
      audioContextRef.current = null;
    }
  }, []);

  const analyzeText = useCallback(async (text: string) => {
    if (!text.trim()) {
      setError("Cannot analyze empty text. Please record audio or type something.");
      setStatus('error');
      return;
    }

    setStatus('processing');
    setError(null);
    setAnalysisResult('');
    setGroundingSources([]);
    setFinalTranscription(text);
    setTranscribedText(''); 
    setTextInput('');

    try {
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const userPrompt = `The user provided the following lyrics, transcription, or description: "${text}". Please identify the anime song based on this.`;
      const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: userPrompt,
        config: {
          systemInstruction: ANIFIND_SYSTEM_INSTRUCTION,
          tools: [{ googleSearch: {} }],
        },
      });
      setAnalysisResult(response.text);
      const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks;
      if (chunks) {
        setGroundingSources(chunks);
      }
      setStatus('success');
    } catch (err) {
      console.error('Analysis error:', err);
      setError('Failed to analyze the input. Please try again.');
      setStatus('error');
    }
  }, []);
  
  const startRecording = async () => {
    setStatus('recording');
    setError(null);
    setTranscribedText('');
    setFinalTranscription('');
    setAnalysisResult('');
    setGroundingSources([]);
    
    try {
      streamRef.current = await navigator.mediaDevices.getUserMedia({ audio: true });

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

      sessionPromiseRef.current = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-09-2025',
        callbacks: {
          onopen: () => {
            console.log('Session opened.');
            if (!streamRef.current) return;
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
    analyzeText(transcribedText);
  }, [transcribedText, cleanup, analyzeText]);

  const handleTextSubmit = useCallback(() => {
    if (!textInput.trim()) return;
    analyzeText(textInput);
  }, [textInput, analyzeText]);

  const reset = () => {
    setStatus('idle');
    setError(null);
    setTranscribedText('');
    setFinalTranscription('');
    setAnalysisResult('');
    setGroundingSources([]);
    setTextInput('');
    cleanup();
  };

  const renderStatus = () => {
    switch (status) {
      case 'recording':
        return "Listening... Speak or play the song now.";
      case 'processing':
        return "Processing... Finding your song...";
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
          
          {status === 'idle' && (
            <>
              <div className="relative flex items-center my-4">
                <div className="flex-grow border-t border-gray-700"></div>
                <span className="flex-shrink mx-4 text-gray-400">OR</span>
                <div className="flex-grow border-t border-gray-700"></div>
              </div>
              <div className="space-y-4">
                <textarea
                  value={textInput}
                  onChange={(e) => setTextInput(e.target.value)}
                  placeholder="Type lyrics, a description of the melody, or any other clues..."
                  className="w-full bg-gray-900/70 border border-gray-700 rounded-lg p-3 text-gray-200 focus:ring-2 focus:ring-cyan-500 focus:outline-none transition-shadow"
                  rows={3}
                  disabled={status !== 'idle'}
                />
                <button
                  onClick={handleTextSubmit}
                  disabled={!textInput.trim() || status !== 'idle'}
                  className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-full text-lg shadow-lg transform hover:scale-105 transition-all duration-300 disabled:bg-gray-600 disabled:scale-100 disabled:cursor-not-allowed"
                >
                  Analyze Text
                </button>
              </div>
            </>
          )}

          {(status !== 'idle' && finalTranscription) && (
            <div className="bg-gray-900/70 rounded-xl p-4 min-h-[80px] border border-gray-700 mt-6">
              <h3 className="font-semibold text-gray-400 mb-2">
                Your Input:
              </h3>
              <p className="text-gray-200 italic">
                {finalTranscription}
              </p>
            </div>
          )}

          {status === 'recording' && (
             <div className="bg-gray-900/70 rounded-xl p-4 min-h-[80px] border border-gray-700 mt-6">
              <h3 className="font-semibold text-gray-400 mb-2">
                Live Transcription:
              </h3>
              <p className="text-gray-200 italic">
                {transcribedText || "..."}
              </p>
            </div>
          )}

          {error && <div className="mt-6 text-center text-red-400 bg-red-900/50 p-4 rounded-lg">{error}</div>}

          <div className="mt-8">
            <ResultDisplay 
              result={analysisResult} 
              isLoading={status === 'processing'}
              sources={groundingSources} 
            />
          </div>
        </main>
      </div>
    </div>
  );
}
