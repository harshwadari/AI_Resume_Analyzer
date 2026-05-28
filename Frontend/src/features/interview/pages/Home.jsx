import React, { useState } from "react";
import { AlertCircle, ArrowRight, BriefcaseBusiness, FileText, UploadCloud, UserRound } from "lucide-react";
import { useNavigate } from "react-router-dom";
import LoadingSpinner from "../../../components/ui/LoadingSpinner.jsx";
import WorkspaceHeader from "../../../components/layout/WorkspaceHeader.jsx";
import { useInterview } from "../hooks/useInterview";

const MAX_JOB_DESCRIPTION_LENGTH = 5000;

const Home = () => {
  const [jobDescription, setJobDescription] = useState("");
  const [selfDescription, setSelfDescription] = useState("");
  const [file, setFile] = useState(null);
  const [formError, setFormError] = useState("");
  const navigate = useNavigate();
  const { generateReport, loading, error } = useInterview();

  const handleFileChange = (event) => {
    const selectedFile = event.target.files?.[0] || null;
    setFile(selectedFile);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setFormError("");

    if (!jobDescription.trim()) {
      setFormError("Add the target job description before generating the interview plan.");
      return;
    }

    if (!selfDescription.trim() && !file) {
      setFormError("Add your self description or upload a resume so the report has candidate context.");
      return;
    }

    try {
      const interviewReport = await generateReport({
        jobDescription: jobDescription.trim(),
        selfDescription: selfDescription.trim(),
        resumeFile: file
      });

      if (interviewReport?._id) {
        navigate(`/interview/${interviewReport._id}`);
      }
    } catch (submitError) {
      console.error(submitError);
    }
  };

  return (
    <div className="page-shell px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl">
        <WorkspaceHeader
          title="Generate your interview strategy"
          subtitle="Paste the role you are targeting, add your resume or experience summary, and create a focused interview prep report in one step."
        />

        <form
          className="glass-panel-strong overflow-hidden rounded-[32px]"
          onSubmit={handleSubmit}
        >
          <div className="grid gap-px bg-slate-200/70 dark:bg-white/10 lg:grid-cols-[1.1fr,0.9fr]">
            <section className="bg-white/70 p-6 dark:bg-slate-900/80 sm:p-8">
              <div className="mb-5 flex items-center gap-3">
                <div className="rounded-2xl bg-fuchsia-500/15 p-3 text-fuchsia-500 dark:text-fuchsia-300">
                  <BriefcaseBusiness size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-slate-950 dark:text-white">Target Job Description</h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Paste the full role description you want to prepare for.
                  </p>
                </div>
              </div>

              <textarea
                value={jobDescription}
                onChange={(event) => setJobDescription(event.target.value.slice(0, MAX_JOB_DESCRIPTION_LENGTH))}
                placeholder="Paste the complete job description here..."
                className="h-[420px] w-full resize-none rounded-3xl border border-slate-300/70 bg-white px-5 py-4 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 focus:border-fuchsia-400 focus:ring-4 focus:ring-fuchsia-500/10 dark:border-white/10 dark:bg-slate-950/80 dark:text-slate-100"
              />

              <div className="mt-3 flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
                <span>Include responsibilities, required skills, and seniority if possible.</span>
                <span>{jobDescription.length}/{MAX_JOB_DESCRIPTION_LENGTH}</span>
              </div>
            </section>

            <section className="bg-slate-50/90 p-6 dark:bg-slate-950/90 sm:p-8">
              <div className="mb-5 flex items-center gap-3">
                <div className="rounded-2xl bg-emerald-500/15 p-3 text-emerald-600 dark:text-emerald-300">
                  <UserRound size={20} />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-slate-950 dark:text-white">Your Profile</h2>
                  <p className="text-sm text-slate-600 dark:text-slate-400">
                    Upload a resume, add a short summary, or use both for stronger results.
                  </p>
                </div>
              </div>

              <label className="group flex min-h-52 cursor-pointer flex-col items-center justify-center rounded-3xl border border-dashed border-slate-300/70 bg-white px-6 text-center transition hover:border-fuchsia-400/60 hover:bg-fuchsia-50 dark:border-white/10 dark:bg-slate-900/80 dark:hover:bg-slate-900">
                <div className="rounded-full bg-fuchsia-500/12 p-4 text-fuchsia-500 transition group-hover:scale-105 dark:text-fuchsia-300">
                  <UploadCloud size={28} />
                </div>
                <p className="mt-4 text-base font-medium text-slate-900 dark:text-white">
                  {file ? file.name : "Upload your resume"}
                </p>
                <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">PDF or DOCX, up to 5 MB</p>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx"
                  className="hidden"
                  onChange={handleFileChange}
                />
              </label>

              <div className="my-5 flex items-center gap-4 text-xs uppercase tracking-[0.28em] text-slate-400 dark:text-slate-500">
                <div className="h-px flex-1 bg-slate-300/80 dark:bg-white/10" />
                <span>Or add a quick summary</span>
                <div className="h-px flex-1 bg-slate-300/80 dark:bg-white/10" />
              </div>

              <div className="rounded-3xl border border-slate-300/70 bg-white p-4 dark:border-white/10 dark:bg-slate-900/80">
                <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
                  <FileText size={16} />
                  <span>Self Description</span>
                </div>
                <textarea
                  value={selfDescription}
                  onChange={(event) => setSelfDescription(event.target.value)}
                  placeholder="Summarize your experience, preferred stack, achievements, and interview goals..."
                  className="h-40 w-full resize-none bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400 dark:text-slate-100"
                />
              </div>

              <p className="mt-3 text-xs text-sky-600 dark:text-sky-300">
                Add at least one of these: resume or self description.
              </p>
            </section>
          </div>

          {(formError || error) && (
            <div className="border-t border-slate-200 bg-rose-50 px-6 py-4 text-sm text-rose-600 dark:border-white/10 dark:bg-rose-500/10 dark:text-rose-200 sm:px-8">
              <div className="flex items-start gap-3">
                <AlertCircle className="mt-0.5" size={16} />
                <span>{formError || error}</span>
              </div>
            </div>
          )}

          <div className="flex flex-col gap-4 bg-slate-100/80 px-6 py-6 dark:bg-slate-950/90 sm:flex-row sm:items-center sm:justify-between sm:px-8">
            <div className="max-w-2xl text-sm text-slate-600 dark:text-slate-400">
              After submission, you will be redirected to a full interview analysis screen with technical questions,
              behavioral questions, roadmap, skill gaps, match score, and PDF export.
            </div>

            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-fuchsia-500 via-pink-500 to-rose-500 px-6 py-3 text-sm font-semibold text-white transition hover:scale-[1.02] disabled:cursor-not-allowed disabled:opacity-70"
            >
              {loading && <LoadingSpinner size="sm" className="border-white/20 border-t-white" />}
              <span>{loading ? "Generating report..." : "Generate Interview Strategy"}</span>
              {!loading && <ArrowRight size={16} />}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Home;
