import { createFileRoute } from "@tanstack/react-router";
import { requireTutor } from "@/lib/auth-guard";
import React, { useEffect, useState } from "react";
import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";
import { useAuthStore } from "@/lib/stores";
import {
  contentApi,
  normalizeCourses,
  extractErrorMessage,
  unwrapApiData,
} from "@/lib/api-client";
import { toast } from "sonner";
import {
  Plus,
  X,
  ChevronDown,
  ChevronRight,
  BookOpen,
  FileText,
  Sparkles,
  Loader2,
  Clock,
  LayoutGrid,
  Trash2,
} from "lucide-react";


interface Course {
  id: string;
  title: string;
  description?: string;
  domain?: string;
  difficulty_level?: string;
  published_date?: string;
  created_at?: string;
}

interface ContentChunk {
  title: string;
  duration_minutes?: number;
}

interface Module {
  id: string;
  title: string;
  order_index?: number;
  content_chunks?: ContentChunk[];
}

interface CourseCurriculum extends Course {
  modules?: Module[];
}

export const Route = createFileRoute("/tutor/courses")({
  beforeLoad: () => { requireTutor(); },
  head: () => ({ meta: [{ title: "Tutor CMS — EliteCoach" }] }),
  component: TutorCoursesPage,
});

function TutorCoursesPage() {
  const user = useAuthStore((s) => s.user);
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [moduleOpen, setModuleOpen] = useState<string | null>(null);
  const [ingesting, setIngesting] = useState<string | null>(null);

  const [createForm, setCreateForm] = useState({
    title: "",
    description: "",
    domain: "",
    difficulty_level: "BEGINNER",
  });
  const [moduleForm, setModuleForm] = useState({
    title: "",
    order_index: 1,
    lessons: [{ title: "", content: "" }] as { title: string; content: string }[],
    assessment_id: "",
    is_human_required: false,
  });
  const [creating, setCreating] = useState(false);
  const [savingModule, setSavingModule] = useState(false);
  
  const [expandedCourse, setExpandedCourse] = useState<string | null>(null);
  const [curriculums, setCurriculums] = useState<Record<string, CourseCurriculum>>({});
  const [loadingCurriculums, setLoadingCurriculums] = useState<Record<string, boolean>>({});
  const [sort, setSort] = useState<"newest" | "oldest">("newest");
  const [unsortedCourses, setUnsortedCourses] = useState<Course[]>([]);

  // Sort courses whenever the sort order changes or courses are updated
  useEffect(() => {
    const sorted = [...unsortedCourses];
    sorted.sort((a, b) => {
      const aDate = new Date(a.published_date ?? a.created_at ?? 0).getTime();
      const bDate = new Date(b.published_date ?? b.created_at ?? 0).getTime();
      return sort === "newest" ? bDate - aDate : aDate - bDate;
    });
    setCourses(sorted);
  }, [sort, unsortedCourses]);

  const reload = async () => {
    setLoading(true);
    try {
      const res = await contentApi.get("/courses/");
      const courseList = normalizeCourses(res.data) as Course[];
      courseList.reverse();  // Show newest items first
      setUnsortedCourses(courseList);

      // Load curriculums for all courses to get accurate module counts
      const curriculumPromises = courseList.map(async (course) => {
        try {
          const currRes = await contentApi.get(`/courses/${course.id}/curriculum`);
          const curriculum = unwrapApiData(currRes.data) as CourseCurriculum;
          return { courseId: course.id, curriculum };
        } catch (err) {
          console.warn(`Failed to load curriculum for course ${course.id}:`, err);
          return null;
        }
      });

      const results = await Promise.allSettled(curriculumPromises);
      const newCurriculums: Record<string, CourseCurriculum> = {};
      
      results.forEach((result) => {
        if (result.status === 'fulfilled' && result.value) {
          const { courseId, curriculum } = result.value;
          newCurriculums[courseId] = curriculum;
        }
      });

      setCurriculums(newCurriculums);
    } catch (err) {
      setCourses([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    reload().catch((err) => {
      console.error("Failed to load courses:", err);
    });
  }, []);

  const submitCreate = async () => {
    setCreating(true);
    try {
      await contentApi.post("/courses/", {
        ...createForm,
        skill_tags: [],
        tutor_id: user?.id ?? user?.userId ?? user?.email ?? "tutor",
      });
      toast.success("Course created");
      setCreateOpen(false);
      setCreateForm({
        title: "",
        description: "",
        domain: "",
        difficulty_level: "BEGINNER",
      });
      reload();
    } catch (err) {
      toast.error(extractErrorMessage(err, "Could not create course"));
    } finally {
      setCreating(false);
    }
  };

  const submitModule = async () => {
    if (!moduleOpen) return;
    const targetCourseId = moduleOpen; // capture before clearing
    setSavingModule(true);
    try {
      const chunks = moduleForm.lessons
        .filter((l) => l.title.trim())
        .map((l) => ({ title: l.title.trim(), content: l.content.trim() || undefined }));

      if (chunks.length === 0) {
        toast.error("Add at least one lesson with a title");
        setSavingModule(false);
        return;
      }

      await contentApi.post(`/courses/${targetCourseId}/modules`, {
        title: moduleForm.title,
        order_index: moduleForm.order_index,
        content_chunks: chunks,
        assessment_id: moduleForm.assessment_id || undefined,
        is_human_required: moduleForm.is_human_required,
      });
      toast.success("Module added");
      setModuleOpen(null);
      setModuleForm({
        title: "",
        order_index: 1,
        lessons: [{ title: "", content: "" }],
        assessment_id: "",
        is_human_required: false,
      });
      
      // Re-fetch curriculum for this course after adding module
      try {
        const currRes = await contentApi.get(`/courses/${targetCourseId}/curriculum`);
        const curriculum = unwrapApiData(currRes.data) as CourseCurriculum;
        setCurriculums((prev) => ({ ...prev, [targetCourseId]: curriculum }));
      } catch (err) {
        console.warn(`Failed to reload curriculum for course ${targetCourseId}:`, err);
      }
    } catch (err) {
      toast.error(extractErrorMessage(err, "Could not add module"));
    } finally {
      setSavingModule(false);
    }
  };

  const ingest = async (courseId: string) => {
    setIngesting(courseId);
    try {
      await contentApi.post(`/courses/internal/ingest?course_id=${courseId}`);
      toast.success("Course ingested");
    } catch (err) {
      toast.error(extractErrorMessage(err, "Ingest failed"));
    } finally {
      setIngesting(null);
    }
  };

  const toggleExpand = async (courseId: string) => {
    if (expandedCourse === courseId) {
      setExpandedCourse(null);
      return;
    }
    setExpandedCourse(courseId);
    if (!curriculums[courseId]) {
      setLoadingCurriculums((prev) => ({ ...prev, [courseId]: true }));
      try {
        const res = await contentApi.get(`/courses/${courseId}/curriculum`);
        const payload = unwrapApiData<any>(res.data);
        
        let loadedModules: Module[] = [];
        if (Array.isArray(payload)) {
           loadedModules = payload as Module[];
        } else if (payload?.modules) {
           loadedModules = payload.modules;
        }

        setCurriculums((prev) => ({ 
          ...prev, 
          [courseId]: { ...payload, modules: loadedModules } 
        }));
      } catch (err) {
        console.warn("Could not load curriculum", err);
      } finally {
        setLoadingCurriculums((prev) => ({ ...prev, [courseId]: false }));
      }
    }
  };
  const difficultyColor = (level?: string) => {
    switch (level?.toUpperCase()) {
      case "BEGINNER":    return "bg-success/10 text-success border-success/20";
      case "INTERMEDIATE": return "bg-warning/10 text-warning border-warning/20";
      case "ADVANCED":    return "bg-coral/10 text-coral border-coral/20";
      default:            return "bg-surface text-text-secondary border-border";
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-surface">
      <TopNav />

      <div className="container-1200 py-12 flex-1">
        {/* Header */}
        <div className="flex items-end justify-between mb-10 flex-wrap gap-4 animate-fade-in-up">
          <div>
            <span className="label-caps text-coral mb-2 inline-flex items-center gap-1.5">
              <span className="inline-block w-2 h-2 rounded-full bg-coral" style={{ animation: "pulse-dot 2s ease-in-out infinite" }} />
              Tutor CMS
            </span>
            <h1 className="text-4xl font-bold tracking-tight">Manage courses</h1>
            <p className="text-text-secondary text-sm mt-1">
              Create courses, add modules, and publish content for your learners.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as "newest" | "oldest")}
              className="h-11 px-3 border border-border bg-surface-card text-sm"
            >
              <option value="newest">Newest first</option>
              <option value="oldest">Oldest first</option>
            </select>
            <button
              onClick={() => setCreateOpen(true)}
              className="h-11 px-5 bg-primary text-primary-foreground font-medium rounded-md inline-flex items-center gap-2 hover:bg-primary-hover active:scale-[0.97] transition-all shadow-md hover:shadow-lg"
            >
              <Plus size={16} /> New course
            </button>
          </div>
        </div>

        {/* Stats bar */}
        {!loading && courses.length > 0 && (
          <div className="grid grid-cols-3 gap-4 mb-8 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
            <div className="card-base p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <BookOpen size={18} className="text-primary" />
              </div>
              <div>
                <div className="text-2xl font-bold">{courses.length}</div>
                <div className="text-xs text-text-secondary">Total Courses</div>
              </div>
            </div>
            <div className="card-base p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-success/10 flex items-center justify-center">
                <FileText size={18} className="text-success" />
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {Object.values(curriculums).reduce((sum, c) => sum + (c?.modules?.length || 0), 0)}
                </div>
                <div className="text-xs text-text-secondary">Total Modules</div>
              </div>
            </div>
            <div className="card-base p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-coral/10 flex items-center justify-center">
                <Sparkles size={18} className="text-coral" />
              </div>
              <div>
                <div className="text-2xl font-bold">
                  {courses.filter(c => c.domain).map(c => c.domain).filter((v, i, a) => a.indexOf(v) === i).length}
                </div>
                <div className="text-xs text-text-secondary">Domains</div>
              </div>
            </div>
          </div>
        )}

        {/* Course list */}
        <div className="card-base p-0 overflow-hidden">
          {loading ? (
            <div className="p-8 space-y-4">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-4 animate-fade-in-up" style={{ animationDelay: `${i * 0.1}s` }}>
                  <div className="skeleton-shimmer w-5 h-5 rounded" />
                  <div className="flex-1 space-y-2">
                    <div className="skeleton-shimmer h-4 w-2/3 rounded" />
                    <div className="skeleton-shimmer h-3 w-1/3 rounded" />
                  </div>
                  <div className="skeleton-shimmer h-8 w-24 rounded" />
                </div>
              ))}
            </div>
          ) : courses.length === 0 ? (
            <div className="py-20 px-12 text-center animate-fade-in-up">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto mb-5">
                <BookOpen size={28} className="text-primary" />
              </div>
              <h3 className="text-lg font-semibold mb-2">No courses yet</h3>
              <p className="text-text-secondary text-sm mb-6 max-w-sm mx-auto">
                Get started by creating your first course. You can add modules, lessons, and assessments after.
              </p>
              <button
                onClick={() => setCreateOpen(true)}
                className="h-11 px-5 bg-primary text-primary-foreground font-medium rounded-md inline-flex items-center gap-2 hover:bg-primary-hover active:scale-[0.97] transition-all shadow-md"
              >
                <Plus size={16} /> Create your first course
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              {/* Table header */}
              <div className="grid grid-cols-[40px_1fr_120px_120px_180px] gap-2 px-6 py-3 bg-navy/[0.03] border-b border-border text-xs">
                <div />
                <div className="label-caps text-text-secondary">Course</div>
                <div className="label-caps text-text-secondary">Level</div>
                <div className="label-caps text-text-secondary">Published</div>
                <div className="label-caps text-text-secondary text-right">Actions</div>
              </div>

              {/* Course rows */}
              {courses.map((c, idx) => {
                const isExpanded = expandedCourse === c.id;
                const cur = curriculums[c.id];
                const isLoadingCur = loadingCurriculums[c.id];

                return (
                  <React.Fragment key={c.id}>
                    <div
                      className={`grid grid-cols-[40px_1fr_120px_120px_180px] gap-2 px-6 py-4 items-center cursor-pointer transition-all duration-200 ease-out group ${isExpanded ? "bg-primary/[0.04] border-l-2 border-l-primary" : "border-b border-border hover:bg-surface/60 border-l-2 border-l-transparent"}`}
                      style={{ animation: `fade-in-up 0.4s cubic-bezier(0.22,1,0.36,1) ${idx * 0.05}s both` }}
                      onClick={() => toggleExpand(c.id)}
                    >
                      <div className="text-text-secondary">
                        {isExpanded ? <ChevronDown size={18} /> : <ChevronRight size={18} className="group-hover:translate-x-0.5 transition-transform duration-200" />}
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-[15px] truncate group-hover:text-primary transition-colors duration-200">{c.title}</div>
                        <div className="text-text-secondary text-xs flex items-center gap-1.5 mt-0.5">
                          <LayoutGrid size={11} /> {c.domain ?? "Uncategorized"}
                        </div>
                      </div>
                      <div>
                        <span className={`inline-flex px-2.5 py-1 rounded-md text-xs font-medium border ${difficultyColor(c.difficulty_level)}`}>
                          {c.difficulty_level ?? "\u2014"}
                        </span>
                      </div>
                      <div className="text-text-secondary font-mono text-xs">
                        {(c.published_date ?? c.created_at) ? new Date(c.published_date ?? c.created_at!).toLocaleDateString() : "\u2014"}
                      </div>
                      <div className="text-right" onClick={(e) => e.stopPropagation()}>
                        <div className="inline-flex gap-2 opacity-70 group-hover:opacity-100 transition-opacity duration-200">
                          <button onClick={() => setModuleOpen(c.id)} className="h-8 px-3 bg-surface-card border border-border text-xs font-medium rounded-md hover:border-primary hover:text-primary transition-all duration-200 inline-flex items-center gap-1.5 active:scale-95">
                            <Plus size={13} /> Module
                          </button>
                          <button onClick={() => ingest(c.id)} disabled={ingesting === c.id} className="h-8 px-3 bg-navy text-white text-xs font-medium rounded-md hover:bg-navy/85 transition-all duration-200 inline-flex items-center gap-1.5 disabled:opacity-50 active:scale-95 shadow-sm">
                            {ingesting === c.id ? <Loader2 size={13} className="animate-spin" /> : <Sparkles size={13} />}
                            Ingest
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Expanded curriculum */}
                    {isExpanded && (
                      <div className="border-b border-border bg-gradient-to-b from-primary/[0.02] to-transparent animate-expand-down">
                        <div className="px-14 py-8 max-w-4xl">
                          <div className="mb-8 animate-fade-in-up" style={{ animationDelay: "0.05s" }}>
                            <h4 className="label-caps text-text-secondary mb-2 flex items-center gap-1.5"><FileText size={12} /> Description</h4>
                            <p className="text-sm leading-relaxed text-text-primary/80">{cur?.description || c.description || "No description provided."}</p>
                          </div>
                          <div className="flex items-center justify-between mb-5 animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
                            <h4 className="label-caps text-text-secondary flex items-center gap-1.5">
                              <BookOpen size={12} /> Curriculum Modules
                              {cur?.modules?.length ? <span className="ml-1.5 bg-primary/10 text-primary text-[10px] px-1.5 py-0.5 rounded-full font-bold">{cur.modules.length}</span> : null}
                            </h4>
                            <button onClick={(e) => { e.stopPropagation(); setModuleOpen(c.id); }} className="text-xs text-primary font-medium hover:underline inline-flex items-center gap-1 transition-colors duration-200">
                              <Plus size={12} /> Add Module
                            </button>
                          </div>

                          {isLoadingCur ? (
                            <div className="space-y-3 animate-fade-in-up">
                              {[1, 2].map((i) => (
                                <div key={i} className="border border-border rounded-lg p-4">
                                  <div className="skeleton-shimmer h-4 w-1/2 rounded mb-3" />
                                  <div className="skeleton-shimmer h-3 w-3/4 rounded mb-2" />
                                  <div className="skeleton-shimmer h-3 w-1/3 rounded" />
                                </div>
                              ))}
                            </div>
                          ) : !cur?.modules?.length ? (
                            <div className="text-center py-10 bg-surface/50 border border-dashed border-border rounded-lg animate-fade-in-up" style={{ animationDelay: "0.15s" }}>
                              <div className="w-12 h-12 rounded-xl bg-border/30 flex items-center justify-center mx-auto mb-3"><BookOpen size={20} className="text-text-secondary" /></div>
                              <p className="text-sm text-text-secondary mb-3">No modules yet</p>
                              <button onClick={(e) => { e.stopPropagation(); setModuleOpen(c.id); }} className="text-xs text-primary font-medium hover:underline inline-flex items-center gap-1"><Plus size={12} /> Add the first module</button>
                            </div>
                          ) : (
                            <div className="space-y-3">
                              {cur.modules.map((mod, i) => (
                                <div key={mod.id ?? i} className="border border-border bg-surface-card rounded-lg overflow-hidden hover:border-primary/30 transition-all duration-200 animate-fade-in-up" style={{ animationDelay: `${0.1 + i * 0.05}s` }}>
                                  <div className="px-4 py-3 bg-gradient-to-r from-surface/80 to-surface/30 border-b border-border flex items-center justify-between">
                                    <div className="font-medium text-sm flex items-center gap-2.5">
                                      <span className="w-6 h-6 rounded-md bg-primary/10 text-primary text-xs font-bold flex items-center justify-center">{mod.order_index ?? i + 1}</span>
                                      {mod.title}
                                    </div>
                                    {mod.content_chunks && <span className="text-xs text-text-secondary">{mod.content_chunks.length} lesson{mod.content_chunks.length !== 1 ? "s" : ""}</span>}
                                  </div>
                                  <div className="p-4">
                                    {mod.content_chunks && mod.content_chunks.length > 0 ? (
                                      <ul className="space-y-2">
                                        {mod.content_chunks.map((chunk, j) => (
                                          <li key={j} className="flex items-start gap-2.5 text-sm text-text-secondary hover:text-text-primary transition-colors duration-150 group/chunk">
                                            <div className="w-5 h-5 rounded bg-surface flex items-center justify-center mt-0.5 shrink-0 group-hover/chunk:bg-primary/10 transition-colors duration-150">
                                              <FileText size={11} className="group-hover/chunk:text-primary transition-colors duration-150" />
                                            </div>
                                            <span className="flex-1">{typeof chunk === "string" ? chunk : chunk.title}</span>
                                            {(chunk as ContentChunk).duration_minutes && (
                                              <span className="inline-flex items-center gap-1 text-xs px-2 py-0.5 bg-surface rounded-md border border-border shrink-0"><Clock size={10} /> {(chunk as ContentChunk).duration_minutes}m</span>
                                            )}
                                          </li>
                                        ))}
                                      </ul>
                                    ) : (
                                      <div className="text-xs text-text-secondary italic">No content chunks defined</div>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* CREATE COURSE PANEL */}
      {createOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-navy/40 backdrop-blur-sm animate-overlay-in" onClick={() => setCreateOpen(false)} />
          <div className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-surface-card shadow-2xl overflow-auto animate-slide-in-right">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">New course</h2>
                <p className="text-xs text-text-secondary mt-0.5">Fill in the details to create a new course</p>
              </div>
              <button onClick={() => setCreateOpen(false)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-surface transition-colors duration-200 text-text-secondary"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-5">
              <div className="animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
                <label className="label-caps text-text-secondary block mb-2">Title</label>
                <input value={createForm.title} onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })} placeholder="e.g. Introduction to Data Analytics" className="w-full h-12 px-4 border border-border rounded-md bg-surface-card focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all duration-200" />
              </div>
              <div className="animate-fade-in-up" style={{ animationDelay: "0.15s" }}>
                <label className="label-caps text-text-secondary block mb-2">Description</label>
                <textarea rows={4} value={createForm.description} onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })} placeholder="Describe what learners will achieve..." className="w-full px-4 py-3 border border-border rounded-md bg-surface-card focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all duration-200 resize-none" />
              </div>
              <div className="animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
                <label className="label-caps text-text-secondary block mb-2">Domain</label>
                <input value={createForm.domain} onChange={(e) => setCreateForm({ ...createForm, domain: e.target.value })} placeholder="e.g. Technology, Finance, Leadership" className="w-full h-12 px-4 border border-border rounded-md bg-surface-card focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all duration-200" />
              </div>
              <div className="animate-fade-in-up" style={{ animationDelay: "0.25s" }}>
                <label className="label-caps text-text-secondary block mb-2">Difficulty</label>
                <select value={createForm.difficulty_level} onChange={(e) => setCreateForm({ ...createForm, difficulty_level: e.target.value })} className="w-full h-12 px-4 border border-border rounded-md bg-surface-card focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all duration-200 cursor-pointer">
                  <option value="BEGINNER">Beginner</option>
                  <option value="INTERMEDIATE">Intermediate</option>
                  <option value="ADVANCED">Advanced</option>
                </select>
              </div>
              <button onClick={submitCreate} disabled={creating || !createForm.title} className="w-full h-12 bg-primary text-primary-foreground font-medium rounded-md hover:bg-primary-hover active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md animate-fade-in-up flex items-center justify-center gap-2" style={{ animationDelay: "0.3s" }}>
                {creating ? (<><Loader2 size={16} className="animate-spin" /> Creating...</>) : "Create course"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ADD MODULE PANEL */}
      {moduleOpen && (
        <div className="fixed inset-0 z-50">
          <div className="absolute inset-0 bg-navy/40 backdrop-blur-sm animate-overlay-in" onClick={() => setModuleOpen(null)} />
          <div className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-surface-card shadow-2xl overflow-auto animate-slide-in-right">
            <div className="p-6 border-b border-border flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold">Add module</h2>
                <p className="text-xs text-text-secondary mt-0.5">Adding to: <span className="font-medium text-text-primary">{courses.find(c => c.id === moduleOpen)?.title ?? "Course"}</span></p>
              </div>
              <button onClick={() => setModuleOpen(null)} className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-surface transition-colors duration-200 text-text-secondary"><X size={18} /></button>
            </div>
            <div className="p-6 space-y-5">
              <div className="animate-fade-in-up" style={{ animationDelay: "0.1s" }}>
                <label className="label-caps text-text-secondary block mb-2">Module title</label>
                <input value={moduleForm.title} onChange={(e) => setModuleForm({ ...moduleForm, title: e.target.value })} placeholder="e.g. Getting Started with Python" className="w-full h-12 px-4 border border-border rounded-md bg-surface-card focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all duration-200" />
              </div>
              <div className="animate-fade-in-up" style={{ animationDelay: "0.15s" }}>
                <label className="label-caps text-text-secondary block mb-2">Order index</label>
                <input type="number" value={moduleForm.order_index} onChange={(e) => setModuleForm({ ...moduleForm, order_index: Number(e.target.value) })} className="w-full h-12 px-4 border border-border rounded-md bg-surface-card focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all duration-200" />
              </div>

              {/* Dynamic lesson builder */}
              <div className="animate-fade-in-up" style={{ animationDelay: "0.2s" }}>
                <div className="flex items-center justify-between mb-3">
                  <label className="label-caps text-text-secondary">Lessons</label>
                  <button
                    type="button"
                    onClick={() => setModuleForm({ ...moduleForm, lessons: [...moduleForm.lessons, { title: "", content: "" }] })}
                    className="text-xs text-primary font-medium hover:underline inline-flex items-center gap-1"
                  >
                    <Plus size={12} /> Add lesson
                  </button>
                </div>
                <div className="space-y-4">
                  {moduleForm.lessons.map((lesson, idx) => (
                    <div key={idx} className="border border-border rounded-lg p-4 bg-surface/30 animate-fade-in-up">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-xs font-medium text-text-secondary">Lesson {idx + 1}</span>
                        {moduleForm.lessons.length > 1 && (
                          <button
                            type="button"
                            onClick={() => setModuleForm({ ...moduleForm, lessons: moduleForm.lessons.filter((_, i) => i !== idx) })}
                            className="text-xs text-destructive hover:underline inline-flex items-center gap-1"
                          >
                            <Trash2 size={11} /> Remove
                          </button>
                        )}
                      </div>
                      <input
                        value={lesson.title}
                        onChange={(e) => {
                          const updated = [...moduleForm.lessons];
                          updated[idx] = { ...updated[idx], title: e.target.value };
                          setModuleForm({ ...moduleForm, lessons: updated });
                        }}
                        placeholder="Lesson title"
                        className="w-full h-10 px-3 mb-2 border border-border rounded-md bg-surface-card focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all duration-200 text-sm"
                      />
                      <textarea
                        value={lesson.content}
                        onChange={(e) => {
                          const updated = [...moduleForm.lessons];
                          updated[idx] = { ...updated[idx], content: e.target.value };
                          setModuleForm({ ...moduleForm, lessons: updated });
                        }}
                        rows={4}
                        placeholder="Write the lesson content here... (supports Markdown)"
                        className="w-full px-3 py-2 border border-border rounded-md bg-surface-card focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all duration-200 text-sm resize-none"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <div className="animate-fade-in-up" style={{ animationDelay: "0.25s" }}>
                <label className="label-caps text-text-secondary block mb-2">Assessment ID <span className="text-text-secondary/60 font-normal normal-case ml-1">(optional)</span></label>
                <input value={moduleForm.assessment_id} onChange={(e) => setModuleForm({ ...moduleForm, assessment_id: e.target.value })} placeholder="Link an assessment to this module" className="w-full h-12 px-4 border border-border rounded-md bg-surface-card focus:border-primary focus:ring-2 focus:ring-primary/10 outline-none transition-all duration-200 font-mono text-sm" />
              </div>
              <label className="flex items-center gap-3 text-sm cursor-pointer group animate-fade-in-up" style={{ animationDelay: "0.3s" }}>
                <input type="checkbox" checked={moduleForm.is_human_required} onChange={(e) => setModuleForm({ ...moduleForm, is_human_required: e.target.checked })} className="w-5 h-5 accent-primary rounded cursor-pointer" />
                <span className="group-hover:text-primary transition-colors duration-200">Human review required</span>
              </label>
              <button onClick={submitModule} disabled={savingModule || !moduleForm.title} className="w-full h-12 bg-primary text-primary-foreground font-medium rounded-md hover:bg-primary-hover active:scale-[0.98] transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed shadow-md animate-fade-in-up flex items-center justify-center gap-2" style={{ animationDelay: "0.35s" }}>
                {savingModule ? (<><Loader2 size={16} className="animate-spin" /> Saving...</>) : "Add module"}
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer />
    </div>
  );
}

