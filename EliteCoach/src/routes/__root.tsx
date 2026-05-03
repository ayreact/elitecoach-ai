import {
    Outlet,
    Link,
    createRootRoute,
    HeadContent,
    Scripts,
} from "@tanstack/react-router";
import { EliteToaster } from "@/components/EliteToaster";

import appCss from "../styles.css?url";

function NotFoundComponent() {
    return (
        <div className="flex min-h-screen items-center justify-center bg-surface px-4">
            <div className="max-w-md text-center">
                <h1 className="text-7xl font-bold text-text-primary">404</h1>
                <h2 className="mt-4 text-xl font-semibold text-text-primary">
                    Page not found
                </h2>
                <p className="mt-2 text-sm text-text-secondary">
                    The page you're looking for doesn't exist or has been moved.
                </p>
                <div className="mt-6">
                    <Link
                        to="/"
                        className="inline-flex items-center justify-center h-11 bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary-hover transition-colors"
                    >
                        Go home
                    </Link>
                </div>
            </div>
        </div>
    );
}

export const Route = createRootRoute({
    head: () => ({
        meta: [
            { charSet: "utf-8" },
            {
                name: "viewport",
                content: "width=device-width, initial-scale=1",
            },
            { title: "EliteCoach — Learn without limits" },
            {
                name: "description",
                content:
                    "EliteCoach is an AI-powered e-learning platform with personalised learning paths, AI tutors and structured courses for serious learners and organisations.",
            },
            { name: "author", content: "EliteCoach" },
            {
                property: "og:title",
                content: "EliteCoach — Learn without limits",
            },
            {
                property: "og:description",
                content:
                    "AI-powered learning paths and tutors for serious learners.",
            },
            { property: "og:type", content: "website" },
            { name: "twitter:card", content: "summary" },
        ],
        links: [
            { rel: "preconnect", href: "https://fonts.googleapis.com" },
            {
                rel: "preconnect",
                href: "https://fonts.gstatic.com",
                crossOrigin: "anonymous",
            },
            {
                rel: "stylesheet",
                href: "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@300;400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap",
            },
            { rel: "stylesheet", href: appCss },
        ],
    }),
    shellComponent: RootShell,
    component: RootComponent,
    notFoundComponent: NotFoundComponent,
});

function RootShell({ children }: { children: React.ReactNode }) {
    return (
        <html lang="en" suppressHydrationWarning>
            <head>
                <HeadContent />
            </head>
            <body>
                {children}
                <Scripts />
            </body>
        </html>
    );
}

function RootComponent() {
    return (
        <>
            <Outlet />
            <EliteToaster />
        </>
    );
}
