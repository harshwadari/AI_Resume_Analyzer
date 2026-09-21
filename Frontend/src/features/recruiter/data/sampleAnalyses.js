// UI preview only. Never merge these fixtures into API responses or persisted state.
// The dashboard shows them only after an explicit "Preview sample analyses" click.
export const sampleAnalyses = [
  { id: 'sample-completed', title: 'Senior Machine Learning Engineer', status: 'completed', resumeCount: 120, topK: 10, processedCount: 120, completion: 'Ready for review' },
  { id: 'sample-processing', title: 'Backend Engineer', status: 'processing', resumeCount: 80, topK: 5, processedCount: 48, completion: '48 of 80 resumes processed' },
  { id: 'sample-draft', title: 'Product Designer', status: 'draft', resumeCount: 12, topK: null, processedCount: 0, completion: 'Not started' },
  { id: 'sample-failed', title: 'Data Analyst', status: 'failed', resumeCount: 30, topK: 10, processedCount: 18, completion: 'Incomplete · needs attention' },
];
