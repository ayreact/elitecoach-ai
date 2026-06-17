import axios from 'axios';

// Configure the base axios instance
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor for attaching auth tokens
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Response interceptor for global error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      console.error('Unauthorized, dispatching logout event...');
      // Dispatch a custom event so the auth provider can log the user out
      window.dispatchEvent(new CustomEvent('auth:unauthorized'));
    }
    return Promise.reject(error);
  }
);

// Auth specific API calls
export const authApi = {
  login: async (data: URLSearchParams) => {
    const response = await api.post('/api/v1/auth/login', data, {
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
    });
    return response.data;
  },
  getMe: async () => {
    const response = await api.get('/api/v1/auth/me');
    return response.data;
  },
  logout: async () => {
    try {
      await api.post('/api/v1/auth/logout');
    } catch (e) {
      console.error('Logout request failed', e);
    }
  },
};
