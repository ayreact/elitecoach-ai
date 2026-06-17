import { Link, useNavigate } from "@tanstack/react-router";
import { useAuthStore } from "@/lib/stores";
import { useState } from "react";
import { Menu, X } from "lucide-react";
import { Logo } from "@/components/Logo";
import { NotificationsMenu } from "@/components/NotificationsMenu";

export function TopNav() {
  const { isLoggedIn, user, logout } = useAuthStore();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const handleLogout = () => {
    logout();
    navigate({ to: "/" });
  }; 

  const roles = user?.roles ?? [];
  const isTutor = roles.includes("tutor_author") || roles.includes("tutor_responder");
  const isLearner = roles.includes("solo_learner") || roles.includes("org_learner") || roles.length === 0;

  return (
    <header className="sticky top-0 z-40 h-16 bg-surface-card border-b border-border">
      <div className="container-1200 flex h-full items-center justify-between">
        <Link to="/" className="flex items-center">
          <Logo size={28} variant="dark" />
        </Link>

        <nav className="hidden md:flex items-center gap-8">
          {(!isLoggedIn || isLearner) && (
            <>
              <Link
                to="/courses"
                className="text-sm font-medium text-text-primary hover:text-primary transition-colors"
                activeProps={{ className: "text-primary" }}
              >
                Courses
              </Link>
              <Link
                to="/verify-certificate"
                className="text-sm font-medium text-text-primary hover:text-primary transition-colors"
                activeProps={{ className: "text-primary" }}
              >
                Verify Certificate
              </Link>
            </>
          )}
          {isLoggedIn && isLearner && (
            <Link
              to="/dashboard"
              className="text-sm font-medium text-text-primary hover:text-primary transition-colors"
              activeProps={{ className: "text-primary" }}
            >
              Dashboard
            </Link>
          )}
          {isLoggedIn && isLearner && (
            <Link
              to="/learning-path"
              className="text-sm font-medium text-text-primary hover:text-primary transition-colors"
              activeProps={{ className: "text-primary" }}
            >
              Learning Path
            </Link>
          )}
          {isTutor && (
            <>
              <Link
                to="/tutor/courses"
                className="text-sm font-medium text-text-primary hover:text-primary transition-colors"
                activeProps={{ className: "text-primary" }}
              >
                Tutor CMS
              </Link>
              <Link
                to="/tutor/inbox"
                className="text-sm font-medium text-text-primary hover:text-primary transition-colors"
                activeProps={{ className: "text-primary" }}
              >
                Tutor Inbox
              </Link>
            </>
          )}
        </nav>

        <div className="hidden md:flex items-center gap-3">
          {isLoggedIn ? (
            <>
              <Link
                to="/profile"
                className="text-sm font-medium text-text-primary hover:text-primary"
              >
                {user?.firstName ?? "Profile"}
              </Link>
              <NotificationsMenu />
              <button
                onClick={handleLogout}
                className="h-11 px-4 border border-border text-sm font-medium hover:bg-surface transition-colors"
              >
                Log out
              </button>
            </>
          ) : (
            <>
              <Link
                to="/login"
                className="h-11 px-4 inline-flex items-center text-sm font-medium text-text-primary hover:text-primary"
              >
                Log in
              </Link>
              <Link
                to="/register"
                className="h-11 px-4 inline-flex items-center bg-primary text-primary-foreground text-sm font-medium hover:bg-primary-hover transition-colors"
              >
                Start for free →
              </Link>
            </>
          )}
        </div>

        <button
          className="md:hidden p-2"
          onClick={() => setOpen((v) => !v)}
          aria-label="Toggle navigation"
        >
          {open ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      {open && (
        <div className="md:hidden bg-surface-card border-t border-border">
          <div className="container-1200 py-4 flex flex-col gap-3">
            {(!isLoggedIn || isLearner) && (
              <>
                <Link
                  to="/courses"
                  onClick={() => setOpen(false)}
                  className="py-2 text-sm font-medium"
                >
                  Courses
                </Link>
                <Link
                  to="/verify-certificate"
                  onClick={() => setOpen(false)}
                  className="py-2 text-sm font-medium"
                >
                  Verify Certificate
                </Link>
              </>
            )}
            {isLoggedIn && isLearner && (
              <Link
                to="/dashboard"
                onClick={() => setOpen(false)}
                className="py-2 text-sm font-medium"
              >
                Dashboard
              </Link>
            )}
            {isLoggedIn && isLearner && (
              <Link
                to="/learning-path"
                onClick={() => setOpen(false)}
                className="py-2 text-sm font-medium"
              >
                Learning Path
              </Link>
            )}
            {isTutor && (
              <>
                <Link
                  to="/tutor/courses"
                  onClick={() => setOpen(false)}
                  className="py-2 text-sm font-medium"
                >
                  Tutor CMS
                </Link>
                <Link
                  to="/tutor/inbox"
                  onClick={() => setOpen(false)}
                  className="py-2 text-sm font-medium"
                >
                  Tutor Inbox
                </Link>
              </>
            )}
            {isLoggedIn ? (
              <>
                <Link
                  to="/profile"
                  onClick={() => setOpen(false)}
                  className="py-2 text-sm font-medium"
                >
                  Profile
                </Link>
                <button
                  onClick={handleLogout}
                  className="py-2 text-sm font-medium text-left"
                >
                  Log out
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/login"
                  onClick={() => setOpen(false)}
                  className="py-2 text-sm font-medium"
                >
                  Log in
                </Link>
                <Link
                  to="/register"
                  onClick={() => setOpen(false)}
                  className="py-2 text-sm font-medium text-primary"
                >
                  Start for free →
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
