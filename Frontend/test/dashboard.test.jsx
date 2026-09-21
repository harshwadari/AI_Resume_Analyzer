import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { act, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { router as appRouter } from '../src/app.routes.jsx';
import { AuthProvider } from '../src/features/auth/auth.context.jsx';
import PrivateStateBoundary from '../src/features/auth/components/PrivateStateBoundary.jsx';
import AuthSuccess from '../src/features/auth/components/AuthSuccess.jsx';
import { ThemeProvider } from '../src/features/theme/theme.context.jsx';
import { getMe, logout } from '../src/services/auth.api.js';
import { createAnalysis, getAnalysis } from '../src/features/recruiter/services/analysis.api';

vi.mock('../src/features/recruiter/services/analysis.api', () => ({ createAnalysis: vi.fn(), getAnalysis: vi.fn() }));
const sampleJD = '  Backend engineer with Node.js experience. Build reliable APIs, write tests, review code, and collaborate with product teams on MongoDB applications.\n  ';

vi.mock('../src/services/auth.api.js', () => ({
  getMe: vi.fn(), login: vi.fn(), logout: vi.fn(), register: vi.fn(),
  verifyOtp: vi.fn(), resendOtp: vi.fn(), deleteAccount: vi.fn(),
  getGoogleAuthUrl: vi.fn(), forgotPassword: vi.fn(), resetPassword: vi.fn(),
  reauthenticate: vi.fn(), getGoogleLinkUrl: vi.fn(), contact: vi.fn(),
}));

let root, element, router;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
beforeEach(() => {
  vi.clearAllMocks();
  // jsdom does not implement the browser dialog methods used by the existing header.
  Object.defineProperty(HTMLDialogElement.prototype, 'close', { configurable: true, value() { this.removeAttribute('open'); } });
  Object.defineProperty(HTMLDialogElement.prototype, 'showModal', { configurable: true, value() { this.setAttribute('open', ''); } });
  localStorage.setItem('prepwise-theme', 'dark');
  getMe.mockResolvedValue({ user: { id: 'A', username: 'Candidate' } });
  createAnalysis.mockImplementation(async rawJDText => ({ id: 'saved-analysis', recruiter: 'A', sourceType: 'text', rawJDText, status: 'draft' }));
  getAnalysis.mockResolvedValue({ id: 'saved-analysis', recruiter: 'A', sourceType: 'text', rawJDText: sampleJD, status: 'draft' });
  element = document.createElement('div');
  document.body.append(element);
  root = createRoot(element);
});
afterEach(async () => {
  await act(async () => root.unmount());
  router?.dispose();
  router = null;
  element.remove();
  vi.useRealTimers();
});
const mount = async path => {
  router = createMemoryRouter(appRouter.routes, { initialEntries: [path] });
  await act(async () => root.render(<ThemeProvider><AuthProvider><PrivateStateBoundary><RouterProvider router={router} /></PrivateStateBoundary></AuthProvider></ThemeProvider>));
};
const clickLink = selector => act(async () => element.querySelector(selector).click());
const clickButton = text => act(async () => [...element.querySelectorAll('button')].find(button => button.textContent.trim() === text).click());
const fillField = async (selector, value) => {
  const input = element.querySelector(selector);
  const prototype = input.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(prototype, 'value').set.call(input, value);
    input.dispatchEvent(new Event('input', { bubbles: true }));
  });
};

