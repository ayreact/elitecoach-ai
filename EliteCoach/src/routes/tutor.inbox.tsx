import { createFileRoute, Link } from "@tanstack/react-router";
import { requireTutor } from "@/lib/auth-guard";
import { useEffect, useRef, useState } from "react";
import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";
import {
  getEscalations,
  submitEscalationResponse,
  getTutorEarnings,
  pushCorrectionToRAG,
  updateEscalationStatus,
  extractErrorMessage,
  type EscalatedSession,
  type TutorEarnings,
} from "@/lib/api-client";
import { toast } from "sonner";
import {
  Inbox,
  Video,
  Calendar,
  DollarSign,
  CheckCircle,
  Clock,
  AlertTriangle,
  Search,
  Send,
  Sparkles,
  Play,
  Square,
  RotateCcw,
  Camera,
  BookOpen,
  TrendingUp,
  User,
  ExternalLink,
  FileText,
  Check,
  Lock,
  Unlock,
  AlertCircle,
  ChevronRight,
  TrendingDown
} from "lucide-react";

export const Route = createFileRoute("/tutor/inbox")({
  beforeLoad: () => {
    requireTutor();
  },
  head: () => ({ meta: [{ title: "Tutor Inbox — EliteCoach" }] }),
  component: TutorInboxPage,
});

