import { useState, useRef, useCallback, useEffect } from 'react';

const VAD_SILENCE_TIMEOUT_MS = 2200;
const AMPLITUDE_UPDATE_INTERVAL_MS = 50;
const MIN_RECORDING_DURATION_MS = 500; // Don't allow recordings shorter than 500ms
const MAX_RECORDING_DURATION_MS = 60000; // 60 seconds max

export const useAudioRecorder = (onRecordingFinished: (blob: Blob, duration: number) => void) => {
    const [isRecording, setIsRecording] = useState(false);
    const [amplitude, setAmplitude] = useState(0);
    const [error, setError] = useState<string | null>(null);

    const mediaRecorderRef = useRef<MediaRecorder | null>(null);
    const audioChunksRef = useRef<Blob[]>([]);
    const silenceTimerRef = useRef<number | null>(null);
    const maxDurationTimerRef = useRef<number | null>(null);
    const audioContextRef = useRef<AudioContext | null>(null);
    const analyserRef = useRef<AnalyserNode | null>(null);
    const amplitudeIntervalRef = useRef<number | null>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const recordingStartTimeRef = useRef<number>(0);

    const onRecordingFinishedRef = useRef(onRecordingFinished);
    useEffect(() => {
        onRecordingFinishedRef.current = onRecordingFinished;
    }, [onRecordingFinished]);

    const cleanup = useCallback(() => {
        if (amplitudeIntervalRef.current) {
            clearInterval(amplitudeIntervalRef.current);
            amplitudeIntervalRef.current = null;
        }
        if (silenceTimerRef.current) {
            clearTimeout(silenceTimerRef.current);
            silenceTimerRef.current = null;
        }
        if (maxDurationTimerRef.current) {
            clearTimeout(maxDurationTimerRef.current);
            maxDurationTimerRef.current = null;
        }
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => {
                track.stop();
                console.log(`[RECORDER] Stopped track: ${track.kind}`);
            });
            streamRef.current = null;
        }
        if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
            audioContextRef.current.close().catch(err => 
                console.warn('[RECORDER] Error closing AudioContext:', err)
            );
            audioContextRef.current = null;
        }
        setAmplitude(0);
    }, []);

    const stopRecording = useCallback((reason: string = 'manual') => {
        if (!mediaRecorderRef.current || mediaRecorderRef.current.state !== 'recording') {
            console.warn('[RECORDER] Stop called but not recording');
            return;
        }
        
        const duration = Date.now() - recordingStartTimeRef.current;
        
        if (duration < MIN_RECORDING_DURATION_MS) {
            console.warn(`[RECORDER] Recording too short (${duration}ms), ignoring`);
            cleanup();
            setIsRecording(false);
            setError('Recording too short. Please speak for at least half a second.');
            return;
        }
        
        console.log(`[RECORDER] Stopping recording via stopRecording() - Reason: ${reason}, Duration: ${duration}ms`);
        mediaRecorderRef.current.stop();
        cleanup();
    }, [cleanup]);

    const updateAmplitude = useCallback(() => {
        if (analyserRef.current) {
            const dataArray = new Uint8Array(analyserRef.current.frequencyBinCount);
            analyserRef.current.getByteTimeDomainData(dataArray);
            let sumSquares = 0.0;
            for (const amplitude of dataArray) {
                const normalized = (amplitude / 128.0) - 1.0;
                sumSquares += normalized * normalized;
            }
            const rms = Math.sqrt(sumSquares / dataArray.length);
            setAmplitude(rms);

            // VAD check
            if (rms < 0.01) {
                if (!silenceTimerRef.current) {
                    silenceTimerRef.current = window.setTimeout(() => {
                        console.warn("[RECORDER] Silence detected (VAD). Stopping recording.");
                        stopRecording('VAD silence');
                    }, VAD_SILENCE_TIMEOUT_MS);
                }
            } else {
                if (silenceTimerRef.current) {
                    clearTimeout(silenceTimerRef.current);
                    silenceTimerRef.current = null;
                }
            }
        }
    }, [stopRecording]);

    const startRecording = useCallback(async () => {
        console.log("[RECORDER] Attempting to start recording...");
        setError(null);
        
        try {
            // Check if browser supports required APIs
            if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
                throw new Error('Your browser does not support audio recording');
            }

            const stream = await navigator.mediaDevices.getUserMedia({ 
                audio: {
                    echoCancellation: true,
                    noiseSuppression: true,
                    autoGainControl: true,
                    sampleRate: 48000
                } 
            });
            streamRef.current = stream;
            
            audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
            const source = audioContextRef.current.createMediaStreamSource(stream);
            analyserRef.current = audioContextRef.current.createAnalyser();
            analyserRef.current.fftSize = 256;
            analyserRef.current.smoothingTimeConstant = 0.8;
            source.connect(analyserRef.current);

            // Check for supported mime types
            const mimeTypes = [
                'audio/webm;codecs=opus',
                'audio/webm',
                'audio/ogg;codecs=opus',
                'audio/mp4'
            ];
            
            let selectedMimeType = '';
            for (const mimeType of mimeTypes) {
                if (MediaRecorder.isTypeSupported(mimeType)) {
                    selectedMimeType = mimeType;
                    console.log(`[RECORDER] Using mime type: ${mimeType}`);
                    break;
                }
            }
            
            if (!selectedMimeType) {
                throw new Error('No supported audio format found');
            }

            const options = { mimeType: selectedMimeType };
            mediaRecorderRef.current = new MediaRecorder(stream, options);
            audioChunksRef.current = [];

            mediaRecorderRef.current.ondataavailable = (event) => {
                if (event.data.size > 0) {
                    audioChunksRef.current.push(event.data);
                    console.log(`[RECORDER] Data chunk received: ${event.data.size} bytes`);
                }
            };

            mediaRecorderRef.current.onstop = () => {
                const duration = Date.now() - recordingStartTimeRef.current;
                
                if (audioChunksRef.current.length === 0) {
                    console.error('[RECORDER] No audio data captured');
                    setError('No audio was captured. Please check your microphone.');
                    setIsRecording(false);
                    cleanup();
                    return;
                }
                
                const audioBlob = new Blob(audioChunksRef.current, { type: selectedMimeType });
                
                console.groupCollapsed("[RECORDER] Recording finished in 'onstop' event.");
                console.log("Blob:", audioBlob);
                console.log(`Duration: ${duration}ms`);
                console.log(`Blob size: ${audioBlob.size} bytes`);
                console.groupEnd();

                if (audioBlob.size === 0) {
                    console.error('[RECORDER] Audio blob is empty');
                    setError('Recording failed. Please try again.');
                    setIsRecording(false);
                    return;
                }

                onRecordingFinishedRef.current(audioBlob, duration);
                setIsRecording(false);
            };
            
            mediaRecorderRef.current.onerror = (event) => {
                console.error('[RECORDER] MediaRecorder error:', event);
                setError('Recording error occurred. Please try again.');
                cleanup();
                setIsRecording(false);
            };
            
            // Start recording with timeslice for regular data events
            mediaRecorderRef.current.start(100); // Get data every 100ms
            recordingStartTimeRef.current = Date.now();
            setIsRecording(true);
            console.info("[RECORDER] Recording started successfully.");

            // Set maximum duration timer
            maxDurationTimerRef.current = window.setTimeout(() => {
                console.warn(`[RECORDER] Maximum duration (${MAX_RECORDING_DURATION_MS}ms) reached`);
                stopRecording('max duration');
            }, MAX_RECORDING_DURATION_MS);

            if (amplitudeIntervalRef.current) clearInterval(amplitudeIntervalRef.current);
            amplitudeIntervalRef.current = window.setInterval(updateAmplitude, AMPLITUDE_UPDATE_INTERVAL_MS);

        } catch (err) {
            console.error("[RECORDER] Error accessing microphone:", err);
            const error = err as Error;
            
            if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
                setError('Microphone access denied. Please allow microphone access and try again.');
            } else if (error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError') {
                setError('No microphone found. Please connect a microphone and try again.');
            } else {
                setError('Failed to start recording. Please check your microphone.');
            }
            
            setIsRecording(false);
            cleanup();
        }
    }, [updateAmplitude, stopRecording, cleanup]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            cleanup();
        };
    }, [cleanup]);

    return { isRecording, amplitude, startRecording, stopRecording, error };
};