import { ReactNode } from "react";
import { Link } from "@tanstack/react-router";

export function AuthLayout({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2">
      {/* Left brand panel */}
      <div className="hidden lg:flex bg-navy text-navy-foreground p-12 flex-col justify-between relative overflow-hidden">
        <Link to="/" className="flex items-center gap-2 relative z-10">
          <div className="h-7 w-7 bg-primary flex items-center justify-center">
            <span className="text-white font-bold text-sm">E</span>
          </div>
          <span className="text-lg font-bold">EliteCoach</span>
        </Link>

        <div className="relative z-10">
          <h2 className="text-4xl font-bold leading-tight mb-4">
            Your AI coach
            <br />
            never sleeps.
          </h2>
          <p className="text-white/70 max-w-sm">
            Personalised learning paths, expert-built courses and an AI tutor
            that adapts to how you think.
          </p>
        </div>

        <div className="relative z-10 bg-white text-text-primary rounded-lg p-5 shadow-2xl max-w-xs">
          <div className="h-2 w-full bg-coral mb-3 rounded-sm" />
          <span className="label-caps text-text-secondary">In progress</span>
          <h3 className="text-base font-semibold mt-1 mb-3">
            Building Modern APIs
          </h3>
          <div className="h-1 w-full bg-surface rounded-sm overflow-hidden">
            <div className="h-full w-3/4 bg-coral" />
          </div>
          <div className="text-xs text-text-secondary mt-2">
            9 of 12 lessons
          </div>
        </div>

        <div className="absolute -top-20 -right-20 w-80 h-80 rounded-full bg-coral/20 blur-3xl" />
        <div className="absolute bottom-10 -left-10 w-80 h-80 rounded-full bg-primary/30 blur-3xl" />
      </div>

      {/* Right form panel */}
      <div className="flex flex-col items-center justify-center p-6 md:p-12 bg-surface-card">
        <div className="w-full max-w-md">
          <Link to="/" className="lg:hidden flex items-center gap-2 mb-8">
            <div className="h-7 w-7 bg-primary flex items-center justify-center">
              <span className="text-white font-bold text-sm">E</span>
            </div>
            <span className="text-lg font-bold">EliteCoach</span>
          </Link>
          <h1 className="text-3xl font-bold tracking-tight mb-2">{title}</h1>
          {subtitle && <p className="text-text-secondary mb-8">{subtitle}</p>}
          {children}
        </div>
      </div>
    </div>
  );
}