test('JD validation prevents saving and step bypass; valid raw text is saved once before preview', async () => {
  await mount('/recruiter/analysis/new');
  await clickButton('Save JD & continue');
  expect(element.textContent).toContain('Add at least 100 characters');
  await clickButton('4Start analysis');
  expect(element.textContent).toContain('Step 1 of 4');
  await fillField('#analysis-jd', 'x'.repeat(20001));
  await clickButton('Save JD & continue');
  expect(element.textContent).toContain('at most 20,000 characters');
  expect(createAnalysis).not.toHaveBeenCalled();
  await fillField('#analysis-jd', sampleJD);
  expect(element.querySelector('details pre').textContent).toBe(sampleJD);
  await clickButton('Save JD & continue');
  expect(createAnalysis.mock.calls[0][0]).toBe(sampleJD);
  for (let step = 2; step <= 3; step++) {
    expect(element.textContent).toContain(`Step ${step} of 4`);
    await clickButton('Continue');
  }
  expect(element.textContent).toContain('0 selected · not uploaded');
  expect([...element.querySelectorAll('button')].find(button => button.textContent === 'Start analysis').disabled).toBe(true);
  await clickButton('Finish preview');
  expect(element.textContent).toContain('Your original JD is saved. No resumes were uploaded or processed');
  expect(element.textContent).toContain('Not started');
  await clickButton('Back');
  expect(element.textContent).toContain('Step 3 of 4');
  await clickButton('1Job Description');
  expect(element.querySelector('#analysis-jd').readOnly).toBe(true);
  await clickButton('Continue');
  expect(createAnalysis).toHaveBeenCalledTimes(1);
});

test('failed JD save retains input and retries without claiming success', async () => {
  createAnalysis.mockRejectedValueOnce({ response: { data: { message: 'Database unavailable' } } });
  await mount('/recruiter/analysis/new');
  await fillField('#analysis-jd', sampleJD);
  await clickButton('Save JD & continue');
  expect(element.textContent).toContain('Database unavailable');
  expect(element.querySelector('#analysis-jd').value).toBe(sampleJD);
  expect(element.textContent).not.toContain('JD saved as draft');
  await clickButton('Save JD & continue');
  expect(element.textContent).toContain('JD saved as draft');
  await clickLink('a[href="/recruiter/analysis/saved-analysis"]');
  expect(element.querySelector('pre').textContent).toBe(sampleJD);
  expect(getAnalysis.mock.calls.at(-1)[0]).toBe('saved-analysis');
});

test('wizard preserves edits and files across steps, validates Top-K, and clears on leaving', async () => {
  await mount('/recruiter/analysis/new');
  await fillField('#analysis-jd', sampleJD);
  await clickButton('Save JD & continue');
  const pdf = new File(['synthetic preview'], 'resume.pdf', { type: 'application/pdf' });
  const invalid = new File(['text'], 'notes.txt', { type: 'text/plain' });
  const picker = element.querySelector('#analysis-resumes');
  await act(async () => {
    Object.defineProperty(picker, 'files', { configurable: true, value: [pdf, pdf, invalid] });
    picker.dispatchEvent(new Event('change', { bubbles: true }));
  });
  expect(element.textContent).toContain('1 resume selected');
  expect(element.textContent).toContain('Other files were skipped');
  await clickButton('Continue');
  await clickLink('input[value="top"]');
  await fillField('#analysis-top-k', '0');
  expect(element.querySelector('#analysis-top-k').getAttribute('aria-invalid')).toBe('true');
  await clickButton('4Start analysis');
  expect(element.textContent).toContain('Step 3 of 4');
  await fillField('#analysis-top-k', '5');
  expect(element.textContent).toContain('Top-K cannot exceed the 1 selected resume');
  await clickButton('4Start analysis');
  expect(element.textContent).toContain('Step 3 of 4');
  await fillField('#analysis-top-k', '1');
  await clickButton('Continue');
  expect(element.textContent).toContain('Backend engineer with Node.js experience');
  expect(element.textContent).toContain('Top 1 candidates');
  expect(element.textContent).toContain('1 selected · not uploaded');
  await clickButton('Finish preview');
  await clickButton('1Job Description');
  expect(element.querySelector('#analysis-jd').value).toBe(sampleJD);
  await clickButton('Continue');
  expect(element.textContent).toContain('resume.pdf');
  await clickLink('button[aria-label="Remove resume.pdf"]');
  expect(element.textContent).toContain('0 resumes selected');
  await clickButton('4Start analysis');
  expect(element.textContent).toContain('Top-K cannot exceed the 0 selected resumes');
  await clickLink('input[value="all"]');
  await clickButton('Continue');
  expect(element.textContent).toContain('Step 4 of 4');
  await clickLink('a[href="/recruiter"]');
  await clickLink('a[href="/recruiter/analysis/new"]');
  expect(element.querySelector('#analysis-jd').value).toBe('');
});

