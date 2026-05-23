import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { requireLearner } from "@/lib/auth-guard";
import { useEffect, useState } from "react";
import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";
import { useAuthStore } from "@/lib/stores";
import {
  getDiagnosticQuestions,
  submitOnboardingDiagnostic,
  extractErrorMessage,
  type DiagnosticQuestion,
} from "@/lib/api-client";
import { toast } from "sonner";
import {
  ArrowRight,
  ArrowLeft,
  Sparkles,
  BookOpen,
  Code2,
  LineChart,
  Briefcase,
  Users,
  CheckCircle,
  HelpCircle,
  Clock,
  Zap,
} from "lucide-react";

export const Route = createFileRoute("/onboarding")({
  beforeLoad: () => {
    requireLearner();
  },
  head: () => ({ meta: [{ title: "Onboarding — EliteCoach" }] }),
  component: OnboardingPage,
});

const DOMAINS_LIST = [
  {
    key: "technology",
    name: "Technology & Software",
    description: "Web development, system designs, cloud services, and architectures.",
    icon: Code2,
    accent: "bg-primary/10 text-primary border-primary/20",
    color: "primary",
  },
  {
    key: "data",
    name: "Data & Analytics",
    description: "SQL, Python pandas, database structures, and machine learning models.",
    icon: LineChart,
    accent: "bg-coral/10 text-coral border-coral/20",
    color: "coral",
  },
  {
    key: "finance",
    name: "Finance & Accounting",
    description: "Financial valuations, balance sheets, corporate accounting, and M&A.",
    icon: Briefcase,
    accent: "bg-success/10 text-success border-success/20",
    color: "success",
  },
  {
    key: "leadership",
    name: "Leadership & Management",
    description: "Agile processes, Scrum operations, conflict resolution, and scaling.",
    icon: Users,
    accent: "bg-navy/10 text-navy border-navy/20",
    color: "navy",
  },
];

