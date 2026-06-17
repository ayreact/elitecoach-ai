// API base URLs for the EliteCoach microservices.
// These are the live deployed services from the spec.
export const API_URLS = {
    identity: import.meta.env.VITE_API_URL || "https://elitecoach-ai-vve2.onrender.com",
    aiTutor: import.meta.env.VITE_API_URL || "https://elitecoach-ai-vve2.onrender.com",
    assessments: import.meta.env.VITE_API_URL || "https://elitecoach-ai-vve2.onrender.com",
    acs: import.meta.env.VITE_API_URL || "https://elitecoach-ai-vve2.onrender.com",
    content: import.meta.env.VITE_API_URL || "https://elitecoach-ai-vve2.onrender.com",
    notifications: import.meta.env.VITE_API_URL || "https://elitecoach-ai-vve2.onrender.com",
} as const;
