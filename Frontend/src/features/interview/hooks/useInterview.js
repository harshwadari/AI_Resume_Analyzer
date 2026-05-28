import { getInterviewReportById, getAllInterviewReports, getInterviewReport } from "../services/interview.api";
import { useCallback, useContext } from "react";
import { InterviewContext } from "../interview.context";


export const useInterview = () => {
    const context = useContext(InterviewContext);
    if (!context) {
        throw new Error("useInterview must be used within an InterviewProvider");
    }
    const { loading, setLoading, report, setReport, reports, setReports, error, setError } = context;


    const generateReport = useCallback(async ({ jobDescription, selfDescription, resumeFile }) => {
        setLoading(true);
        setError(null);
        try {
            const response = await getInterviewReport({ jobDescription, selfDescription, resumeFile });
            setReport(response.interviewReport);
            return response.interviewReport;
        } catch (err) {
            console.error(err);
            setError(err?.response?.data?.message || "Failed to generate interview report");
            throw err;
        } finally {
            setLoading(false);
        }
    }, [setError, setLoading, setReport]);
    const getReportById = useCallback(async (interviewId) => {
        setLoading(true);
        setError(null);
        try {
            const response = await getInterviewReportById(interviewId);
            setReport(response.interviewReport);
            return response.interviewReport;
        }
        catch (err) {
            console.error(err);
            setError(err?.response?.data?.message || "Failed to load interview report");
            throw err;
        } finally {
            setLoading(false);
        }
    }, [setError, setLoading, setReport]);

    const getReports = useCallback(async () => {
        setLoading(true);
        setError(null);
        try {
            const response = await getAllInterviewReports();
            setReports(response.interviewReports || []);
            return response.interviewReports || [];
        } catch (err) {
            console.error(err);
            setError(err?.response?.data?.message || "Failed to load interview reports");
            throw err;
        } finally {
            setLoading(false);
        }
    }, [setError, setLoading, setReports]);
    return {
        loading, report, reports, error, generateReport, getReportById, getReports


    };
};
