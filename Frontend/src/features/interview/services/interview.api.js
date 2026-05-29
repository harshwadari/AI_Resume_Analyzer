import axios from "axios";

const rawBaseURL = import.meta.env.VITE_API_URL || "http://localhost:3000";
const api = axios.create({
    baseURL: rawBaseURL.replace(/\/$/, ""),
    withCredentials: true,
});

// Interceptor to attach Authorization header if token exists in localStorage
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem("token");
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);


export const getInterviewReport = async ({ jobDescription, selfDescription, resumeFile }) => {
    const formData = new FormData();
    formData.append("jobDescription", jobDescription);
    if (selfDescription) {
        formData.append("selfDescription", selfDescription);
    }
    if (resumeFile) {
        formData.append("resume", resumeFile);
    }

    const response = await api.post("/api/interview", formData, {
        headers: {
            "Content-Type": "multipart/form-data"
        }
    });

    return response.data;
};


export const getInterviewReportById = async (interviewId) => {
    const response = await api.get(`/api/interview/report/${interviewId}`);
    return response.data;
};


export const getAllInterviewReports = async () => {
    const response = await api.get("/api/interview");
    return response.data;
};