test('wizard discards private draft when the authenticated account changes', async () => {
  await mount('/recruiter/analysis/new');
  await fillField('#analysis-jd', 'Private role for account A');
  getMe.mockResolvedValue({ user: { id: 'B', username: 'Other recruiter' } });
  await act(async () => window.dispatchEvent(new Event('focus')));
  expect(element.querySelector('#analysis-jd').value).toBe('');
  expect(element.textContent).toContain('Step 1 of 4');
});

test('selection cards open the recruiter dashboard and the existing candidate workspace', async () => {
  await mount('/dashboard');
  expect(element.textContent).toContain('Choose your workspace');
  await clickLink('a[aria-label="Recruiter"]');
  expect(router.state.location.pathname).toBe('/recruiter');
  expect(element.textContent).toContain('Recent analyses');
  expect(element.textContent).toContain('Your next candidate search starts here');
  await clickLink('a[aria-label="Back to dashboard selection"]');
  await clickLink('a[aria-label="Candidate"]');
  expect(router.state.location.pathname).toBe('/workspace');
  expect(element.textContent).toContain('Generate your interview strategy');
  expect(element.querySelector('input[type="file"]')).not.toBeNull();
});

test('dashboard isolates fictional analyses behind an explicit sample preview', async () => {
  await mount('/recruiter');
  expect(element.querySelector('[aria-label="Sample analyses"]')).toBeNull();
  expect(element.textContent).not.toContain('Senior Machine Learning Engineer');
  const preview = element.querySelector('button[aria-controls="recruiter-analysis-content"]');
  await act(async () => preview.click());
  expect(preview.getAttribute('aria-expanded')).toBe('true');
  expect(element.textContent).toContain('They are not your data');
  expect(element.textContent).toContain('120 resumes');
  expect(element.textContent).toContain('Top 10');
  expect(element.textContent).toContain('All candidates');
  expect(element.textContent).toContain('Incomplete · needs attention');
  expect(element.querySelectorAll('[aria-label="Sample analyses"] article')).toHaveLength(4);
  expect(element.querySelector('[aria-label="Sample analyses"] a')).toBeNull();
  await act(async () => preview.click());
  expect(element.querySelector('[aria-label="Sample analyses"]')).toBeNull();
  await clickLink('a[href="/recruiter/analysis/new"]');
  expect(router.state.location.pathname).toBe('/recruiter/analysis/new');
});

test.each(['/dashboard', '/recruiter', '/recruiter/analysis/new', '/recruiter/analysis/example', '/recruiter/analysis/example/candidates', '/recruiter/analysis/example/chat', '/workspace', '/interview/example', '/auth/success'])('%s requires authentication on direct navigation', async path => {
  getMe.mockResolvedValue({ user: null });
  await mount(path);
  expect(router.state.location.pathname).toBe('/login');
  expect(element.textContent).toContain('Login to continue');
});

test.each([
  ['/recruiter/analysis/new', 'New Candidate Analysis'],
  ['/recruiter/analysis/example', 'Analysis overview'],
  ['/recruiter/analysis/example/candidates', 'Candidates and results'],
  ['/recruiter/analysis/example/chat', 'Analysis chat'],
])('authenticated direct navigation renders %s inside the recruiter layout', async (path, heading) => {
  await mount(path);
  expect(router.state.location.pathname).toBe(path);
  expect(element.querySelector('#recruiter-page-title')?.textContent).toBe(heading);
  expect(element.querySelectorAll('nav[aria-label="Recruiter navigation"]')).toHaveLength(1);
  expect(element.querySelectorAll('header')).toHaveLength(1);
  expect(element.textContent).toContain('Logout');
});