function TutorInboxPage() {
  const [escalations, setEscalations] = useState<EscalatedSession[]>([]);
  const [earnings, setEarnings] = useState<TutorEarnings | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "open" | "assigned" | "resolved">("open");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [viewMode, setViewMode] = useState<"inbox" | "earnings">("inbox");
  const [actionTab, setActionTab] = useState<"text" | "video" | "live">("text");

  // Selection states
  const [replyText, setReplyText] = useState("");
  const [annotations, setAnnotations] = useState<Record<string, string>>({}); // msgId -> note
  const [annotatingMsgId, setAnnotatingMsgId] = useState<string | null>(null);
  const [activeAnnotationText, setActiveAnnotationText] = useState("");

  // Video recorder states
  const [recState, setRecState] = useState<"idle" | "preview" | "recording" | "playback">("idle");
  const [mediaStream, setMediaStream] = useState<MediaStream | null>(null);
  const [mediaRecorder, setMediaRecorder] = useState<MediaRecorder | null>(null);
  const [recordedChunks, setRecordedChunks] = useState<Blob[]>([]);
  const [recordedVideoUrl, setRecordedVideoUrl] = useState<string | null>(null);
  const [recordedVideoBlob, setRecordedVideoBlob] = useState<Blob | null>(null);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const videoPreviewRef = useRef<HTMLVideoElement>(null);
  const videoPlaybackRef = useRef<HTMLVideoElement>(null);
  const recordingTimerRef = useRef<any>(null);

  // Calendar Booking States
  const [meetingLink, setMeetingLink] = useState("");
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedTimeSlot, setSelectedTimeSlot] = useState<string>("");

  // RAG correction states
  const [pushToRag, setPushToRag] = useState(false);
  const [ragSourceText, setRagSourceText] = useState("");

  // Load Initial Data
  const loadData = async () => {
    setLoading(true);
    try {
      const [escData, earnData] = await Promise.all([
        getEscalations(),
        getTutorEarnings(),
      ]);
      setEscalations(escData);
      setEarnings(earnData);

      // Select first open escalation by default if available
      const openCases = escData.filter(x => x.status === "open" || x.status === "assigned");
      if (openCases.length > 0) {
        setSelectedId(openCases[0].id);
        if (openCases[0].status === "open") {
          // Auto assign to me
          await updateEscalationStatus(openCases[0].id, "assigned");
          setEscalations(prev => prev.map(item => item.id === openCases[0].id ? { ...item, status: "assigned" } : item));
        }
      } else if (escData.length > 0) {
        setSelectedId(escData[0].id);
      }
    } catch (err) {
      toast.error("Failed to load Tutor Inbox data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filter & Search logic
  const filteredEscalations = escalations.filter((item) => {
    const matchesFilter = filter === "all" ? true : item.status === filter;
    const searchLower = search.toLowerCase();
    const matchesSearch =
      item.learner_name.toLowerCase().includes(searchLower) ||
      item.course_title.toLowerCase().includes(searchLower) ||
      item.escalation_reason.toLowerCase().includes(searchLower);
    return matchesFilter && matchesSearch;
  });

  const selectedEscalation = escalations.find((x) => x.id === selectedId);

  // Clean state when active item changes
  useEffect(() => {
    if (selectedEscalation) {
      setReplyText("");
      setAnnotations({});
      setAnnotatingMsgId(null);
      setActiveAnnotationText("");
      setActionTab("text");
      setMeetingLink("");
      setSelectedDate("");
      setSelectedTimeSlot("");
      setPushToRag(false);
      setRagSourceText("");
      stopWebcam();
      setRecState("idle");
      setRecordedVideoUrl(null);
      setRecordedVideoBlob(null);

      // Auto-populate RAG source with the user's issue topic if push is toggled later
      setRagSourceText(`Grounding fact for course: ${selectedEscalation.course_title}\n\nCorrection on topic: ${selectedEscalation.escalation_reason.replace("Learner asked", "Regarding").replace("Grounding block", "Outside context")}`);
    }
  }, [selectedId]);

  // Assignment trigger
  const handleSelectEscalation = async (id: string) => {
    setSelectedId(id);
    const item = escalations.find(x => x.id === id);
    if (item && item.status === "open") {
      try {
        await updateEscalationStatus(id, "assigned");
        setEscalations(prev =>
          prev.map(x => x.id === id ? { ...x, status: "assigned" } : x)
        );
        toast.info(`Escalation ${id} has been assigned to you`);
      } catch (err) {
        console.error(err);
      }
    }
  };

  // 1. Text annotations logic
  const openAnnotation = (msgId: string) => {
    setAnnotatingMsgId(msgId);
    setActiveAnnotationText(annotations[msgId] || "");
  };

  const saveAnnotation = () => {
    if (!annotatingMsgId) return;
    if (activeAnnotationText.trim()) {
      setAnnotations((prev) => ({ ...prev, [annotatingMsgId]: activeAnnotationText.trim() }));
      toast.success("Annotation attached to message");
    } else {
      const copy = { ...annotations };
      delete copy[annotatingMsgId];
      setAnnotations(copy);
    }
    setAnnotatingMsgId(null);
    setActiveAnnotationText("");
  };

  // 2. Video Recorder Logic (MediaRecorder API)
  const startWebcam = async () => {
    setRecState("idle");
    setRecordedVideoUrl(null);
    setRecordedVideoBlob(null);
    setRecordedChunks([]);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480, facingMode: "user" },
        audio: true,
      });
      setMediaStream(stream);
      setRecState("preview");
      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
      }
    } catch (err) {
      toast.error("Could not access camera/microphone. Please verify browser permissions.");
    }
  };

  const stopWebcam = () => {
    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => track.stop());
      setMediaStream(null);
    }
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
    }
  };

  const startRecording = () => {
    if (!mediaStream) return;
    setRecordedChunks([]);
    setRecordingSeconds(0);
    setRecState("recording");

    const recorder = new MediaRecorder(mediaStream, { mimeType: "video/webm" });
    setMediaRecorder(recorder);

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        setRecordedChunks((prev) => [...prev, event.data]);
      }
    };

    recorder.onstop = () => {
      // Compiled at stop
    };

    recorder.start(10); // Capture chunks every 10ms

    recordingTimerRef.current = setInterval(() => {
      setRecordingSeconds((prev) => prev + 1);
    }, 1000);
  };

  const stopRecording = () => {
    if (mediaRecorder && mediaRecorder.state !== "inactive") {
      mediaRecorder.stop();
    }
    stopWebcam();
    clearInterval(recordingTimerRef.current);
    setRecState("playback");
  };

  useEffect(() => {
    if (recState === "playback" && recordedChunks.length > 0) {
      const blob = new Blob(recordedChunks, { type: "video/webm" });
      const url = URL.createObjectURL(blob);
      setRecordedVideoUrl(url);
      setRecordedVideoBlob(blob);
      if (videoPlaybackRef.current) {
        videoPlaybackRef.current.src = url;
      }
    }
  }, [recState, recordedChunks]);

  const resetRecording = () => {
    setRecordedVideoUrl(null);
    setRecordedVideoBlob(null);
    setRecordedChunks([]);
    setRecordingSeconds(0);
    startWebcam();
  };

  // 3. Calendar booking simulator UI dates
  const getNext7Days = () => {
    const dates = [];
    const daysOfWeek = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    for (let i = 1; i <= 7; i++) {
      const d = new Date();
      d.setDate(d.getDate() + i);
      dates.push({
        raw: d.toISOString().split("T")[0],
        dayName: daysOfWeek[d.getDay()],
        dayNum: d.getDate(),
        month: d.toLocaleString("default", { month: "short" }),
      });
    }
    return dates;
  };

  const timeSlots = ["09:00 AM", "10:30 AM", "01:00 PM", "02:30 PM", "04:00 PM"];

  // 4. Resolve Submit
  const handleResolve = async () => {
    if (!selectedEscalation) return;

    if (actionTab === "text" && !replyText.trim()) {
      toast.error("Please enter a text reply for the learner.");
      return;
    }

    if (actionTab === "video" && !recordedVideoBlob) {
      toast.error("Please record a video response first.");
      return;
    }

    if (actionTab === "live" && (!selectedDate || !selectedTimeSlot)) {
      toast.error("Please select a date and time slot for the 1:1 session.");
      return;
    }

    setSubmitting(true);
    try {
      const annotationsPayload = Object.entries(annotations).map(([id, text]) => ({
        id,
        text,
      }));

      const meetingTime = actionTab === "live" ? `${selectedDate} ${selectedTimeSlot}` : undefined;
      const resolutionDetail =
        actionTab === "text"
          ? replyText
          : actionTab === "video"
            ? "Video feedback uploaded successfully."
            : `Live 1:1 consultation scheduled for ${selectedDate} at ${selectedTimeSlot}.${meetingLink ? ` Link: ${meetingLink}` : ""}`;

      await submitEscalationResponse(selectedEscalation.id, {
        resolution_type: actionTab === "live" ? "live_session" : actionTab,
        resolution_detail: resolutionDetail,
        video_blob: recordedVideoBlob || undefined,
        meeting_time: meetingTime,
        correction_pushed_to_rag: pushToRag,
        annotations: annotationsPayload,
      });

      if (pushToRag && ragSourceText.trim()) {
        await pushCorrectionToRAG(selectedEscalation.course_id, selectedEscalation.course_title, ragSourceText);
      }

      toast.success("Response sent to the learner successfully!");

      // Update state locally
      setEscalations((prev) =>
        prev.map((item) =>
          item.id === selectedEscalation.id ? { ...item, status: "resolved" } : item
        )
      );

      // Refresh earnings
      const earnData = await getTutorEarnings();
      setEarnings(earnData);

      // Reset selection
      setSelectedId(null);
    } catch (err) {
      toast.error(extractErrorMessage(err, "Failed to resolve escalation"));
    } finally {
      setSubmitting(false);
    }
  };

  const getUrgencyBadge = (urgency: string) => {
    switch (urgency) {
      case "high":
        return <span className="inline-flex items-center gap-1 bg-red-500/10 text-red-500 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Urgent</span>;
      case "medium":
        return <span className="inline-flex items-center gap-1 bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Medium</span>;
      default:
        return <span className="inline-flex items-center gap-1 bg-blue-500/10 text-blue-500 px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider">Normal</span>;
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-surface-card">
      <TopNav />

      {/* SUB-HEADER ACTION BAR */}
      <div className="bg-navy border-b border-white/10 text-white py-6">
        <div className="container-1200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="w-2.5 h-2.5 rounded-full bg-coral animate-pulse" />
              <span className="label-caps text-coral">Tutor Operations</span>
            </div>
            <h1 className="text-3xl font-bold tracking-tight">Tutor Inbox</h1>
          </div>
          <div className="flex bg-white/5 rounded-lg p-1 border border-white/10 shrink-0 self-start sm:self-auto">
            <button
              onClick={() => { setViewMode("inbox"); stopWebcam(); }}
              className={`px-4 py-2 rounded text-sm font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                viewMode === "inbox" ? "bg-white text-navy shadow-lg" : "text-white/70 hover:text-white"
              }`}
            >
              <Inbox size={16} /> Queue
            </button>
            <button
              onClick={() => { setViewMode("earnings"); stopWebcam(); }}
              className={`px-4 py-2 rounded text-sm font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                viewMode === "earnings" ? "bg-white text-navy shadow-lg" : "text-white/70 hover:text-white"
              }`}
            >
              <DollarSign size={16} /> Earnings
            </button>
          </div>
        </div>
      </div>

      {/* MAIN CONTAINER */}
      <div className="flex-1 bg-surface py-10 min-h-0">
        <div className="container-1200">
          
          {loading ? (
            <div className="card-base h-96 flex items-center justify-center">
              <div className="w-10 h-10 border-4 border-border border-t-primary rounded-full animate-spin" />
            </div>
          ) : viewMode === "earnings" ? (
            /* EARNINGS DASHBOARD VIEW */
            <div className="animate-fade-in-up duration-300">
              <div className="grid md:grid-cols-3 gap-6 mb-10">
                <div className="card-base p-6 border-l-4 border-l-success flex items-center justify-between">
                  <div>
                    <span className="label-caps text-text-secondary">Lifetime Earnings</span>
                    <h2 className="text-3xl font-bold mt-2">₦{(earnings?.total_paid || 0) + (earnings?.pending_payout || 0)}</h2>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-success/10 text-success flex items-center justify-center">
                    <TrendingUp size={22} />
                  </div>
                </div>
                <div className="card-base p-6 border-l-4 border-l-coral flex items-center justify-between">
                  <div>
                    <span className="label-caps text-text-secondary">Pending Payout</span>
                    <h2 className="text-3xl font-bold mt-2">₦{earnings?.pending_payout || 0}</h2>
                    <p className="text-xs text-text-secondary mt-1">Next transfer scheduled next Monday</p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-coral/10 text-coral flex items-center justify-center animate-pulse">
                    <Clock size={22} />
                  </div>
                </div>
                <div className="card-base p-6 border-l-4 border-l-navy flex items-center justify-between">
                  <div>
                    <span className="label-caps text-text-secondary">Resolved Cases</span>
                    <h2 className="text-3xl font-bold mt-2">{earnings?.total_resolved || 0}</h2>
                    <p className="text-xs text-text-secondary mt-1">₦5,000 commission per case</p>
                  </div>
                  <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                    <CheckCircle size={22} />
                  </div>
                </div>
              </div>

              <div className="card-base p-0 overflow-hidden">
                <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-navy/[0.02]">
                  <h3 className="font-semibold text-lg">Paystack Payout History</h3>
                  <span className="text-xs text-text-secondary font-mono">Currency: NGN</span>
                </div>
                <table className="w-full text-sm">
                  <thead className="bg-surface">
                    <tr className="text-left">
                      <th className="px-6 py-4 label-caps text-text-secondary">Date</th>
                      <th className="px-6 py-4 label-caps text-text-secondary">Reference</th>
                      <th className="px-6 py-4 label-caps text-text-secondary">Amount</th>
                      <th className="px-6 py-4 label-caps text-text-secondary text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {earnings?.payouts.map((pay) => (
                      <tr key={pay.id} className="hover:bg-navy/[0.01]">
                        <td className="px-6 py-4 font-mono text-xs">{pay.date}</td>
                        <td className="px-6 py-4 font-mono text-xs text-text-secondary">{pay.reference}</td>
                        <td className="px-6 py-4 font-bold text-navy">₦{pay.amount.toLocaleString()}</td>
                        <td className="px-6 py-4 text-right">
                          <span className={`inline-flex px-2 py-1 rounded text-xs font-bold uppercase tracking-wider ${
                            pay.status === "paid" ? "bg-success/10 text-success" : "bg-warning/10 text-warning animate-pulse"
                          }`}>
                            {pay.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* INBOX / ESCALATION WORKSPACE VIEW */
            <div className="grid lg:grid-cols-[380px_1fr] gap-8 items-start animate-fade-in-up duration-300">
              
              {/* SIDEBAR QUEUE */}
              <aside className="space-y-6">
                <div className="card-base p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-semibold text-base">Escalation Queue</h3>
                    <span className="bg-primary text-primary-foreground text-xs font-bold px-2 py-0.5 rounded-full">
                      {filteredEscalations.length}
                    </span>
                  </div>

                  {/* Search */}
                  <div className="relative mb-4">
                    <input
                      type="text"
                      placeholder="Search queue..."
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      className="w-full h-10 pl-9 pr-4 border border-border focus:border-primary outline-none text-sm bg-white rounded"
                    />
                    <Search className="absolute left-3 top-3 text-text-secondary" size={14} />
                  </div>

                  {/* Filter tabs */}
                  <div className="grid grid-cols-4 bg-surface rounded p-1 border border-border text-xs mb-2">
                    {(["all", "open", "assigned", "resolved"] as const).map((t) => (
                      <button
                        key={t}
                        onClick={() => setFilter(t)}
                        className={`py-1.5 rounded-sm capitalize font-medium text-center transition-all cursor-pointer ${
                          filter === t ? "bg-white shadow-sm font-bold text-primary" : "text-text-secondary hover:text-text-primary"
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Queue Cards list */}
                <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
                  {filteredEscalations.length === 0 ? (
                    <div className="card-base p-8 text-center text-text-secondary text-sm">
                      No escalations matching the filter.
                    </div>
                  ) : (
                    filteredEscalations.map((item) => {
                      const isSelected = item.id === selectedId;
                      return (
                        <div
                          key={item.id}
                          onClick={() => handleSelectEscalation(item.id)}
                          className={`card-base p-5 cursor-pointer border-l-4 transition-all hover:scale-[1.01] ${
                            isSelected
                              ? "bg-primary/[0.03] border-primary border-l-primary scale-[1.01] shadow-md"
                              : item.status === "resolved"
                                ? "border-success border-l-success border-border"
                                : item.status === "assigned"
                                  ? "border-amber-400 border-l-amber-400 border-border"
                                  : "border-red-400 border-l-red-400 border-border"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2 mb-2">
                            <span className="font-mono text-xs text-text-secondary">{item.id}</span>
                            {getUrgencyBadge(item.urgency)}
                          </div>
                          <h4 className="font-bold text-sm text-text-primary truncate">{item.learner_name}</h4>
                          <p className="text-xs text-text-secondary truncate mt-0.5">{item.course_title}</p>
                          <p className="text-xs text-text-secondary line-clamp-2 mt-2 bg-navy/[0.02] p-2 border border-border/40 rounded italic">
                            "{item.escalation_reason}"
                          </p>
                          <div className="flex items-center justify-between mt-3 pt-3 border-t border-border/50 text-[10px] text-text-secondary font-mono">
                            <span>{new Date(item.created_at).toLocaleDateString()}</span>
                            <span className="capitalize font-bold">{item.status}</span>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </aside>

              {/* WORKSPACE DETAILED PANEL */}
              <main className="min-w-0">
                {!selectedEscalation ? (
                  /* EMPTY STATE Dashboard Info */
                  <div className="card-base text-center py-20">
                    <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto mb-6">
                      <Inbox size={32} />
                    </div>
                    <h3 className="text-xl font-bold mb-2">No session selected</h3>
                    <p className="text-text-secondary text-sm max-w-sm mx-auto">
                      Select an escalation from the left queue to review the chat log, annotations, and send responses.
                    </p>
                  </div>
                ) : (
                  /* ESCALATION PANEL ACTIVE */
                  <div className="space-y-6">
                    {/* Header Learner details */}
                    <div className="card-base p-6 bg-navy text-white border-navy relative overflow-hidden">
                      <div className="absolute right-0 bottom-0 w-48 h-48 bg-white/[0.02] rounded-full translate-x-12 translate-y-12" />
                      <span className="label-caps text-coral mb-2 inline-block">Active Investigation</span>
                      <div className="flex items-start justify-between flex-wrap gap-4 relative z-10">
                        <div>
                          <h2 className="text-2xl font-bold">{selectedEscalation.learner_name}</h2>
                          <p className="text-white/60 text-sm mt-0.5">{selectedEscalation.learner_email}</p>
                          <p className="text-sm font-medium mt-3 inline-flex items-center gap-1.5 bg-white/10 px-3 py-1 rounded">
                            <BookOpen size={14} className="text-coral" /> {selectedEscalation.course_title}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className="font-mono text-xs text-white/50">{selectedEscalation.id}</span>
                          <div className="mt-2 flex items-center gap-2 justify-end">
                            {getUrgencyBadge(selectedEscalation.urgency)}
                            <span className="capitalize px-2.5 py-1 bg-white/10 text-white rounded text-xs font-bold border border-white/15">
                              {selectedEscalation.status}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className="mt-6 pt-4 border-t border-white/15 text-xs text-white/70 bg-black/10 p-3 rounded">
                        <strong>Reason:</strong> {selectedEscalation.escalation_reason}
                      </div>
                    </div>

                    {/* Chat log & annotations */}
                    <div className="card-base p-0 overflow-hidden flex flex-col">
                      <div className="px-6 py-4 border-b border-border flex items-center justify-between bg-navy/[0.02]">
                        <h3 className="font-semibold text-sm">Learner-AI Transcript</h3>
                        <span className="text-[10px] text-text-secondary bg-surface border border-border px-2.5 py-1 rounded">
                          💡 Tip: Click any AI response to add correction annotations
                        </span>
                      </div>
                      
                      <div className="p-6 space-y-6 max-h-[450px] overflow-y-auto bg-surface/50">
                        {selectedEscalation.transcript.map((msg) => {
                          const isUser = msg.role === "user";
                          const hasAnnotation = annotations[msg.id] || msg.annotation;
                          const activeAnnotation = annotations[msg.id] || msg.annotation;

                          return (
                            <div
                              key={msg.id}
                              className={`flex flex-col ${isUser ? "items-end animate-fade-in-up" : "items-start animate-fade-in-up"}`}
                            >
                              <div className="text-[10px] text-text-secondary mb-1 px-1 font-mono">
                                {isUser ? "Learner" : "EliteCoach AI"} &bull; {new Date(msg.ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </div>
                              <div
                                onClick={() => !isUser && openAnnotation(msg.id)}
                                className={`relative group max-w-[85%] px-4 py-3 rounded text-sm leading-relaxed transition-all ${
                                  isUser
                                    ? "bg-primary text-primary-foreground font-medium"
                                    : `bg-white text-text-primary border hover:border-primary cursor-pointer shadow-sm ${
                                        hasAnnotation ? "border-coral/60 ring-1 ring-coral/10" : "border-border"
                                      }`
                                }`}
                              >
                                {msg.content}
                                {!isUser && (
                                  <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity bg-surface border border-border p-1 rounded-sm shadow-md">
                                    <Sparkles size={11} className="text-primary" />
                                  </div>
                                )}
                              </div>

                              {/* Annotations details box */}
                              {activeAnnotation && (
                                <div className="mt-2 text-xs flex gap-2 items-start bg-coral/5 border border-coral/20 p-3 rounded-md max-w-[80%] animate-expand-down">
                                  <Sparkles size={14} className="text-coral shrink-0 mt-0.5" />
                                  <div>
                                    <span className="font-bold text-coral block mb-0.5">Tutor Correction Annotation:</span>
                                    <span className="text-text-primary italic">"{activeAnnotation}"</span>
                                    {selectedEscalation.status !== "resolved" && (
                                      <button
                                        onClick={() => {
                                          const copy = { ...annotations };
                                          delete copy[msg.id];
                                          setAnnotations(copy);
                                        }}
                                        className="text-[10px] text-destructive hover:underline block mt-2"
                                      >
                                        Delete Annotation
                                      </button>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      {/* Modal overlay inline for active annotation editing */}
                      {annotatingMsgId && (
                        <div className="p-4 border-t border-border bg-coral/5 flex flex-col sm:flex-row gap-3 items-end animate-expand-down">
                          <div className="flex-1 w-full">
                            <label className="text-xs font-bold text-coral block mb-1">
                              Annotate AI response error for this message
                            </label>
                            <input
                              type="text"
                              value={activeAnnotationText}
                              onChange={(e) => setActiveAnnotationText(e.target.value)}
                              placeholder="e.g. Regularization constants shouldn't be zero. Actually Lasso does sparsity..."
                              className="w-full h-10 px-3 border border-border outline-none text-sm bg-white rounded"
                              onKeyDown={(e) => e.key === "Enter" && saveAnnotation()}
                            />
                          </div>
                          <div className="flex gap-2 w-full sm:w-auto">
                            <button
                              onClick={() => setAnnotatingMsgId(null)}
                              className="h-10 px-4 border border-border text-xs rounded bg-white hover:bg-surface transition-colors"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={saveAnnotation}
                              className="h-10 px-4 bg-coral text-white text-xs font-bold rounded hover:opacity-90 transition-opacity"
                            >
                              Save Annotation
                            </button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* ACTIONS RESOLUTION BLOCK */}
                    {selectedEscalation.status === "resolved" ? (
                      /* Resolved Detail Card */
                      <div className="card-base p-6 border-l-4 border-l-success bg-success/5 border-success/30 flex items-start gap-4">
                        <CheckCircle size={24} className="text-success shrink-0 mt-1" />
                        <div>
                          <h3 className="font-bold text-success text-base">This session has been resolved</h3>
                          <p className="text-text-secondary text-sm mt-1">
                            Type: <strong className="capitalize">{selectedEscalation.resolution_type || "text"}</strong>
                          </p>
                          <div className="mt-4 text-sm text-text-primary bg-white/70 p-4 border border-border rounded italic">
                            "{selectedEscalation.resolution_detail}"
                          </div>
                          {selectedEscalation.correction_pushed_to_rag && (
                            <div className="mt-3 flex items-center gap-1.5 text-xs text-primary font-bold">
                              <Sparkles size={14} /> Pushed to AI vector store grounding index.
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      /* ACTIVE ACTION INTERFACE */
                      <div className="card-base p-0 overflow-hidden">
                        <div className="flex border-b border-border bg-surface">
                          <button
                            onClick={() => setActionTab("text")}
                            className={`flex-1 h-12 inline-flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                              actionTab === "text" ? "border-primary text-primary bg-white" : "border-transparent text-text-secondary hover:text-text-primary"
                            }`}
                          >
                            <FileText size={16} /> Text & Annotations
                          </button>
                          <button
                            onClick={() => { setActionTab("video"); startWebcam(); }}
                            className={`flex-1 h-12 inline-flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                              actionTab === "video" ? "border-primary text-primary bg-white" : "border-transparent text-text-secondary hover:text-text-primary"
                            }`}
                          >
                            <Video size={16} /> Record Video Response
                          </button>
                          <button
                            onClick={() => { setActionTab("live"); stopWebcam(); }}
                            className={`flex-1 h-12 inline-flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                              actionTab === "live" ? "border-primary text-primary bg-white" : "border-transparent text-text-secondary hover:text-text-primary"
                            }`}
                          >
                            <Calendar size={16} /> Schedule 1:1
                          </button>
                        </div>

                        <div className="p-6">
                          
                          {/* TAB 1: Text Response */}
                          {actionTab === "text" && (
                            <div className="space-y-4">
                              <div>
                                <label className="label-caps text-text-secondary block mb-2">Write your explanation response</label>
                                <textarea
                                  value={replyText}
                                  onChange={(e) => setReplyText(e.target.value)}
                                  rows={5}
                                  placeholder="Provide the correct conceptual answer, explain what the AI missed, and guide the learner..."
                                  className="w-full px-4 py-3 border border-border focus:border-primary outline-none text-sm bg-white rounded resize-none"
                                />
                              </div>
                              {Object.keys(annotations).length > 0 && (
                                <div className="bg-coral/5 border border-coral/20 rounded p-4">
                                  <h4 className="text-xs font-bold text-coral mb-2">Attached Corrections:</h4>
                                  <ul className="list-disc list-inside text-xs text-text-secondary space-y-1">
                                    {Object.entries(annotations).map(([id, note]) => (
                                      <li key={id} className="truncate">
                                        Note: "{note}"
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              )}
                            </div>
                          )}

                          {/* TAB 2: Video Response using MediaRecorder */}
                          {actionTab === "video" && (
                            <div className="space-y-4">
                              <span className="label-caps text-text-secondary block mb-2">In-Browser Video Feedback Tool</span>
                              
                              <div className="aspect-video w-full max-w-lg mx-auto bg-black rounded-lg overflow-hidden border border-border relative flex items-center justify-center">
                                {/* Live webcam preview */}
                                {recState === "preview" || recState === "recording" ? (
                                  <>
                                    <video
                                      ref={videoPreviewRef}
                                      autoPlay
                                      playsInline
                                      muted
                                      className="w-full h-full object-cover"
                                    />
                                    {recState === "recording" && (
                                      <div className="absolute top-4 left-4 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded flex items-center gap-1.5 animate-pulse">
                                        <div className="w-2 h-2 bg-white rounded-full" />
                                        REC &bull; {Math.floor(recordingSeconds / 60)}:{String(recordingSeconds % 60).padStart(2, "0")}
                                      </div>
                                    )}
                                  </>
                                ) : recState === "playback" ? (
                                  /* playback element */
                                  <video
                                    ref={videoPlaybackRef}
                                    controls
                                    className="w-full h-full object-cover"
                                  />
                                ) : (
                                  /* Idle placeholder */
                                  <div className="text-center p-8">
                                    <Camera size={48} className="text-white/20 mx-auto mb-4" />
                                    <button
                                      onClick={startWebcam}
                                      className="h-10 px-5 bg-white text-navy text-xs font-bold rounded hover:bg-slate-100 transition-colors"
                                    >
                                      Initialize Webcam
                                    </button>
                                  </div>
                                )}
                              </div>

                              <div className="flex justify-center gap-3">
                                {recState === "preview" && (
                                  <button
                                    onClick={startRecording}
                                    className="h-10 px-5 bg-red-600 hover:bg-red-700 text-white text-xs font-bold rounded flex items-center gap-2 transition-colors cursor-pointer"
                                  >
                                    <Play size={14} /> Start Recording
                                  </button>
                                )}
                                {recState === "recording" && (
                                  <button
                                    onClick={stopRecording}
                                    className="h-10 px-5 bg-navy border border-white/20 text-white text-xs font-bold rounded flex items-center gap-2 transition-colors cursor-pointer"
                                  >
                                    <Square size={14} /> Stop Recording
                                  </button>
                                )}
                                {recState === "playback" && (
                                  <>
                                    <button
                                      onClick={resetRecording}
                                      className="h-10 px-5 border border-border text-xs font-bold rounded hover:bg-surface transition-colors flex items-center gap-2 cursor-pointer bg-white"
                                    >
                                      <RotateCcw size={14} /> Re-Record
                                    </button>
                                  </>
                                )}
                              </div>
                            </div>
                          )}

                          {/* TAB 3: Schedule 1:1 Live Simulator */}
                          {actionTab === "live" && (
                            <div className="space-y-6">
                              <div>
                                <label className="label-caps text-text-secondary block mb-2">Meeting Link (Zoom / Google Meet)</label>
                                <input
                                  type="text"
                                  value={meetingLink}
                                  onChange={(e) => setMeetingLink(e.target.value)}
                                  placeholder="e.g. https://zoom.us/j/938204928"
                                  className="w-full h-11 px-4 border border-border outline-none text-sm bg-white rounded font-mono"
                                />
                              </div>

                              {/* Calendar booking widget */}
                              <div>
                                <label className="label-caps text-text-secondary block mb-3">Select Date slot</label>
                                <div className="grid grid-cols-4 sm:grid-cols-7 gap-2">
                                  {getNext7Days().map((day) => {
                                    const isSel = selectedDate === day.raw;
                                    return (
                                      <button
                                        key={day.raw}
                                        type="button"
                                        onClick={() => setSelectedDate(day.raw)}
                                        className={`p-3 rounded border text-center transition-all cursor-pointer ${
                                          isSel
                                            ? "border-primary bg-primary/5 text-primary scale-105 font-bold"
                                            : "border-border hover:border-slate-300 bg-white text-text-secondary"
                                        }`}
                                      >
                                        <div className="text-[10px] uppercase font-mono">{day.dayName}</div>
                                        <div className="text-lg font-bold my-0.5">{day.dayNum}</div>
                                        <div className="text-[10px]">{day.month}</div>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              {/* Time selection */}
                              {selectedDate && (
                                <div className="animate-expand-down">
                                  <label className="label-caps text-text-secondary block mb-3">Select Available Time slot</label>
                                  <div className="flex flex-wrap gap-2">
                                    {timeSlots.map((slot) => {
                                      const isSel = selectedTimeSlot === slot;
                                      return (
                                        <button
                                          key={slot}
                                          type="button"
                                          onClick={() => setSelectedTimeSlot(slot)}
                                          className={`px-4 py-2 text-xs font-semibold rounded border transition-all cursor-pointer ${
                                            isSel
                                              ? "border-primary bg-primary text-primary-foreground scale-105 font-bold"
                                              : "border-border hover:border-slate-300 bg-white text-text-secondary"
                                          }`}
                                        >
                                          {slot}
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Grounding & RAG section */}
                          <div className="mt-8 pt-6 border-t border-border space-y-4">
                            <label className="flex items-center gap-3 cursor-pointer group">
                              <input
                                type="checkbox"
                                checked={pushToRag}
                                onChange={(e) => setPushToRag(e.target.checked)}
                                className="w-5 h-5 accent-primary rounded cursor-pointer"
                              />
                              <div>
                                <span className="text-sm font-bold group-hover:text-primary transition-colors block">
                                  Ingest correction facts into AI Knowledge Base (RAG)
                                </span>
                                <span className="text-xs text-text-secondary">
                                  Locks this context so the AI tutor learns from your inputs and corrects future responses.
                                </span>
                              </div>
                            </label>

                            {pushToRag && (
                              <div className="animate-expand-down">
                                <label className="label-caps text-text-secondary block mb-2">Grounding facts text</label>
                                <textarea
                                  rows={4}
                                  value={ragSourceText}
                                  onChange={(e) => setRagSourceText(e.target.value)}
                                  className="w-full px-4 py-3 border border-border focus:border-primary outline-none text-xs bg-white rounded font-mono leading-relaxed"
                                />
                              </div>
                            )}
                          </div>

                          {/* SUBMIT BUTTON */}
                          <button
                            onClick={handleResolve}
                            disabled={submitting}
                            className="w-full h-12 mt-8 bg-primary text-primary-foreground font-bold hover:bg-primary-hover flex items-center justify-center gap-2 transition-colors disabled:opacity-50 active:scale-[0.99] shadow"
                          >
                            {submitting ? (
                              <>
                                <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin" />
                                Processing Resolution...
                              </>
                            ) : (
                              <>
                                <Send size={16} /> Resolve Escalation & Submit
                              </>
                            )}
                          </button>

                        </div>
                      </div>
                    )}
                  </div>
                )}
              </main>
            </div>
          )}
        </div>
      </div>
      <Footer />
    </div>
  );
}
