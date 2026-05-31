import { useEffect, useRef, useState } from "react";
import { Camera, Square, RotateCcw, Video, AlertCircle, CheckCircle } from "lucide-react";

interface VideoRecorderProps {
  onRecordComplete: (blob: Blob) => void;
  onCancel?: () => void;
}

export function VideoRecorder({ onRecordComplete, onCancel }: VideoRecorderProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordingStatus, setRecordingStatus] = useState<"idle" | "requesting" | "recording" | "stopped">("idle");
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const previewVideoRef = useRef<HTMLVideoElement>(null);
  const playbackVideoRef = useRef<HTMLVideoElement>(null);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      stopStreams();
      stopTimer();
    };
  }, []);

  const stopStreams = () => {
    if (stream) {
      stream.getTracks().forEach((track) => track.stop());
      setStream(null);
    }
  };

  const startTimer = () => {
    setSeconds(0);
    timerRef.current = window.setInterval(() => {
      setSeconds((s) => s + 1);
    }, 1000);
  };

  const stopTimer = () => {
    if (timerRef.current !== null) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  };

  const requestCameraPermissions = async () => {
    setError(null);
    setRecordingStatus("requesting");
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
        audio: true,
      });
      setStream(mediaStream);
      if (previewVideoRef.current) {
        previewVideoRef.current.srcObject = mediaStream;
      }
      
      const recorder = new MediaRecorder(mediaStream, { mimeType: "video/webm" });
      setMediaRecorder(recorder);
      
      const chunks: Blob[] = [];
      recorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          chunks.push(e.data);
        }
      };
      
      recorder.onstop = () => {
        const blob = new Blob(chunks, { type: "video/webm" });
        setRecordedChunks(chunks);
        const url = URL.createObjectURL(blob);
        setVideoUrl(url);
        setRecordingStatus("stopped");
      };

      recorder.start();
      setRecordingStatus("recording");
      startTimer();
    } catch (err: any) {
      console.error("Camera access failed:", err);
      setError("Could not access camera or microphone. Please check system permissions.");
      setRecordingStatus("idle");
    }
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
      stopTimer();
      stopStreams();
    }
  };

  const handleReset = () => {
    setVideoUrl(null);
    setRecordedChunks([]);
    setRecordingStatus("idle");
    setSeconds(0);
    setError(null);
  };

  const handleUseVideo = () => {
    if (recordedChunks.length > 0) {
      const blob = new Blob(recordedChunks, { type: "video/webm" });
      onRecordComplete(blob);
    }
  };

  const formatTime = (secs: number) => {
    const mins = Math.floor(secs / 60);
    const remainingSecs = secs % 60;
    return `${mins.toString().padStart(2, "0")}:${remainingSecs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="bg-navy/[0.02] border border-border rounded-xl p-6 space-y-5 flex flex-col items-center">
      <div className="w-full flex items-center justify-between border-b border-border pb-3">
        <h4 className="text-sm font-bold text-navy flex items-center gap-2">
          <Video size={16} className="text-coral" /> In-Browser Video Recorder
        </h4>
        {recordingStatus === "recording" && (
          <span className="flex items-center gap-1.5 text-xs text-red-500 font-bold font-mono">
            <span className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse" />
            {formatTime(seconds)}
          </span>
        )}
      </div>

      {error && (
        <div className="w-full bg-destructive/10 border border-destructive/20 text-destructive text-xs p-4 rounded-md flex gap-2 items-start text-left">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Preview Screen */}
      {recordingStatus === "idle" && !videoUrl && (
        <div className="w-full aspect-video max-w-lg bg-slate-900 rounded-lg flex flex-col items-center justify-center text-center p-6 text-white/60 space-y-4">
          <Camera size={44} className="stroke-[1.5]" />
          <div>
            <p className="text-sm font-bold text-white">Record Video Response</p>
            <p className="text-xs text-white/50 mt-1 max-w-xs">
              Make sure your camera and microphone are connected and allowed by your browser.
            </p>
          </div>
          <button
            onClick={requestCameraPermissions}
            className="h-10 px-6 bg-coral hover:bg-coral-hover text-white text-xs font-bold rounded-full transition-colors cursor-pointer"
          >
            Grant Access & Record
          </button>
        </div>
      )}

      {recordingStatus === "requesting" && (
        <div className="w-full aspect-video max-w-lg bg-slate-900 rounded-lg flex flex-col items-center justify-center text-white/60 space-y-3">
          <div className="w-10 h-10 border-4 border-white/20 border-t-white rounded-full animate-spin" />
          <p className="text-xs">Requesting media access...</p>
        </div>
      )}

      {recordingStatus === "recording" && (
        <div className="w-full max-w-lg relative rounded-lg overflow-hidden border border-border aspect-video bg-black shadow-lg">
          <video
            ref={previewVideoRef}
            autoPlay
            playsInline
            muted
            className="w-full h-full object-cover"
          />
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center justify-center">
            <button
              onClick={stopRecording}
              className="h-12 w-12 bg-red-600 hover:bg-red-700 text-white rounded-full flex items-center justify-center shadow-lg transition-transform hover:scale-105 cursor-pointer"
              title="Stop Recording"
            >
              <Square size={20} fill="white" />
            </button>
          </div>
        </div>
      )}

      {/* Review Screen */}
      {videoUrl && (
        <div className="w-full max-w-lg space-y-4">
          <div className="relative rounded-lg overflow-hidden border border-border aspect-video bg-black shadow-lg">
            <video
              ref={playbackVideoRef}
              src={videoUrl}
              controls
              playsInline
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex gap-3 justify-center">
            <button
              onClick={handleReset}
              className="h-10 px-4 border border-border bg-white text-navy font-bold hover:bg-surface text-xs rounded transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <RotateCcw size={14} /> Re-record
            </button>
            <button
              onClick={handleUseVideo}
              className="h-10 px-5 bg-success text-white font-bold hover:bg-success/90 text-xs rounded transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <CheckCircle size={14} /> Use Video response
            </button>
            {onCancel && (
              <button
                onClick={onCancel}
                className="h-10 px-4 border border-transparent text-text-secondary hover:underline text-xs"
              >
                Cancel
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