test('recruiter navigation keeps the selected analysis when switching results and chat', async () => {
  await mount('/recruiter/analysis/example');
  await clickLink('a[href="/recruiter/analysis/example/candidates"]');
  expect(element.querySelector('#recruiter-page-title')?.textContent).toBe('Candidates and results');
  expect(element.querySelector('a[aria-current="page"]')?.textContent).toBe('Candidates / results');
  await clickLink('a[href="/recruiter/analysis/example/chat"]');
  expect(element.querySelector('#recruiter-page-title')?.textContent).toBe('Analysis chat');
  await clickLink('a[href="/recruiter/analysis/example"]');
  expect(element.querySelector('#recruiter-page-title')?.textContent).toBe('Analysis overview');
  await clickLink('a[href="/recruiter#analyses"]');
  expect(element.querySelector('#analyses')).not.toBeNull();
  await clickLink('a[href="/recruiter/analysis/new"]');
  expect(element.querySelector('#recruiter-page-title')?.textContent).toBe('New Candidate Analysis');
  expect(element.querySelector('a[href$="/new/candidates"]')).toBeNull();
  expect([...element.querySelectorAll('button')].find(button => button.textContent === 'Candidates / results')?.disabled).toBe(true);
});

test('logout from a recruiter child route uses existing authentication and blocks reentry', async () => {
  logout.mockResolvedValue({ success: true });
  await mount('/recruiter/analysis/example/chat');
  const logoutButton = [...element.querySelectorAll('button')].find(button => button.textContent.trim() === 'Logout');
  await act(async () => logoutButton.click());
  expect(logout).toHaveBeenCalledTimes(1);
  expect(router.state.location.pathname).toBe('/');
  await act(async () => router.navigate('/recruiter/analysis/example/candidates'));
  expect(router.state.location.pathname).toBe('/login');
});

test.each([
  ['/dashboard', 'Choose your workspace'],
  ['/recruiter', 'Recruiter dashboard'],
  ['/workspace', 'Generate your interview strategy'],
])('restored session loads %s directly without a success countdown', async (path, heading) => {
  await mount(path);
  expect(router.state.location.pathname).toBe(path);
  expect(element.querySelector('h1')?.textContent).toBe(heading);
  expect(element.textContent).not.toContain('Authentication successful');
});

test('refreshing an auth form with an existing session goes directly to selection', async () => {
  await mount('/login');
  expect(router.state.location.pathname).toBe('/dashboard');
});

test('OAuth landing confirms the session, counts down, and replaces its history entry', async () => {
  vi.useFakeTimers();
  await mount('/auth/success');
  expect(getMe).toHaveBeenCalled();
  expect(element.textContent).toContain('in 3');
  await act(async () => vi.advanceTimersByTime(1000));
  expect(element.textContent).toContain('in 2');
  await act(async () => vi.advanceTimersByTime(1000));
  expect(element.textContent).toContain('in 1');
  await act(async () => vi.advanceTimersByTime(1000));
  expect(router.state.location.pathname).toBe('/dashboard');
  expect(router.state.historyAction).toBe('REPLACE');
  await act(async () => vi.advanceTimersByTime(10000));
  expect(router.state.location.pathname).toBe('/dashboard');
});

test('navigating away cancels the OAuth countdown instead of redirecting later', async () => {
  vi.useFakeTimers();
  await mount('/auth/success');
  await act(async () => vi.advanceTimersByTime(1000));
  await act(async () => router.navigate('/workspace'));
  await act(async () => vi.advanceTimersByTime(10000));
  expect(router.state.location.pathname).toBe('/workspace');
});

test('success timer completes once under StrictMode and cleans up on unmount', async () => {
  vi.useFakeTimers();
  const complete = vi.fn();
  await act(async () => root.render(<StrictMode><AuthSuccess onComplete={complete} /></StrictMode>));
  await act(async () => vi.advanceTimersByTime(2999));
  expect(complete).not.toHaveBeenCalled();
  await act(async () => vi.advanceTimersByTime(1));
  expect(complete).toHaveBeenCalledTimes(1);
  await act(async () => vi.advanceTimersByTime(10000));
  expect(complete).toHaveBeenCalledTimes(1);
  await act(async () => root.render(null));
  expect(vi.getTimerCount()).toBe(0);
});