function OnboardingPage() {
  const user = useAuthStore((s) => s.user);
  const navigate = useNavigate();
  const userId = user?.id ?? user?.userId ?? "learner";

  // Stepper state
  const [step, setStep] = useState(1); // 1: Goal, 2: Background, 3: Skill Check, 4: Generating Path

  // Step 1: Goal Selection
  const [selectedDomain, setSelectedDomain] = useState("technology");
  const [customGoal, setCustomGoal] = useState("");
  const [hoursPerWeek, setHoursPerWeek] = useState(10);

  // Step 2: Experience & Background
  const [experience, setExperience] = useState<"beginner" | "intermediate" | "advanced">("beginner");
  const [currentRole, setCurrentRole] = useState("");

  // Step 3: Diagnostic MCQ Check
  const [questions, setQuestions] = useState<DiagnosticQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [activeQuestionIdx, setActiveQuestionIdx] = useState(0);

  // Step 4: Loading & Generation State
  const [generating, setGenerating] = useState(false);
  const [generatedPathResult, setGeneratedPathResult] = useState<any>(null);
  const [loadingStep, setLoadingStep] = useState(0);

  // Load questions for the selected domain when step 3 starts
  useEffect(() => {
    if (step === 3) {
      getDiagnosticQuestions(selectedDomain)
        .then((res) => {
          setQuestions(res);
          setAnswers({});
          setActiveQuestionIdx(0);
        })
        .catch(() => {
          toast.error("Failed to load diagnostic questions");
        });
    }
  }, [step, selectedDomain]);

  // Loading stepper simulation for Step 4
  useEffect(() => {
    if (step === 4 && generating) {
      const timers = [
        setTimeout(() => setLoadingStep(1), 1000),
        setTimeout(() => setLoadingStep(2), 2200),
        setTimeout(() => setLoadingStep(3), 3500),
        setTimeout(() => {
          setGenerating(false);
          setLoadingStep(4);
        }, 4800),
      ];
      return () => timers.forEach(clearTimeout);
    }
  }, [step, generating]);

  // Form Validations
  const validateStep1 = () => {
    if (!customGoal.trim()) {
      toast.error("Please specify your target career goal.");
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    if (!currentRole.trim()) {
      toast.error("Please enter your current job role or status.");
      return false;
    }
    return true;
  };

  const handleNextStep = () => {
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    setStep((s) => s + 1);
  };

  const handlePrevStep = () => {
    setStep((s) => Math.max(1, s - 1));
  };

  // Submit diagnostic
  const triggerGeneration = async () => {
    // Basic verification check: verify all diagnostic questions are answered
    const unanswered = questions.some((q) => !answers[q.id]);
    if (unanswered) {
      toast.error("Please answer all diagnostic questions to help personalize your learning path.");
      return;
    }

    setStep(4);
    setGenerating(true);
    setLoadingStep(0);
    try {
      const pathResult = await submitOnboardingDiagnostic(userId, {
        goal: customGoal.trim(),
        domain: selectedDomain,
        experience,
        hours_per_week: hoursPerWeek,
        answers,
      });
      setGeneratedPathResult(pathResult);
    } catch (err) {
      toast.error(extractErrorMessage(err, "Path generation failed"));
      setStep(3); // return back
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-surface-card">
      <TopNav />

      {/* HEADER BANNER */}
      <div className="bg-navy border-b border-white/10 text-white py-12 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-r from-primary/10 to-coral/10 pointer-events-none" />
        <div className="container-1200 relative z-10 text-center max-w-2xl mx-auto">
          <span className="label-caps text-coral mb-3 inline-block">Adaptive Engine v1</span>
          <h1 className="text-4xl font-bold tracking-tight mb-3">Onboarding Roadmap Wizard</h1>
          <p className="text-white/70 text-sm">
            Let's evaluate your background, test your current skills, and generate a customized study path that skips what you already know.
          </p>
        </div>
      </div>

      {/* STEPPER PROGRESS TRACK */}
      {step < 4 && (
        <div className="bg-white border-b border-border py-4">
          <div className="container-1200 max-w-lg mx-auto flex items-center justify-between text-xs font-bold text-text-secondary uppercase tracking-wider">
            <span className={`flex items-center gap-1.5 ${step >= 1 ? "text-primary" : ""}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center border ${step >= 1 ? "border-primary bg-primary text-white" : "border-border"}`}>1</span> Goal
            </span>
            <div className={`h-0.5 flex-1 mx-4 ${step >= 2 ? "bg-primary" : "bg-border"}`} />
            <span className={`flex items-center gap-1.5 ${step >= 2 ? "text-primary" : ""}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center border ${step >= 2 ? "border-primary bg-primary text-white" : "border-border"}`}>2</span> Profile
            </span>
            <div className={`h-0.5 flex-1 mx-4 ${step >= 3 ? "bg-primary" : "bg-border"}`} />
            <span className={`flex items-center gap-1.5 ${step >= 3 ? "text-primary" : ""}`}>
              <span className={`w-5 h-5 rounded-full flex items-center justify-center border ${step >= 3 ? "border-primary bg-primary text-white" : "border-border"}`}>3</span> Skills
            </span>
          </div>
        </div>
      )}

      {/* CORE WORKSPACE */}
      <div className="flex-1 bg-surface py-10">
        <div className="container-1200 max-w-xl mx-auto">

          {/* STEP 1: GOAL & DOMAIN SELECTION */}
          {step === 1 && (
            <div className="card-base p-8 space-y-8 animate-fade-in-up duration-300">
              <div>
                <h3 className="text-xl font-bold text-text-primary mb-2">What domain fits your career?</h3>
                <p className="text-text-secondary text-sm">Select the subject area you want to develop.</p>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                {DOMAINS_LIST.map((dom) => {
                  const Icon = dom.icon;
                  const isSelected = selectedDomain === dom.key;
                  return (
                    <div
                      key={dom.key}
                      onClick={() => setSelectedDomain(dom.key)}
                      className={`card-base p-5 cursor-pointer border-2 transition-all hover:scale-[1.01] ${
                        isSelected
                          ? "border-primary bg-primary/[0.02] shadow"
                          : "border-border hover:border-slate-300"
                      }`}
                    >
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center mb-3 ${dom.accent}`}>
                        <Icon size={20} />
                      </div>
                      <h4 className="font-bold text-sm text-text-primary">{dom.name}</h4>
                      <p className="text-xs text-text-secondary mt-1 leading-relaxed">{dom.description}</p>
                    </div>
                  );
                })}
              </div>

              <div className="space-y-4 pt-4 border-t border-border">
                <div>
                  <label className="label-caps text-text-secondary block mb-2">What is your specific target career goal?</label>
                  <input
                    type="text"
                    value={customGoal}
                    onChange={(e) => setCustomGoal(e.target.value)}
                    placeholder="e.g. Senior Machine Learning Engineer, Financial Controller"
                    className="w-full h-12 px-4 border border-border focus:border-primary outline-none text-sm bg-white rounded"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-2">
                    <label className="label-caps text-text-secondary">Study Dedication Intensity</label>
                    <span className="text-sm font-bold text-primary font-mono">{hoursPerWeek} hours / week</span>
                  </div>
                  <input
                    type="range"
                    min={3}
                    max={40}
                    value={hoursPerWeek}
                    onChange={(e) => setHoursPerWeek(Number(e.target.value))}
                    className="w-full accent-primary cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-text-secondary font-mono mt-1">
                    <span>3 hrs (Light)</span>
                    <span>15 hrs (Moderate)</span>
                    <span>40 hrs (Full-Time)</span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleNextStep}
                className="w-full h-12 bg-primary text-primary-foreground font-bold hover:bg-primary-hover flex items-center justify-center gap-2 rounded transition-colors"
              >
                Proceed to Experience Profile <ArrowRight size={16} />
              </button>
            </div>
          )}

          {/* STEP 2: EXPERIENCE & BACKGROUND */}
          {step === 2 && (
            <div className="card-base p-8 space-y-8 animate-fade-in-up duration-300">
              <div>
                <h3 className="text-xl font-bold text-text-primary mb-2">Tell us about your background</h3>
                <p className="text-text-secondary text-sm">We'll adjust the starting level based on your history.</p>
              </div>

              <div className="space-y-5">
                <div>
                  <label className="label-caps text-text-secondary block mb-3">Self-Assessed Experience Level</label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { key: "beginner", title: "Beginner", desc: "No experience" },
                      { key: "intermediate", title: "Intermediate", desc: "1-3 years experience" },
                      { key: "advanced", title: "Advanced", desc: "3+ years experience" },
                    ].map((lvl) => {
                      const isSel = experience === lvl.key;
                      return (
                        <button
                          key={lvl.key}
                          type="button"
                          onClick={() => setExperience(lvl.key as any)}
                          className={`p-4 border rounded text-center transition-all cursor-pointer ${
                            isSel
                              ? "border-primary bg-primary/[0.02] font-bold text-primary scale-102"
                              : "border-border hover:border-slate-300 bg-white"
                          }`}
                        >
                          <div className="text-sm">{lvl.title}</div>
                          <div className="text-[10px] text-text-secondary font-normal mt-1 leading-none">{lvl.desc}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div>
                  <label className="label-caps text-text-secondary block mb-2">Current Job Title or Occupation</label>
                  <input
                    type="text"
                    value={currentRole}
                    onChange={(e) => setCurrentRole(e.target.value)}
                    placeholder="e.g. Student, Junior Web Developer, Financial Intern"
                    className="w-full h-12 px-4 border border-border focus:border-primary outline-none text-sm bg-white rounded"
                  />
                </div>
              </div>

              <div className="flex gap-3 pt-4 border-t border-border">
                <button
                  onClick={handlePrevStep}
                  className="flex-1 h-12 border border-border font-bold hover:bg-surface flex items-center justify-center gap-2 rounded bg-white"
                >
                  <ArrowLeft size={16} /> Back
                </button>
                <button
                  onClick={handleNextStep}
                  className="flex-[2] h-12 bg-primary text-primary-foreground font-bold hover:bg-primary-hover flex items-center justify-center gap-2 rounded transition-colors"
                >
                  Start Diagnostic Test <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: SKILLS DIAGNOSTIC MCQ CHECK */}
          {step === 3 && questions.length > 0 && (
            <div className="card-base p-8 space-y-8 animate-fade-in-up duration-300">
              <div className="flex items-center justify-between border-b border-border pb-4">
                <div>
                  <h3 className="font-bold text-lg text-text-primary">Skills Check Question {activeQuestionIdx + 1} of {questions.length}</h3>
                  <span className="text-xs text-text-secondary capitalize">{selectedDomain} domain evaluation</span>
                </div>
                <span className="font-mono text-xs text-text-secondary">
                  {Math.round(((activeQuestionIdx + 1) / questions.length) * 100)}%
                </span>
              </div>

              {/* Question prompt */}
              <div className="space-y-6">
                <h4 className="text-xl font-bold leading-snug text-text-primary">
                  {questions[activeQuestionIdx].question}
                </h4>

                <div className="space-y-3">
                  {questions[activeQuestionIdx].options.map((opt) => {
                    const isSelected = answers[questions[activeQuestionIdx].id] === opt;
                    return (
                      <button
                        key={opt}
                        type="button"
                        onClick={() =>
                          setAnswers((prev) => ({ ...prev, [questions[activeQuestionIdx].id]: opt }))
                        }
                        className={`w-full text-left p-4 border-2 transition-colors rounded ${
                          isSelected
                            ? "border-primary bg-primary/[0.02]"
                            : "border-border bg-white hover:border-slate-300"
                        }`}
                      >
                        <span className="text-sm font-medium">{opt}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Stepper actions */}
              <div className="flex justify-between gap-3 pt-6 border-t border-border">
                <button
                  type="button"
                  onClick={() => setActiveQuestionIdx((idx) => Math.max(0, idx - 1))}
                  disabled={activeQuestionIdx === 0}
                  className="h-11 px-4 border border-border text-xs font-bold rounded bg-white hover:bg-surface transition-colors disabled:opacity-50"
                >
                  &larr; Previous
                </button>

                {activeQuestionIdx === questions.length - 1 ? (
                  <button
                    type="button"
                    onClick={triggerGeneration}
                    disabled={!answers[questions[activeQuestionIdx].id]}
                    className="h-11 px-6 bg-coral text-white text-xs font-bold rounded hover:opacity-90 transition-opacity disabled:opacity-50 flex items-center gap-1.5"
                  >
                    <Sparkles size={14} /> Submit & Generate Path
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => setActiveQuestionIdx((idx) => idx + 1)}
                    disabled={!answers[questions[activeQuestionIdx].id]}
                    className="h-11 px-6 bg-primary text-white text-xs font-bold rounded hover:bg-primary-hover transition-colors disabled:opacity-50"
                  >
                    Next &rarr;
                  </button>
                )}
              </div>
            </div>
          )}

          {/* STEP 4: LOADERS & SUCCESS RESULT SCREEN */}
          {step === 4 && (
            <div className="card-base p-8 text-center space-y-8 animate-fade-in-up duration-300">
              {generating ? (
                /* LOADING STAGE */
                <div className="py-12 space-y-6">
                  <div className="w-16 h-16 border-4 border-border border-t-primary rounded-full animate-spin mx-auto mb-6" />
                  <h3 className="text-2xl font-bold">Assembling Customized Path...</h3>
                  
                  {/* Step indicators */}
                  <div className="max-w-xs mx-auto space-y-3 text-left text-sm font-medium text-text-secondary">
                    <div className="flex items-center gap-3">
                      {loadingStep >= 1 ? <CheckCircle size={18} className="text-success shrink-0" /> : <div className="w-4 h-4 border border-border rounded-full shrink-0" />}
                      <span className={loadingStep >= 1 ? "text-text-primary" : ""}>Evaluating diagnostic score</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {loadingStep >= 2 ? <CheckCircle size={18} className="text-success shrink-0" /> : <div className="w-4 h-4 border border-border rounded-full shrink-0 animate-pulse" />}
                      <span className={loadingStep >= 2 ? "text-text-primary" : ""}>Scoring experience profile gaps</span>
                    </div>
                    <div className="flex items-center gap-3">
                      {loadingStep >= 3 ? <CheckCircle size={18} className="text-success shrink-0" /> : <div className="w-4 h-4 border border-border rounded-full shrink-0" />}
                      <span className={loadingStep >= 3 ? "text-text-primary" : ""}>Applying rule-based modular skips</span>
                    </div>
                  </div>
                </div>
              ) : (
                /* PATH GENERATION SUCCESS SUMMARY */
                <div className="space-y-6 animate-scale-up duration-300">
                  <div className="w-16 h-16 bg-success/10 text-success rounded-full flex items-center justify-center mx-auto mb-4">
                    <CheckCircle size={36} />
                  </div>
                  <div>
                    <span className="label-caps text-coral mb-2 inline-block">Diagnostic Complete</span>
                    <h2 className="text-3xl font-bold">Path Ready!</h2>
                    <p className="text-text-secondary text-sm mt-1 max-w-sm mx-auto">
                      We've successfully scored your evaluation and created your adaptive path step roadmap.
                    </p>
                  </div>

                  {/* Skills feedback summary box */}
                  <div className="bg-navy/[0.02] border border-border/70 rounded p-5 text-left text-sm space-y-3 font-medium">
                    <div className="flex justify-between items-center border-b border-border pb-2.5">
                      <span className="text-text-secondary">Diagnostic Score:</span>
                      <span className="font-mono font-bold bg-primary/10 text-primary px-2.5 py-0.5 rounded">
                        {generatedPathResult?.study_plan?.match(/(\d+)%/)?.[1] || "80"}%
                      </span>
                    </div>
                    <div className="flex items-start gap-2.5 leading-relaxed text-text-secondary">
                      <Zap size={16} className="text-coral shrink-0 mt-0.5 animate-pulse" />
                      <span>
                        {generatedPathResult?.study_plan?.includes("Skipped")
                          ? "Congratulations! You proved your proficiency in introductory modules and have skipped straight to core operations."
                          : "We have included fundamental introductory modules to help reinforce your concepts before advanced exercises."}
                      </span>
                    </div>
                  </div>

                  <button
                    onClick={() => navigate({ to: "/learning-path" })}
                    className="w-full h-12 bg-primary text-primary-foreground font-bold hover:bg-primary-hover flex items-center justify-center gap-2 rounded transition-colors shadow"
                  >
                    View My Custom Path <ArrowRight size={16} />
                  </button>
                </div>
              )}

            </div>
          )}

        </div>
      </div>
      <Footer />
    </div>
  );
}
