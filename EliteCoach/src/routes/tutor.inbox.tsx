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
  startConversation,
  getConversationMessages,
  sendDirectMessage,
  extractErrorMessage,
  saveTutorPayoutAccount,
  type EscalatedSession,
  type TutorEarnings,
  type DirectConversation,
  type DirectMessage,
} from "@/lib/api-client";
import { VideoRecorder } from "@/components/VideoRecorder";
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

const AVAILABILITY_SLOTS = [
  { day: "Tomorrow", time: "09:00 AM", value: "2026-06-01T09:00:00" },
  { day: "Tomorrow", time: "11:00 AM", value: "2026-06-01T11:00:00" },
  { day: "Tomorrow", time: "02:00 PM", value: "2026-06-01T14:00:00" },
  { day: "Tomorrow", time: "04:00 PM", value: "2026-06-01T16:00:00" },
  { day: "Day after tomorrow", time: "10:00 AM", value: "2026-06-02T10:00:00" },
  { day: "Day after tomorrow", time: "01:00 PM", value: "2026-06-02T13:00:00" },
  { day: "Day after tomorrow", time: "03:00 PM", value: "2026-06-02T15:00:00" },
];

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

  // Direct Message states
  const [activeConversation, setActiveConversation] = useState<DirectConversation | null>(null);
  const [dmMessages, setDmMessages] = useState<DirectMessage[]>([]);
  const [dmInput, setDmInput] = useState("");
  const [sendingDm, setSendingDm] = useState(false);
  const [loadingDm, setLoadingDm] = useState(false);

  // Selection states
  const [replyText, setReplyText] = useState("");
  const [annotations, setAnnotations] = useState<Record<string, string>>({}); // msgId -> note
  const [annotatingMsgId, setAnnotatingMsgId] = useState<string | null>(null);
  const [activeAnnotationText, setActiveAnnotationText] = useState("");

  // Video recorder states
  const [videoUrl, setVideoUrl] = useState<string>("");

  // Calendar Booking States
  const [meetingLink, setMeetingLink] = useState("");
  const [meetingTime, setMeetingTime] = useState<string>("");

  // RAG correction states
  const [pushToRag, setPushToRag] = useState(false);
  const [ragSourceText, setRagSourceText] = useState("");

  // Payout Account states
  const [bankName, setBankName] = useState("");
  const [accountNumber, setAccountNumber] = useState("");
  const [savingBank, setSavingBank] = useState(false);

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

  const handleSavePayoutAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!bankName.trim() || !accountNumber.trim()) {
      toast.error("Please provide both Bank Name and Account Number.");
      return;
    }
    setSavingBank(true);
    try {
      await saveTutorPayoutAccount(bankName, accountNumber);
      toast.success("Payout account details saved successfully!");
    } catch (err) {
      toast.error("Failed to save payout account details.");
    } finally {
      setSavingBank(false);
    }
  };

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
      setPushToRag(false);
      setRagSourceText("");

      // Auto-populate RAG source with the user's issue topic if push is toggled later
      setRagSourceText(`Grounding fact for course: ${selectedEscalation.course_title}\n\nCorrection on topic: ${selectedEscalation.escalation_reason.replace("Learner asked", "Regarding").replace("Grounding block", "Outside context")}`);
    }
  }, [selectedId]);

  // Load Direct Message conversation for resolved escalations
  useEffect(() => {
    let active = true;
    if (selectedEscalation && selectedEscalation.status === "resolved") {
      const loadDm = async () => {
        setLoadingDm(true);
        try {
          const learnerId = selectedEscalation.learner_email;
          const subject = `Follow-up on: ${selectedEscalation.course_title}`;
          const conv = await startConversation(learnerId, subject);
          if (!active) return;
          setActiveConversation(conv);
          
          const msgs = await getConversationMessages(conv.id);
          if (!active) return;
          setDmMessages(msgs);
        } catch (e) {
          console.error("Failed to load DMs", e);
        } finally {
          if (active) setLoadingDm(false);
        }
      };
      loadDm();
    } else {
      setActiveConversation(null);
      setDmMessages([]);
    }
    return () => {
      active = false;
    };
  }, [selectedId, selectedEscalation?.status]);

  const handleSendDm = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeConversation || !dmInput.trim()) return;
    setSendingDm(true);
    try {
      const newMsg = await sendDirectMessage(activeConversation.id, dmInput.trim());
      setDmMessages((prev) => [...prev, newMsg]);
      setDmInput("");
      toast.success("Follow-up message sent!");
    } catch (e) {
      toast.error("Failed to send direct message");
    } finally {
      setSendingDm(false);
    }
  };

  // Assignment trigger
  const handleSelectEscalation = async (id: string) => {
    setSelectedId(id);
    const item = escalations.find(x => x.id === id);
    if (item && item.status === "open") {
      try {

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

  // (MediaRecorder and Calendar simulator logic removed)

  // 4. Resolve Submit
  const handleResolve = async () => {
    if (!selectedEscalation) return;

    if (actionTab === "text" && !replyText.trim()) {
      toast.error("Please enter a text reply for the learner.");
      return;
    }
    if (actionTab === "video" && !videoUrl) {
      toast.error("Please record a video response first.");
      return;
    }
    if (actionTab === "live" && !meetingTime) {
      toast.error("Please select a live session meeting slot.");
      return;
    }

    setSubmitting(true);
    try {
      const annotationsPayload = Object.entries(annotations).map(([id, text]) => ({
        id,
        text,
      }));

      const resolutionDetail = actionTab === "text" 
        ? replyText 
        : actionTab === "video" 
          ? "Video response recorded." 
          : `Live session scheduled at ${new Date(meetingTime).toLocaleString()}`;

      const payload: any = {
        resolution_type: actionTab === "text" ? "text" : actionTab === "video" ? "video" : "live_session",
        resolution_detail: resolutionDetail,
        correction_pushed_to_rag: pushToRag,
        annotations: annotationsPayload,
      };

      if (actionTab === "video" && videoUrl) {
        payload.video_url = videoUrl;
      }
      if (actionTab === "live" && meetingTime) {
        payload.meeting_time = meetingTime;
      }

      await submitEscalationResponse(selectedEscalation.id, payload);

      if (pushToRag && ragSourceText.trim()) {
        await pushCorrectionToRAG(selectedEscalation.course_id, selectedEscalation.course_title, ragSourceText);
      }

      toast.success("Response sent to the learner successfully!");

      // Update state locally
      setEscalations((prev) =>
        prev.map((item) =>
          item.id === selectedEscalation.id ? { 
            ...item, 
            status: "resolved",
            resolution_type: payload.resolution_type,
            resolution_detail: payload.resolution_detail,
            resolution_video_url: payload.video_url,
            resolution_meeting_time: payload.meeting_time,
            correction_pushed_to_rag: pushToRag
          } : item
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
              onClick={() => { setViewMode("inbox"); }}
              className={`px-4 py-2 rounded text-sm font-semibold flex items-center gap-2 transition-all cursor-pointer ${
                viewMode === "inbox" ? "bg-white text-navy shadow-lg" : "text-white/70 hover:text-white"
              }`}
            >
              <Inbox size={16} /> Queue
            </button>
            <button
              onClick={() => { setViewMode("earnings"); }}
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

              {/* PAYOUT SETTINGS */}
              <div className="card-base p-6 mt-6">
                <h3 className="font-semibold text-lg mb-4">Payout Settings</h3>
                <form onSubmit={handleSavePayoutAccount} className="space-y-4 max-w-md">
                  <div>
                    <label className="label-caps text-text-secondary block mb-2">Bank Name</label>
                    <input
                      type="text"
                      value={bankName}
                      onChange={(e) => setBankName(e.target.value)}
                      placeholder="e.g. Access Bank"
                      className="w-full h-11 px-4 border border-border outline-none text-sm bg-white rounded"
                    />
                  </div>
                  <div>
                    <label className="label-caps text-text-secondary block mb-2">Account Number (NUBAN)</label>
                    <input
                      type="text"
                      value={accountNumber}
                      onChange={(e) => setAccountNumber(e.target.value)}
                      placeholder="e.g. 0123456789"
                      maxLength={10}
                      className="w-full h-11 px-4 border border-border outline-none text-sm bg-white rounded font-mono"
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={savingBank}
                    className="h-11 px-6 bg-navy text-white font-bold hover:bg-navy/90 transition-all rounded shadow-sm disabled:opacity-50"
                  >
                    {savingBank ? "Saving..." : "Save Bank Details"}
                  </button>
                </form>
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
                      <div className="space-y-6">
                        {/* Resolved Detail Card */}
                        <div className="card-base p-6 border-l-4 border-l-success bg-success/5 border-success/30 flex items-start gap-4 animate-fade-in">
                          <CheckCircle size={24} className="text-success shrink-0 mt-1" />
                          <div className="flex-1">
                            <h3 className="font-bold text-success text-base">This session has been resolved</h3>
                            <p className="text-text-secondary text-sm mt-1">
                              Type: <strong className="capitalize">{selectedEscalation.resolution_type || "text"}</strong>
                            </p>
                            {selectedEscalation.resolution_meeting_time && (
                              <p className="text-xs text-text-primary mt-1 font-semibold">
                                Meeting Time: {new Date(selectedEscalation.resolution_meeting_time).toLocaleString()}
                              </p>
                            )}
                            {selectedEscalation.resolution_video_url && (
                              <div className="mt-3 aspect-video w-full max-w-sm rounded border border-border overflow-hidden bg-black">
                                <video src={selectedEscalation.resolution_video_url} controls className="w-full h-full" />
                              </div>
                            )}
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

                        {/* Direct Follow-up messaging panel */}
                        <div className="card-base p-0 overflow-hidden flex flex-col border border-border shadow-sm">
                          <div className="px-6 py-4 border-b border-border bg-navy/[0.02] flex items-center justify-between">
                            <h3 className="font-semibold text-sm flex items-center gap-1.5 text-navy">
                              <Send size={14} className="text-coral" /> Direct Follow-up Discuss Thread
                            </h3>
                            <span className="text-[10px] text-text-secondary bg-success/10 text-success px-2 py-0.5 rounded font-bold uppercase">
                              Active DM
                            </span>
                          </div>
                          
                          {loadingDm ? (
                            <div className="p-10 flex flex-col items-center justify-center text-text-secondary text-xs gap-2">
                              <div className="w-6 h-6 border-2 border-border border-t-primary rounded-full animate-spin" />
                              Loading messages...
                            </div>
                          ) : !activeConversation ? (
                            <div className="p-10 text-center space-y-4">
                              <p className="text-text-secondary text-xs">
                                Need to discuss details with the learner directly? You can start a follow-up DM thread.
                              </p>
                              <button
                                onClick={async () => {
                                  setLoadingDm(true);
                                  try {
                                    const conv = await startConversation(
                                      selectedEscalation.learner_email,
                                      `Follow-up on: ${selectedEscalation.course_title}`
                                    );
                                    setActiveConversation(conv);
                                  } catch (e) {
                                    toast.error("Failed to start thread");
                                  } finally {
                                    setLoadingDm(false);
                                  }
                                }}
                                className="h-10 px-5 bg-navy text-white text-xs font-bold rounded hover:bg-navy/90 transition-all cursor-pointer"
                              >
                                Start Follow-up Discussion
                              </button>
                            </div>
                          ) : (
                            <div className="flex flex-col">
                              {/* Messages list */}
                              <div className="p-6 space-y-4 max-h-[300px] overflow-y-auto bg-surface/30">
                                {dmMessages.length === 0 ? (
                                  <p className="text-xs text-text-secondary text-center italic py-4">
                                    No messages in this discussion yet. Send a message to start follow-up.
                                  </p>
                                ) : (
                                  dmMessages.map((msg) => {
                                    const isMe = msg.sender_id === "tutor-current";
                                    return (
                                      <div
                                        key={msg.id}
                                        className={`flex flex-col ${isMe ? "items-end" : "items-start"}`}
                                      >
                                        <div className="text-[9px] text-text-secondary mb-0.5 px-1 font-mono">
                                          {isMe ? "You (Tutor)" : selectedEscalation.learner_name} &bull; {new Date(msg.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                        </div>
                                        <div
                                          className={`max-w-[85%] px-3.5 py-2.5 rounded text-xs leading-relaxed ${
                                            isMe
                                              ? "bg-navy text-white font-medium rounded-br-none"
                                              : "bg-white text-text-primary border border-border rounded-bl-none shadow-sm"
                                          }`}
                                        >
                                          {msg.content}
                                        </div>
                                      </div>
                                    );
                                  })
                                )}
                              </div>
                              
                              {/* Input panel */}
                              <form onSubmit={handleSendDm} className="border-t border-border p-4 bg-white flex gap-2">
                                <input
                                  type="text"
                                  value={dmInput}
                                  onChange={(e) => setDmInput(e.target.value)}
                                  placeholder={`Send follow-up to ${selectedEscalation.learner_name}...`}
                                  className="flex-1 h-10 px-3.5 border border-border outline-none text-xs bg-surface-card rounded"
                                  disabled={sendingDm}
                                />
                                <button
                                  type="submit"
                                  disabled={sendingDm || !dmInput.trim()}
                                  className="h-10 px-4 bg-primary text-white rounded font-bold text-xs hover:bg-primary-hover transition-colors disabled:opacity-50 flex items-center justify-center cursor-pointer"
                                >
                                  {sendingDm ? "Sending..." : "Send"}
                                </button>
                              </form>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : (
                      /* ACTIVE ACTION INTERFACE */
                      <div className="card-base p-0 overflow-hidden">
                        <div className="flex border-b border-border bg-surface text-center">
                          <button
                            type="button"
                            onClick={() => setActionTab("text")}
                            className={`flex-1 h-12 inline-flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                              actionTab === "text" ? "border-primary text-primary bg-white font-bold" : "border-transparent text-text-secondary hover:text-text-primary font-medium"
                            }`}
                          >
                            <FileText size={15} /> Text Response
                          </button>
                          <button
                            type="button"
                            onClick={() => setActionTab("video")}
                            className={`flex-1 h-12 inline-flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                              actionTab === "video" ? "border-primary text-primary bg-white font-bold" : "border-transparent text-text-secondary hover:text-text-primary font-medium"
                            }`}
                          >
                            <Video size={15} /> Record Video
                          </button>
                          <button
                            type="button"
                            onClick={() => setActionTab("live")}
                            className={`flex-1 h-12 inline-flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-wider border-b-2 transition-all cursor-pointer ${
                              actionTab === "live" ? "border-primary text-primary bg-white font-bold" : "border-transparent text-text-secondary hover:text-text-primary font-medium"
                            }`}
                          >
                            <Calendar size={15} /> Live Booking
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

                          {/* TAB 2: Video Response */}
                          {actionTab === "video" && (
                            <div className="space-y-4">
                              <VideoRecorder 
                                onRecordComplete={(blob) => {
                                  const url = URL.createObjectURL(blob);
                                  setVideoUrl(url);
                                  toast.success("Video response recorded and attached!");
                                }} 
                                onCancel={() => setVideoUrl("")}
                              />
                              {videoUrl && (
                                <div className="bg-success/5 border border-success/20 rounded p-4 flex items-center justify-between text-xs animate-expand-down">
                                  <span className="text-success font-semibold flex items-center gap-1.5">
                                    <Check size={14} /> Ready to send recorded video response
                                  </span>
                                  <button onClick={() => setVideoUrl("")} className="text-destructive hover:underline">
                                    Discard
                                  </button>
                                </div>
                              )}
                            </div>
                          )}

                          {/* TAB 3: Live Session Booking */}
                          {actionTab === "live" && (
                            <div className="space-y-4">
                              <div>
                                <label className="label-caps text-text-secondary block mb-2">Select Availability Slot</label>
                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                  {AVAILABILITY_SLOTS.map((slot) => {
                                    const isSel = meetingTime === slot.value;
                                    return (
                                      <button
                                        key={slot.value}
                                        type="button"
                                        onClick={() => {
                                          setMeetingTime(slot.value);
                                          setMeetingLink(`https://meet.google.com/${Math.random().toString(36).substring(2, 5)}-${Math.random().toString(36).substring(2, 6)}-${Math.random().toString(36).substring(2, 5)}`);
                                        }}
                                        className={`p-3 text-left border rounded text-xs flex flex-col transition-colors cursor-pointer ${
                                          isSel ? "border-primary bg-primary/5 text-primary font-semibold animate-pulse" : "border-border hover:bg-slate-50 text-text-secondary"
                                        }`}
                                      >
                                        <span className="font-bold text-[10px] uppercase text-coral">{slot.day}</span>
                                        <span className="text-sm mt-0.5">{slot.time}</span>
                                      </button>
                                    );
                                  })}
                                </div>
                              </div>

                              <div className="grid sm:grid-cols-2 gap-3 pt-2">
                                <div>
                                  <label className="label-caps text-text-secondary block mb-2">Or Custom Date/Time</label>
                                  <input
                                    type="datetime-local"
                                    value={meetingTime}
                                    onChange={(e) => setMeetingTime(e.target.value)}
                                    className="w-full h-11 px-3 border border-border outline-none text-xs rounded bg-white"
                                  />
                                </div>
                                <div>
                                  <label className="label-caps text-text-secondary block mb-2">Meeting Link (Google Meet)</label>
                                  <div className="flex gap-2">
                                    <input
                                      type="text"
                                      value={meetingLink}
                                      onChange={(e) => setMeetingLink(e.target.value)}
                                      placeholder="https://meet.google.com/abc-defg-hij"
                                      className="flex-1 h-11 px-3 border border-border outline-none text-xs rounded bg-white font-mono"
                                    />
                                    <button
                                      type="button"
                                      onClick={() => setMeetingLink(`https://meet.google.com/${Math.random().toString(36).substring(2, 5)}-${Math.random().toString(36).substring(2, 6)}-${Math.random().toString(36).substring(2, 5)}`)}
                                      className="h-11 px-3 bg-navy text-white text-xs font-semibold rounded hover:bg-navy/95 cursor-pointer shrink-0"
                                    >
                                      Generate
                                    </button>
                                  </div>
                                </div>
                              </div>
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
