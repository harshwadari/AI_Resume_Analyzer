import React, { useEffect, useMemo, useState } from "react";
import { ChevronDown, ChevronUp, Code2, Download, Map, MessageSquareText } from "lucide-react";
import { useParams } from "react-router-dom";
import WorkspaceHeader from "../../../components/layout/WorkspaceHeader.jsx";
import PageLoader from "../../../components/ui/PageLoader.jsx";
import { useInterview } from "../hooks/useInterview";
import { downloadInterviewReportPdf } from "../utils/interviewPdf";

const SECTION_CONFIG = {
  technical: {
    label: "Technical Questions",
    icon: Code2
  },
  behavioral: {
    label: "Behavioral Questions",
    icon: MessageSquareText
  },
  roadmap: {
    label: "Road Map",
    icon: Map
  }
};

const severityClasses = {
  low: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  medium: "border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-200",
  high: "border-orange-500/30 bg-orange-500/10 text-orange-700 dark:text-orange-200"
};

const Interview = () => {
  const { interviewId } = useParams();
  const { getReportById, report, loading, error } = useInterview();
  const [activeSection, setActiveSection] = useState("technical");
  const [openItems, setOpenItems] = useState({});

  useEffect(() => {
    if (!interviewId) {
      return;
    }

    getReportById(interviewId).catch(() => {});
  }, [getReportById, interviewId]);

  useEffect(() => {
    if (!report) {
      return;
    }

    setOpenItems({
      technical: { 0: true },
      behavioral: {},
      roadmap: {}
    });
  }, [report?._id]);

  const sectionItems = useMemo(() => {
    if (!report) {
      return {
        technical: [],
        behavioral: [],
        roadmap: []
      };
    }

    return {
      technical: report.technicalQuestions || [],
      behavioral: report.behavioralQuestions || [],
      roadmap: report.preparationPlan || []
    };
  }, [report]);

  const toggleItem = (sectionKey, index) => {
    setOpenItems((current) => ({
      ...current,
      [sectionKey]: {
        ...current[sectionKey],
        [index]: !current[sectionKey]?.[index]
      }
    }));
  };

  if (loading && !report) {
    return <PageLoader label="Loading your interview report..." />;
  }

  if (error && !report) {
    return (
      <div className="page-shell flex min-h-screen items-center justify-center px-4">
        <div className="glass-panel-strong max-w-xl rounded-[28px] px-8 py-10 text-center text-rose-600 dark:text-rose-200">
          {error}
        </div>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="page-shell flex min-h-screen items-center justify-center px-4">
        <div className="glass-panel-strong max-w-xl rounded-[28px] px-8 py-10 text-center text-slate-700 dark:text-slate-200">
          No interview report found.
        </div>
      </div>
    );
  }

  const activeItems = sectionItems[activeSection] || [];
  const score = Number.isFinite(report?.matchScore) ? Math.max(0, Math.min(100, report.matchScore)) : 0;
  const scoreDegrees = (score / 100) * 360;

  const renderCardContent = (sectionKey, item, index) => {
    if (sectionKey === "roadmap") {
      return (
        <div className="space-y-5">
          <div>
            <span className="inline-flex rounded-md bg-sky-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-sky-600 dark:text-sky-300">
              Focus
            </span>
            <p className="mt-3 text-sm leading-7 text-slate-700 dark:text-slate-300">{item.focus}</p>
          </div>

          <div>
            <span className="inline-flex rounded-md bg-fuchsia-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-fuchsia-600 dark:text-fuchsia-300">
              Tasks
            </span>
            <div className="mt-3 flex flex-wrap gap-2">
              {(item.tasks || []).map((task, taskIndex) => (
                <span
                  key={`${index}-task-${taskIndex}`}
                  className="rounded-full border border-slate-300/70 bg-white px-3 py-2 text-sm text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-200"
                >
                  {task}
                </span>
              ))}
            </div>
          </div>

          {!!item.resources?.length && (
            <div>
              <span className="inline-flex rounded-md bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-300">
                Resources
              </span>
              <div className="mt-3 flex flex-wrap gap-2">
                {item.resources.map((resource, resourceIndex) => (
                  <span
                    key={`${index}-resource-${resourceIndex}`}
                    className="rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-200"
                  >
                    {resource}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    return (
      <div className="space-y-5">
        <div>
          <span className="inline-flex rounded-md bg-indigo-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-indigo-600 dark:text-indigo-300">
            Intention
          </span>
          <p className="mt-3 text-sm leading-7 text-slate-700 dark:text-slate-300">{item.intention}</p>
        </div>

        <div>
          <span className="inline-flex rounded-md bg-emerald-500/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-emerald-600 dark:text-emerald-300">
            Model Answer
          </span>
          <p className="mt-3 text-sm leading-7 text-slate-700 dark:text-slate-300">{item.answer}</p>
        </div>
      </div>
    );
  };

  return (
    <div className="page-shell px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-[1600px]">
        <WorkspaceHeader
          title={report.title || "Interview Report"}
          subtitle="Review your tailored interview questions, understand your fit for the role, and download the report when you are ready to revise offline."
          showBack
        />

        <div className="mb-6 flex justify-end">
          <button
            type="button"
            onClick={() => downloadInterviewReportPdf(report)}
            className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-fuchsia-500 to-orange-400 px-5 py-3 text-sm font-semibold text-white transition hover:-translate-y-0.5"
          >
            <Download size={16} />
            Download PDF
          </button>
        </div>

        <div className="glass-panel-strong overflow-hidden rounded-[32px]">
          <div className="grid lg:grid-cols-[280px,minmax(0,1fr),330px]">
            <aside className="border-b border-slate-200/70 bg-white/70 p-8 dark:border-white/10 dark:bg-slate-950/70 lg:border-b-0 lg:border-r">
              <div className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-500">
                Sections
              </div>

              <div className="mt-6 space-y-2">
                {Object.entries(SECTION_CONFIG).map(([key, section]) => {
                  const Icon = section.icon;
                  const isActive = activeSection === key;
                  const count = sectionItems[key]?.length || 0;

                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setActiveSection(key)}
                      className={`flex w-full items-center justify-between rounded-2xl border px-4 py-3 text-left transition ${
                        isActive
                          ? "border-fuchsia-500/30 bg-fuchsia-500/12 text-slate-950 dark:text-white"
                          : "border-transparent text-slate-500 hover:border-slate-300/70 hover:bg-slate-900/5 hover:text-slate-900 dark:text-slate-400 dark:hover:border-white/10 dark:hover:bg-white/5 dark:hover:text-white"
                      }`}
                    >
                      <span className="flex items-center gap-3">
                        <Icon size={18} className={isActive ? "text-fuchsia-500 dark:text-fuchsia-300" : "text-slate-400 dark:text-slate-500"} />
                        <span className="text-lg font-medium">{section.label}</span>
                      </span>
                      <span className="rounded-full bg-slate-900/5 px-2.5 py-1 text-xs text-slate-600 dark:bg-white/5 dark:text-slate-300">
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </aside>

            <main className="border-b border-slate-200/70 p-8 dark:border-white/10 lg:border-b-0 lg:border-r">
              <div className="mb-8 flex flex-col gap-3 border-b border-slate-200/70 pb-6 dark:border-white/10 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <div className="text-sm uppercase tracking-[0.24em] text-slate-500">{report.title || "Interview Report"}</div>
                  <div className="mt-2 flex flex-wrap items-center gap-3">
                    <h1 className="text-3xl font-semibold text-slate-950 dark:text-white">{SECTION_CONFIG[activeSection].label}</h1>
                    <span className="rounded-full bg-slate-900/5 px-4 py-1 text-sm text-slate-600 dark:bg-white/5 dark:text-slate-300">
                      {activeItems.length} items
                    </span>
                  </div>
                </div>
              </div>

              {!!report.overallSummary && (
                <div className="mb-6 rounded-3xl border border-slate-300/70 bg-slate-50 p-5 text-sm leading-7 text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300">
                  {report.overallSummary}
                </div>
              )}

              {!!report.strengths?.length && (
                <div className="mb-6 flex flex-wrap gap-2">
                  {report.strengths.map((strength, index) => (
                    <span
                      key={`${strength}-${index}`}
                      className="rounded-full border border-sky-500/20 bg-sky-500/10 px-3 py-2 text-sm text-sky-700 dark:text-sky-200"
                    >
                      {strength}
                    </span>
                  ))}
                </div>
              )}

              <div className="space-y-4">
                {activeItems.map((item, index) => {
                  const isOpen = !!openItems[activeSection]?.[index];
                  const title = activeSection === "roadmap"
                    ? `Day ${item.day}: ${item.focus}`
                    : item.question;

                  return (
                    <div
                      key={`${activeSection}-${index}`}
                      className="overflow-hidden rounded-[26px] border border-slate-300/70 bg-white dark:border-white/10 dark:bg-slate-900/80"
                    >
                      <button
                        type="button"
                        onClick={() => toggleItem(activeSection, index)}
                        className="flex w-full items-start gap-4 px-5 py-5 text-left"
                      >
                        <span className="mt-1 rounded-lg bg-fuchsia-500/12 px-3 py-1 text-sm font-semibold text-fuchsia-600 dark:text-fuchsia-300">
                          {activeSection === "roadmap" ? `D${item.day}` : `Q${index + 1}`}
                        </span>
                        <span className="flex-1 text-xl font-semibold leading-8 text-slate-950 dark:text-white">
                          {title}
                        </span>
                        {isOpen ? <ChevronUp className="mt-1 text-fuchsia-500 dark:text-fuchsia-300" size={20} /> : <ChevronDown className="mt-1 text-slate-400" size={20} />}
                      </button>

                      {isOpen && (
                        <div className="border-t border-slate-200/70 px-5 py-5 dark:border-white/10">
                          {renderCardContent(activeSection, item, index)}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </main>

            <aside className="bg-slate-50/90 p-8 dark:bg-slate-950/80">
              <div className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-500">
                Match Score
              </div>

              <div className="mt-8 flex flex-col items-center">
                <div
                  className="grid h-40 w-40 place-items-center rounded-full"
                  style={{
                    background: `conic-gradient(#4ade80 ${scoreDegrees}deg, rgba(148,163,184,0.18) ${scoreDegrees}deg 360deg)`
                  }}
                >
                  <div className="grid h-32 w-32 place-items-center rounded-full bg-white shadow-inner dark:bg-slate-950">
                    <div className="text-center">
                      <div className="text-5xl font-semibold text-slate-950 dark:text-white">{score}</div>
                      <div className="text-lg text-slate-400">%</div>
                    </div>
                  </div>
                </div>

                <p className="mt-6 text-center text-2xl font-medium text-emerald-600 dark:text-emerald-400">
                  {score >= 75 ? "Strong match for this role" : score >= 50 ? "Promising match with prep" : "Needs focused preparation"}
                </p>
              </div>

              <div className="my-8 h-px bg-slate-200/70 dark:bg-white/10" />

              <div className="text-sm font-semibold uppercase tracking-[0.25em] text-slate-500">
                Skill Gaps
              </div>

              <div className="mt-5 space-y-3">
                {(report.skillGaps || []).map((gap, index) => (
                  <div
                    key={`${gap.skill}-${index}`}
                    className={`rounded-2xl border px-4 py-3 ${severityClasses[gap.severity] || severityClasses.medium}`}
                  >
                    <div className="text-xl font-medium">{gap.skill}</div>
                    {!!gap.recommendation && (
                      <div className="mt-2 text-sm leading-6 text-current/90">{gap.recommendation}</div>
                    )}
                  </div>
                ))}
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Interview;
