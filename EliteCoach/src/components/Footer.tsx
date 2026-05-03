import { Link } from "@tanstack/react-router";
import { Logo } from "@/components/Logo";

export function Footer() {
  return (
    <footer className="bg-[#161616] text-white">
      <div className="container-1200 py-16">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-12">
          <div className="col-span-2 md:col-span-1">
            <div className="mb-4">
              <Logo size={36} variant="light" />
            </div>
            <p className="text-sm text-white/60 leading-relaxed max-w-xs">
              Learn without limits. AI-powered learning paths and tutors built
              for serious learners and the organisations that grow them.
            </p>
            <div className="flex items-center gap-3 mt-6">
              {["TW", "IG", "LI", "YT"].map((s) => (
                <a
                  key={s}
                  href="#"
                  className="h-9 w-9 inline-flex items-center justify-center border border-white/15 text-xs font-mono text-white/70 hover:bg-white hover:text-[#161616] transition-colors"
                >
                  {s}
                </a>
              ))}
            </div>
          </div>
          <div>
            <div className="label-caps text-white/60 mb-4">Learn</div>
            <ul className="space-y-3 text-sm">
              <li>
                <Link to="/courses" className="text-white/80 hover:text-white">
                  Courses
                </Link>
              </li>
              <li>
                <Link
                  to="/learning-path"
                  className="text-white/80 hover:text-white"
                >
                  Learning Paths
                </Link>
              </li>
              <li>
                <Link
                  to="/dashboard"
                  className="text-white/80 hover:text-white"
                >
                  Dashboard
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <div className="label-caps text-white/60 mb-4">Company</div>
            <ul className="space-y-3 text-sm">
              <li>
                <a href="#" className="text-white/80 hover:text-white">
                  About
                </a>
              </li>
              <li>
                <a href="#" className="text-white/80 hover:text-white">
                  For organisations
                </a>
              </li>
              <li>
                <a href="#" className="text-white/80 hover:text-white">
                  Careers
                </a>
              </li>
            </ul>
          </div>
          <div>
            <div className="label-caps text-white/60 mb-4">Legal</div>
            <ul className="space-y-3 text-sm">
              <li>
                <a href="#" className="text-white/80 hover:text-white">
                  Privacy
                </a>
              </li>
              <li>
                <a href="#" className="text-white/80 hover:text-white">
                  Terms
                </a>
              </li>
              <li>
                <a href="#" className="text-white/80 hover:text-white">
                  Contact
                </a>
              </li>
            </ul>
          </div>
        </div>
        <div className="border-t border-white/10 mt-12 pt-8 text-xs text-white/50">
          © {new Date().getFullYear()} EliteCoach. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
