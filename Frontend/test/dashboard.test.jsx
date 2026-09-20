import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { act, StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createMemoryRouter, RouterProvider } from 'react-router-dom';
import { router as appRouter } from '../src/app.routes.jsx';
import { AuthProvider } from '../src/features/auth/auth.context.jsx';
import PrivateStateBoundary from '../src/features/auth/components/PrivateStateBoundary.jsx';
import AuthSuccess from '../src/features/auth/components/AuthSuccess.jsx';
import { ThemeProvider } from '../src/features/theme/theme.context.jsx';
import { getMe } from '../src/services/auth.api.js';

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

test('selection cards open the recruiter placeholder and the existing candidate workspace', async () => {
  await mount('/dashboard');
  expect(element.textContent).toContain('Choose your workspace');
  await clickLink('a[aria-label="Recruiter"]');
  expect(router.state.location.pathname).toBe('/recruiter');
  expect(element.textContent).toContain('Your recruiter workspace is coming soon');
  await clickLink('a[aria-label="Back to dashboard selection"]');
  await clickLink('a[aria-label="Candidate"]');
  expect(router.state.location.pathname).toBe('/workspace');
  expect(element.textContent).toContain('Generate your interview strategy');
  expect(element.querySelector('input[type="file"]')).not.toBeNull();
});

test.each(['/dashboard', '/recruiter', '/workspace', '/interview/example', '/auth/success'])('%s requires authentication on direct navigation', async path => {
  getMe.mockResolvedValue({ user: null });
  await mount(path);
  expect(router.state.location.pathname).toBe('/login');
  expect(element.textContent).toContain('Login to continue');
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
