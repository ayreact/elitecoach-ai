// API base URLs for the EliteCoach microservices.
// These are the live deployed services from the spec.
export const API_URLS = {
    identity: import.meta.env.VITE_API_URL_IDENTITY || "https://elitecoach-ai-r05o.onrender.com",
    aiTutor: import.meta.env.VITE_API_URL_AI_TUTOR || "https://elitecoach-ai-2-ih4m.onrender.com",
    assessments: import.meta.env.VITE_API_URL_ASSESSMENTS || "https://elitecoach-ai-2-ih4m.onrender.com",
    acs: import.meta.env.VITE_API_URL_ACS || "https://elitecoach-ai-acs.onrender.com",
    content: import.meta.env.VITE_API_URL_CONTENT || "https://elitecoach-ai-ccms.onrender.com",
    notifications: import.meta.env.VITE_API_URL_NOTIFICATIONS || "https://elitecoach-ai-1-2qbv.onrender.com",
} as const;
