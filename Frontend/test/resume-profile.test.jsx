import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import ResumeProfile from '../src/features/recruiter/components/ResumeProfile';
import { getResumeProfile } from '../src/features/recruiter/services/analysis.api';
vi.mock('../src/features/recruiter/services/analysis.api', () => ({ getResumeProfile: vi.fn() }));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root, element;
beforeEach(() => { vi.resetAllMocks(); element = document.createElement('div'); document.body.append(element); root = createRoot(element); });
afterEach(async () => { await act(async () => root.unmount()); element.remove(); });
test('profile opens on demand with unknown values, source evidence, versions and chunks', async () => {
  getResumeProfile.mockResolvedValue({ candidateProfile: { candidateName: 'Example', email: null, skills: [],
    experiences: [{ company: 'Example Co', evidence: [{ pageNumber: 1, text: 'Built APIs' }] }], rawText: 'Source' },
    rawText: 'Source', parserVersion: 'candidate-v1', modelVersion: 'fixture-v1',
    chunks: [{ chunkIndex: 0, section: 'job_experience', pageStart: 1, pageEnd: 2, text: 'Source' }] });
  await act(async () => root.render(<ResumeProfile analysisId="analysis" resumeId="resume" />));
  expect(getResumeProfile).not.toHaveBeenCalled();
  await act(async () => element.querySelector('button').click());
  expect(element.textContent).toContain('Unknown / not stated');
  expect(element.textContent).toContain('Built APIs');
  expect(element.textContent).toContain('fixture-v1');
  expect(element.textContent).toContain('Pages 1–2');
  await act(async () => element.querySelector('button').click());
  expect(element.querySelector('section')).toBeNull();
});
test('profile access errors are visible and loading is aborted on unmount', async () => {
  getResumeProfile.mockRejectedValue(new Error('forbidden'));
  await act(async () => root.render(<ResumeProfile analysisId="analysis" resumeId="resume" />));
  await act(async () => element.querySelector('button').click());
  expect(element.querySelector('[role="alert"]').textContent).toContain('Unable to load');
  const signal = getResumeProfile.mock.calls[0][2].signal;
  await act(async () => root.unmount());
  expect(signal.aborted).toBe(true);
  root = createRoot(element);
});
