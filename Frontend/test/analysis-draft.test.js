import { expect, test } from 'vitest';
import { analysisDraftReducer, createAnalysisDraft, topKError } from '../src/features/recruiter/state/analysisDraft';
import { jdTextError } from '../src/features/recruiter/utils/jdValidation';

test('Top-K accepts equality, rejects excess, revalidates removals, and always permits all candidates', () => {
  let draft = createAnalysisDraft('A');
  draft = analysisDraftReducer(draft, { type: 'addResumes', files: Array.from({ length: 10 }, (_, i) => new File(['pdf'], `${i}.pdf`)) });
  draft = analysisDraftReducer(draft, { type: 'resultMode', mode: 'top' });
  expect(topKError(draft)).toBe('');
  draft = analysisDraftReducer(draft, { type: 'topK', value: '11' });
  expect(topKError(draft)).toContain('10 selected resumes');
  expect(analysisDraftReducer(draft, { type: 'finishPreview' }).previewComplete).toBe(false);
  draft = analysisDraftReducer(draft, { type: 'topK', value: '10' });
  expect(topKError(draft)).toBe('');
  draft = analysisDraftReducer(draft, { type: 'removeResume', index: 0 });
  expect(topKError(draft)).toContain('9 selected resumes');
  expect(draft.analysis.requestedTopK).toBeNull();
  draft = analysisDraftReducer(draft, { type: 'resultMode', mode: 'all' });
  expect(topKError(draft)).toBe('');
  expect(draft.analysis.requestedTopK).toBeNull();
});

test('JD validation has inclusive bounds and does not count surrounding whitespace as content', () => {
  expect(jdTextError('x'.repeat(100))).toBe('');
  expect(jdTextError('界'.repeat(20000))).toBe('');
  expect(jdTextError(' '.repeat(100))).not.toBe('');
  expect(jdTextError('  ' + 'x'.repeat(99) + '  ')).not.toBe('');
  expect(jdTextError('x'.repeat(20001))).not.toBe('');
});

test('finishing a configured preview retains ownership and never starts processing or invents results', () => {
  const initial = createAnalysisDraft('recruiter-A');
  let draft = analysisDraftReducer(initial, { type: 'jd', text: 'Engineer' });
  draft = analysisDraftReducer(draft, { type: 'addResumes', files: Array.from({ length: 5 }, (_, i) => new File(['pdf'], `${i}.pdf`)) });
  draft = analysisDraftReducer(draft, { type: 'resultMode', mode: 'top' });
  draft = analysisDraftReducer(draft, { type: 'topK', value: '5' });
  draft = analysisDraftReducer(draft, { type: 'finishPreview' });
  expect(draft.previewComplete).toBe(true);
  expect(draft.analysis).toMatchObject({ recruiter: 'recruiter-A', requestedTopK: 5, processingState: 'not_started', results: [], rankingConfiguration: { criteria: [], weights: null } });
  expect(initial.analysis.jd.text).toBe('');
  expect(analysisDraftReducer(draft, { type: 'resultMode', mode: 'all' }).analysis.requestedTopK).toBeNull();
  expect(createAnalysisDraft('recruiter-B').analysis).toMatchObject({ recruiter: 'recruiter-B', jd: { text: '', document: null }, resumes: [], results: [] });
});
