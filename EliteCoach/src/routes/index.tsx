import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { TopNav } from "@/components/TopNav";
import { Footer } from "@/components/Footer";
import { CourseCard, CourseCardData } from "@/components/CourseCard";
import { contentApi, normalizeCourses } from "@/lib/api-client";
import { EmptyState } from "@/components/EmptyState";
import { useAuthStore } from "@/lib/stores";
import {
  ArrowRight,
  Sparkles,
  BrainCircuit,
  Compass,
  Trophy,
  Users,
  Code2,
  PenTool,
  LineChart,
  Briefcase,
  Megaphone,
  Quote,
  Check,
} from "lucide-react";
import logoUrl from "@/assets/logo.png";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "EliteCoach — Learn without limits" },
      {
        name: "description",
        content:
          "AI-powered learning paths, expert tutors, and 200+ courses for serious learners and organisations.",
      },
      { property: "og:title", content: "EliteCoach — Learn without limits" },
      {
        property: "og:description",
        content: "AI-powered learning paths and tutors for serious learners.",
      },
    ],
  }),
  component: LandingPage,
});

const DOMAINS = [
  {
    icon: BrainCircuit,
    name: "Artificial Intelligence",
    count: "42 courses",
    tone: "bg-primary",
  },
  {
    icon: LineChart,
    name: "Data Science",
    count: "38 courses",
    tone: "bg-coral",
  },
  {
    icon: Code2,
    name: "Software Engineering",
    count: "56 courses",
    tone: "bg-success",
  },
  {
    icon: PenTool,
    name: "Product Design",
    count: "24 courses",
    tone: "bg-navy",
  },
  {
    icon: Briefcase,
    name: "Business & Strategy",
    count: "31 courses",
    tone: "bg-primary",
  },
  {
    icon: Megaphone,
    name: "Marketing & Growth",
    count: "19 courses",
    tone: "bg-coral",
  },
];

const TESTIMONIALS = [
  {
    quote:
      "The AI tutor is like having a senior engineer next to me at 2am. I shipped my first ML model in three weeks.",
    name: "Adaeze O.",
    role: "Junior ML Engineer",
    org: "Fintech, Lagos",
  },
  {
    quote:
      "We rolled out EliteCoach to 240 staff. Completion rates tripled and the reporting just works for compliance.",
    name: "Marcus T.",
    role: "Head of L&D",
    org: "Series B SaaS",
  },
  {
    quote:
      "I dropped out of two other platforms. The path is what made me finish — it actually adapts when I struggle.",
    name: "Yusuf I.",
    role: "Career switcher",
    org: "Now a Product Designer",
  },
];

const FAQ = [
  {
    q: "What makes EliteCoach different from Udemy or Coursera?",
    a: "We're not a marketplace. Every path is curated, every lesson has an AI tutor, and progress is measured by what you can do — not by hours watched.",
  },
  {
    q: "Can I use it for my organisation?",
    a: "Yes. Bulk-import learners by CSV, assign courses with deadlines, and pull compliance reports. We support teams from 10 to 10,000.",
  },
  {
    q: "Is the AI tutor really helpful or just a chatbot?",
    a: "It has full lesson context, your progress, and the curriculum. It can explain concepts three different ways, generate practice problems, and grade your answers.",
  },
  {
    q: "Do I get a certification?",
    a: "Every course ends with an adaptive assessment. Pass it, and you get a verifiable certificate you can share on LinkedIn.",
  },
];

