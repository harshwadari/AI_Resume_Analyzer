import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import ProcessingProgress from '../src/features/recruiter/components/ProcessingProgress';
import ResumeUploads from '../src/features/recruiter/components/ResumeUploads';
import { getProcessingProgress, startResumeProcessing, listResumes } from '../src/features/recruiter/services/analysis.api';

vi.mock('../src/features/recruiter/services/analysis.api', () => ({
  getProcessingProgress: vi.fn(), startResumeProcessing: vi.fn(), listResumes: vi.fn(),
  uploadResumes: vi.fn(), uploadResumeZip: vi.fn(),
}));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root, element;
const job = (completed, failed = 0) => ({ id: 'job-100', total: 100, completed, processed: completed - failed, failed,
  queued: 100 - completed, processing: 0, status: completed === 100 ? failed ? 'COMPLETED_WITH_ERRORS' : 'COMPLETED' : 'RUNNING' });
const tick = () => act(async () => { await vi.advanceTimersByTimeAsync(2000); });
const click = text => act(async () => [...element.querySelectorAll('button')].find(button => button.textContent === text).click());
beforeEach(() => {
  vi.resetAllMocks(); vi.useFakeTimers();
  element = document.createElement('div'); document.body.append(element); root = createRoot(element);
});
afterEach(async () => { await act(async () => root.unmount()); element.remove(); vi.useRealTimers(); });

test('progress renders 0/100, intermediate counts, 100/100 and supports subsequent uploads', async () => {
  getProcessingProgress.mockResolvedValue(job(0));
  await act(async () => root.render(<ProcessingProgress analysisId="analysis" />));
  await tick();
  expect(element.textContent).toContain('0/100 (0%)');
  for (const count of [1, 50, 100]) {
    getProcessingProgress.mockResolvedValue(job(count)); await tick();
    expect(element.querySelector('[role="progressbar"]').getAttribute('aria-valuenow')).toBe(String(count));
    expect(element.textContent).toContain(`${count}/100 (${count}%)`);
  }
  expect(element.textContent).toContain('Job ID: job-100');
  startResumeProcessing.mockResolvedValue({ ...job(0), id: 'new-job' });
  await click('Process new uploads');
  expect(startResumeProcessing).toHaveBeenCalledWith('analysis', false);
  expect(element.textContent).toContain('Job ID: new-job');
});

test('failed files show names, errors and attempts; polling preserves page 2 and retry only targets failures', async () => {
  getProcessingProgress.mockResolvedValue(job(100, 1));
  listResumes.mockImplementation(async (_, page) => ({ total: 100, page, pageSize: 50,
    resumes: [{ id: `file-${page}`, originalFilename: page === 2 ? 'unreadable.pdf' : 'good.pdf',
      size: 300, processingStatus: page === 2 ? 'FAILED' : 'PROCESSED', attempts: page === 2 ? 3 : 1,
      processingError: page === 2 ? 'File could not be read or processing timed out.' : null, createdAt: new Date().toISOString() }] }));
  await act(async () => root.render(<ResumeUploads analysisId="analysis" />)); await tick();
  await click('Next'); await tick();
  expect(element.textContent).toContain('Page 2 of 2');
  expect(element.textContent).toContain('unreadable.pdf');
  expect(element.textContent).toContain('File could not be read or processing timed out. (Attempts: 3)');
  startResumeProcessing.mockResolvedValue({ ...job(0), total: 1 });
  await click('Retry failed files');
  expect(startResumeProcessing).toHaveBeenCalledWith('analysis', true);
});

test('slow progress requests never overlap and unmount cancels polling', async () => {
  let resolve;
  getProcessingProgress.mockImplementation(() => new Promise(done => { resolve = done; }));
  await act(async () => root.render(<ProcessingProgress analysisId="analysis" />));
  await tick(); await tick(); await tick();
  expect(getProcessingProgress).toHaveBeenCalledTimes(1);
  const signal = getProcessingProgress.mock.calls[0][1].signal;
  await act(async () => root.unmount());
  expect(signal.aborted).toBe(true);
  await act(async () => resolve(job(100)));
  root = createRoot(element);
});

test('OCR-required resumes finish progress and are clearly distinguished from extraction failures', async () => {
  getProcessingProgress.mockResolvedValue({ ...job(100), processed: 99, ocrRequired: 1, status: 'COMPLETED_WITH_ERRORS' });
  listResumes.mockResolvedValue({ total: 1, page: 1, pageSize: 50, resumes: [{ id: 'scanned', originalFilename: 'scanned-resume.pdf',
    size: 300, processingStatus: 'OCR_REQUIRED', attempts: 1, processingError: null, createdAt: new Date().toISOString() }] });
  await act(async () => root.render(<ResumeUploads analysisId="analysis" />)); await tick();
  expect(element.textContent).toContain('100/100 (100%)');
  expect(element.textContent).toContain('99 extracted · 1 need OCR · 0 failed');
  expect(element.textContent).toContain('scanned-resume.pdf');
  expect(element.textContent).toContain('OCR_REQUIRED');
  expect(element.textContent).toContain('OCR required: no usable text was found.');
  expect(element.textContent).toContain('Automatic OCR is not available yet.');
  expect(element.textContent).not.toContain('1 file failed.');
});