function LandingPage() {
  const isLoggedIn = useAuthStore((s) => s.isLoggedIn);
  const [courses, setCourses] = useState<CourseCardData[]>([]);
  const [loading, setLoading] = useState(true);
  const [openFaq, setOpenFaq] = useState<number | null>(0);

  useEffect(() => {
    if (!isLoggedIn) {
      setCourses([]);
      setLoading(false);
      return;
    }

    let alive = true;
    setLoading(true);
    contentApi
      .get("/courses/")
      .then((res) => {
        if (!alive) return;
        setCourses(
          (normalizeCourses(res.data) as CourseCardData[]).slice(0, 6),
        );
      })
      .catch(() => setCourses([]))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [isLoggedIn]);

  return (
    <div className="min-h-screen flex flex-col bg-surface-card">
      <TopNav />

      {/* HERO */}
      <section className="bg-navy text-navy-foreground relative overflow-hidden">
        {/* Watermark logo */}
        <img
          src={logoUrl}
          alt=""
          aria-hidden
          className="absolute -right-24 -bottom-24 w-[640px] opacity-[0.04] pointer-events-none select-none"
        />
        <div className="container-1200 grid lg:grid-cols-2 gap-12 items-center min-h-[calc(100vh-64px)] py-20 relative">
          <div>
            <span className="label-caps text-coral mb-6 inline-block">
              AI-powered learning
            </span>
            <h1 className="text-5xl md:text-[64px] font-bold leading-[1.05] tracking-tight mb-6">
              Learn without
              <br />
              limits.
            </h1>
            <p className="text-lg text-white/70 max-w-md mb-10 leading-relaxed">
              Personalised learning paths, expert tutors and an AI coach that
              adapts to how you learn. Built for serious learners and the
              organisations that grow them.
            </p>
            <div className="flex flex-wrap gap-4">
              <Link
                to="/register"
                className="h-12 px-6 inline-flex items-center bg-primary text-primary-foreground font-medium hover:bg-primary-hover transition-colors"
              >
                Start for free →
              </Link>
              <Link
                to="/courses"
                className="h-12 px-6 inline-flex items-center border border-white/30 text-white font-medium hover:bg-white/10 transition-colors"
              >
                Browse courses
              </Link>
            </div>

            <div className="mt-12 pt-8 border-t border-white/10 flex flex-wrap items-center gap-6 text-xs text-white/50">
              <span className="label-caps">Trusted by teams at</span>
              {["NORTHWIND", "ACME CORP", "STELLAR.IO", "MERIDIAN"].map((b) => (
                <span
                  key={b}
                  className="font-mono text-white/70 tracking-widest"
                >
                  {b}
                </span>
              ))}
            </div>
          </div>

          {/* Floating preview mockup */}
          <div className="relative hidden lg:block">
            <div className="absolute -top-10 -right-10 w-72 h-72 rounded-full bg-coral/20 blur-3xl" />
            <div className="absolute bottom-0 left-10 w-72 h-72 rounded-full bg-primary/30 blur-3xl" />
            <div className="hero-float hero-float-a relative bg-white text-text-primary rounded-lg p-6 shadow-2xl rotate-2 max-w-sm ml-auto">
              <div className="h-2 w-full bg-coral mb-4 rounded-sm" />
              <span className="label-caps text-text-secondary">Featured</span>
              <h3 className="text-lg font-semibold mt-2 mb-3">
                Intro to Machine Learning
              </h3>
              <div className="flex items-center gap-2 mb-4">
                <span className="label-caps bg-surface px-2 py-1">
                  Data Science
                </span>
                <span className="label-caps border border-border px-2 py-1">
                  Beginner
                </span>
              </div>
              <div className="h-1 w-full bg-surface rounded-sm overflow-hidden mb-2">
                <div className="h-full w-2/3 bg-coral" />
              </div>
              <div className="text-xs text-text-secondary">
                8 of 12 lessons completed
              </div>
            </div>
            <div className="hero-float hero-float-b relative mt-6 bg-white text-text-primary rounded-lg p-6 shadow-2xl -rotate-2 max-w-xs">
              <div className="flex items-center gap-3 mb-3">
                <img src={logoUrl} alt="" className="w-8 h-8 object-contain" />
                <div className="text-sm font-semibold">EliteCoach AI</div>
              </div>
              <p className="text-sm text-text-secondary leading-relaxed">
                Great question! Let's break down how a neural network actually
                learns — start with the loss function...
              </p>
              <div className="mt-4 flex gap-2">
                <span className="label-caps bg-primary/10 text-primary px-2 py-1">
                  Live
                </span>
                <span className="label-caps bg-surface px-2 py-1">
                  Module 3 · Lesson 2
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* STATS */}
      <section className="bg-surface-card border-b border-border">
        <div className="container-1200 grid grid-cols-1 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-border">
          {[
            { n: "10,000+", l: "Active learners" },
            { n: "200+", l: "Expert-led courses" },
            { n: "94%", l: "Completion rate" },
            { n: "24/7", l: "AI tutoring" },
          ].map((s) => (
            <div key={s.l} className="px-8 py-12 text-center">
              <div className="text-4xl md:text-5xl font-bold text-text-primary tracking-tight">
                {s.n}
              </div>
              <div className="label-caps text-text-secondary mt-3">{s.l}</div>
            </div>
          ))}
        </div>
      </section>

      {/* DOMAINS */}
      <section className="bg-surface section-y">
        <div className="container-1200">
          <div className="max-w-2xl mb-14">
            <span className="label-caps text-coral mb-3 inline-block">
              Domains
            </span>
            <h2 className="text-4xl md:text-[44px] font-semibold tracking-tight mb-4">
              Learn what actually moves your career.
            </h2>
            <p className="text-text-secondary text-lg leading-relaxed">
              Six core domains, hand-picked by senior practitioners. Every
              course is graded against real-world job outcomes — not vanity
              metrics.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {DOMAINS.map((d) => {
              const Icon = d.icon;
              return (
                <Link
                  key={d.name}
                  to="/courses"
                  className="card-base card-interactive group flex items-start gap-4"
                >
                  <div
                    className={`h-12 w-12 ${d.tone} flex items-center justify-center text-white shrink-0`}
                  >
                    <Icon size={22} />
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-semibold mb-1 group-hover:text-primary transition-colors">
                      {d.name}
                    </h3>
                    <div className="text-sm text-text-secondary font-mono">
                      {d.count}
                    </div>
                  </div>
                  <ArrowRight
                    size={18}
                    className="text-text-secondary group-hover:text-primary group-hover:translate-x-1 transition-all"
                  />
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* FEATURED COURSES */}
      <section className="bg-surface-card section-y border-y border-border">
        <div className="container-1200">
          <div className="flex items-end justify-between mb-12 gap-6 flex-wrap">
            <div>
              <span className="label-caps text-coral mb-3 inline-block">
                Catalog
              </span>
              <h2 className="text-4xl md:text-[44px] font-semibold tracking-tight max-w-xl">
                Explore top courses
              </h2>
            </div>
            <Link
              to="/courses"
              className="h-11 px-4 inline-flex items-center border border-primary text-primary font-medium hover:bg-primary hover:text-white transition-colors"
            >
              View all courses →
            </Link>
          </div>

          {loading ? (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="card-base h-64 animate-pulse" />
              ))}
            </div>
          ) : courses.length === 0 ? (
            <EmptyState
              title={
                isLoggedIn
                  ? "Catalog loading soon"
                  : "Log in to view the catalog"
              }
              description={
                isLoggedIn
                  ? "We're connecting to the course service. Check back in a moment."
                  : "The course service is protected right now, so browse the landing page and sign in to load live course data."
              }
              action={
                !isLoggedIn ? (
                  <Link
                    to="/login"
                    className="h-11 px-4 inline-flex items-center bg-primary text-white font-medium hover:bg-primary-hover transition-colors"
                  >
                    Log in
                  </Link>
                ) : undefined
              }
            />
          ) : (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {courses.map((c) => (
                <CourseCard key={c.id} course={c} />
              ))}
            </div>
          )}
        </div>
      </section>

      {/* AI TUTOR FEATURE STRIP */}
      <section className="bg-navy text-navy-foreground section-y relative overflow-hidden">
        <img
          src={logoUrl}
          alt=""
          aria-hidden
          className="absolute -left-32 top-1/2 -translate-y-1/2 w-[520px] opacity-[0.05] pointer-events-none"
        />
        <div className="container-1200 grid lg:grid-cols-2 gap-16 items-center relative">
          <div>
            <span className="label-caps text-coral mb-3 inline-block">
              EliteCoach AI
            </span>
            <h2 className="text-4xl md:text-[44px] font-semibold tracking-tight mb-6 leading-tight">
              An AI tutor that knows the lesson, knows you, and never sleeps.
            </h2>
            <p className="text-white/70 text-lg leading-relaxed mb-8">
              Stuck on a concept? Ask. Want a harder problem? Ask. Need it
              explained like you're five? Ask. Your tutor has the full
              curriculum, your progress and your past mistakes in context.
            </p>
            <ul className="space-y-3 mb-10">
              {[
                "Context-aware Q&A on every lesson",
                "Generates practice problems on demand",
                "Grades your answers with detailed feedback",
                "Adapts difficulty as you improve",
              ].map((f) => (
                <li key={f} className="flex items-start gap-3 text-white/85">
                  <Check size={18} className="text-coral mt-1 shrink-0" />
                  <span>{f}</span>
                </li>
              ))}
            </ul>
            <Link
              to="/register"
              className="h-12 px-6 inline-flex items-center bg-coral text-coral-foreground font-medium hover:opacity-90 transition-opacity"
            >
              Try the AI tutor free →
            </Link>
          </div>

          <div className="bg-white/5 border border-white/10 p-6 rounded-lg">
            <div className="flex items-center gap-3 pb-4 border-b border-white/10 mb-4">
              <img src={logoUrl} alt="" className="w-8 h-8 object-contain" />
              <div>
                <div className="text-sm font-semibold">EliteCoach AI</div>
                <div className="text-xs text-white/50 font-mono">
                  module-3 · lesson-2
                </div>
              </div>
              <span className="ml-auto label-caps text-coral">Live</span>
            </div>
            <div className="space-y-4">
              <div className="bg-primary text-primary-foreground p-3 rounded-md text-sm ml-auto max-w-[80%]">
                Why does my model overfit when I add more layers?
              </div>
              <div className="bg-white/10 p-3 rounded-md text-sm max-w-[85%]">
                Great instinct catching that. More layers = more capacity to
                memorise the training set. Three quick fixes to try:
                <ol className="mt-2 space-y-1 list-decimal list-inside text-white/80">
                  <li>Add dropout (start with 0.2)</li>
                  <li>Use early stopping on val_loss</li>
                  <li>Try L2 regularisation</li>
                </ol>
                Want me to generate a practice notebook?
              </div>
              <div className="flex gap-2 pt-2">
                <button className="text-xs px-3 py-1.5 bg-white/10 hover:bg-white/20 transition-colors">
                  Yes, generate it
                </button>
                <button className="text-xs px-3 py-1.5 bg-white/10 hover:bg-white/20 transition-colors">
                  Explain dropout deeper
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section className="bg-surface-card section-y">
        <div className="container-1200">
          <div className="text-center mb-16">
            <span className="label-caps text-coral mb-3 inline-block">
              How it works
            </span>
            <h2 className="text-4xl md:text-[44px] font-semibold tracking-tight max-w-2xl mx-auto">
              Three steps to your next skill
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                n: "01",
                icon: Compass,
                t: "Set your goal",
                d: "Tell us what you want to become — ML engineer, product designer, data analyst. We craft an AI-personalised roadmap.",
              },
              {
                n: "02",
                icon: BrainCircuit,
                t: "Learn with an AI coach",
                d: "Every lesson comes with an always-on tutor that explains, quizzes, and pushes you when you plateau.",
              },
              {
                n: "03",
                icon: Trophy,
                t: "Prove your skill",
                d: "Take adaptive assessments, ship real projects, and earn role-ready certifications you can show employers.",
              },
            ].map((s) => {
              const Icon = s.icon;
              return (
                <div key={s.n} className="relative">
                  <div className="border-l-2 border-primary pl-6">
                    <div className="font-mono text-sm text-coral mb-3">
                      {s.n}
                    </div>
                    <div className="h-12 w-12 bg-primary/10 text-primary flex items-center justify-center mb-4">
                      <Icon size={22} />
                    </div>
                    <h3 className="text-xl font-semibold mb-2">{s.t}</h3>
                    <p className="text-text-secondary leading-relaxed">{s.d}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* TESTIMONIALS */}
      <section className="bg-surface section-y">
        <div className="container-1200">
          <div className="max-w-2xl mb-14">
            <span className="label-caps text-coral mb-3 inline-block">
              Stories
            </span>
            <h2 className="text-4xl md:text-[44px] font-semibold tracking-tight">
              Real learners. Real outcomes.
            </h2>
          </div>
          <div className="grid md:grid-cols-3 gap-6">
            {TESTIMONIALS.map((t) => (
              <article key={t.name} className="card-base flex flex-col">
                <Quote size={28} className="text-coral mb-4" />
                <p className="text-text-primary leading-relaxed mb-6 flex-1">
                  {t.quote}
                </p>
                <div className="pt-4 border-t border-border">
                  <div className="font-semibold text-sm">{t.name}</div>
                  <div className="text-xs text-text-secondary mt-0.5">
                    {t.role} · {t.org}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* FOR ORGANISATIONS */}
      <section className="bg-surface-card section-y border-y border-border">
        <div className="container-1200 grid lg:grid-cols-[1fr_1.2fr] gap-16 items-center">
          <div>
            <span className="label-caps text-coral mb-3 inline-block">
              For organisations
            </span>
            <h2 className="text-4xl md:text-[44px] font-semibold tracking-tight mb-6 leading-tight">
              Upskill your whole team without the LMS pain.
            </h2>
            <p className="text-text-secondary text-lg leading-relaxed mb-8">
              CSV-import your learners, assign courses with deadlines, and pull
              compliance reports in one click. SOC2-friendly, SSO-ready, and
              priced for teams of 10 or 10,000.
            </p>
            <div className="flex flex-wrap gap-3">
              <Link
                to="/register"
                className="h-12 px-6 inline-flex items-center bg-primary text-primary-foreground font-medium hover:bg-primary-hover transition-colors"
              >
                Talk to sales →
              </Link>
              <Link
                to="/courses"
                className="h-12 px-6 inline-flex items-center border border-border text-text-primary font-medium hover:bg-surface transition-colors"
              >
                See features
              </Link>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {[
              {
                icon: Users,
                t: "Bulk learner import",
                d: "CSV upload with row-level error reporting.",
              },
              {
                icon: Trophy,
                t: "Compliance reports",
                d: "Export to PDF or CSV in one click.",
              },
              {
                icon: BrainCircuit,
                t: "Custom learning paths",
                d: "Tailored to roles in your org.",
              },
              {
                icon: Sparkles,
                t: "Real-time progress",
                d: "Dashboards that managers actually use.",
              },
            ].map((f) => {
              const Icon = f.icon;
              return (
                <div key={f.t} className="card-base">
                  <Icon size={22} className="text-primary mb-3" />
                  <h4 className="font-semibold mb-1">{f.t}</h4>
                  <p className="text-sm text-text-secondary leading-relaxed">
                    {f.d}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section className="bg-surface section-y">
        <div className="container-1200 grid lg:grid-cols-[1fr_1.4fr] gap-16">
          <div>
            <span className="label-caps text-coral mb-3 inline-block">FAQ</span>
            <h2 className="text-4xl font-semibold tracking-tight mb-4">
              Questions, answered.
            </h2>
            <p className="text-text-secondary leading-relaxed">
              Still curious? Reach out — we read every email.
            </p>
          </div>
          <div className="border-t border-border">
            {FAQ.map((item, i) => {
              const open = openFaq === i;
              return (
                <div key={item.q} className="border-b border-border">
                  <button
                    onClick={() => setOpenFaq(open ? null : i)}
                    className="w-full text-left py-6 flex items-start justify-between gap-6 group"
                  >
                    <span className="text-lg font-semibold text-text-primary group-hover:text-primary transition-colors">
                      {item.q}
                    </span>
                    <span className="font-mono text-coral text-xl shrink-0 leading-none mt-1">
                      {open ? "−" : "+"}
                    </span>
                  </button>
                  {open && (
                    <p className="pb-6 text-text-secondary leading-relaxed max-w-2xl">
                      {item.a}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-navy text-navy-foreground section-y relative overflow-hidden">
        <img
          src={logoUrl}
          alt=""
          aria-hidden
          className="absolute right-0 bottom-0 w-[400px] opacity-[0.06] pointer-events-none"
        />
        <div className="container-1200 text-center relative">
          <img
            src={logoUrl}
            alt=""
            className="w-16 h-16 mx-auto mb-6 object-contain"
          />
          <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">
            Ready to start learning?
          </h2>
          <p className="text-white/70 max-w-md mx-auto mb-10 text-lg">
            Join thousands of learners building real skills with EliteCoach.
            Free to start. No credit card.
          </p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Link
              to="/register"
              className="h-12 px-6 inline-flex items-center bg-coral text-coral-foreground font-medium hover:opacity-90 transition-opacity"
            >
              Create your free account →
            </Link>
            <Link
              to="/courses"
              className="h-12 px-6 inline-flex items-center border border-white/30 text-white font-medium hover:bg-white/10 transition-colors"
            >
              Browse courses
            </Link>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}
