import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { act, useContext } from 'react';
import { createRoot } from 'react-dom/client';
import { AuthProvider } from '../src/features/auth/auth.context';
import { AuthContext } from '../src/features/auth/auth.state';
import PrivateStateBoundary from '../src/features/auth/components/PrivateStateBoundary';
import { InterviewContext } from '../src/features/interview/interview.state';
import { getMe } from '../src/services/auth.api';
import { useAuth } from '../src/features/auth/hooks/useAuth';
import { logout, register, login, verifyOtp } from '../src/services/auth.api';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import GuestOnly from '../src/features/auth/components/GuestOnly';

vi.mock('../src/services/auth.api', () => ({
  getMe: vi.fn(), logout: vi.fn(), login: vi.fn(), register: vi.fn(), verifyOtp: vi.fn(), resendOtp: vi.fn(),
}));
let root, element;
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
beforeEach(() => {
  vi.clearAllMocks();
  getMe.mockResolvedValue({ user: null });
  element = document.createElement('div');
  document.body.append(element);
  root = createRoot(element);
});
afterEach(async () => { await act(async () => root.unmount()); element.remove(); });

function Probe() {
  const { user, setUser, initialLoading } = useContext(AuthContext);
  const { report, setReport } = useContext(InterviewContext);
  const { handleLogout } = useAuth();
  return <>
    <div id="user">{initialLoading ? 'loading' : user?.id || 'guest'}</div>
    <div id="report">{report?.title || 'empty'}</div>
    <button id="a" onClick={() => setUser({ id: 'A' })}>A</button>
    <button id="b" onClick={() => setUser({ id: 'B' })}>B</button>
    <button id="save" onClick={() => setReport({ title: 'private resume' })}>Save</button>
    <button id="logout" onClick={handleLogout}>Logout</button>
  </>;
}
const mount = () => act(async () => root.render(<AuthProvider><PrivateStateBoundary><Probe /></PrivateStateBoundary></AuthProvider>));
const click = id => act(async () => element.querySelector('#' + id).click());

test('duplicate registration displays the API error and never signals OTP navigation', async () => {
  const message = 'A user with this username or email already exists. Please sign in or recover your password.';
  register.mockRejectedValue({ response: { status: 409, data: { message } } });
  let result;
  function RegistrationProbe() {
    const { handleRegister, error } = useAuth();
    return <><p id="error">{error}</p><button id="register" onClick={async () => {
      result = await handleRegister({ username: 'existing', email: 'user@example.com', password: 'ExamplePass9' });
    }}>Register</button></>;
  }
  await act(async () => root.render(<AuthProvider><RegistrationProbe /></AuthProvider>));
  await click('register');
  expect(result).toEqual({ success: false });
  expect(element.querySelector('#error').textContent).toBe(message);
});

test('refresh restores user through get-me; account changes clear private state', async () => {
  getMe.mockResolvedValue({ user: { id: 'A' } });
  await mount();
  expect(element.querySelector('#user').textContent).toBe('A');
  expect(getMe).toHaveBeenCalled();
  await click('save');
  expect(element.querySelector('#report').textContent).toBe('private resume');
  await click('b');
  expect(element.querySelector('#report').textContent).toBe('empty');
});

test('logout failure still clears user and private cached data', async () => {
  logout.mockRejectedValue(new Error('offline'));
  await mount();
  await click('a');
  await click('save');
  await click('logout');
  expect(element.querySelector('#user').textContent).toBe('guest');
  expect(element.querySelector('#report').textContent).toBe('empty');
});

test('disabled browser storage cannot prevent logout clearing private state', async () => {
  logout.mockResolvedValue({ success: true });
  await mount(); await click('a'); await click('save');
  const storage = vi.spyOn(Storage.prototype, 'removeItem').mockImplementation(() => { throw new Error('disabled'); });
  try {
    await click('logout');
    expect(element.querySelector('#user').textContent).toBe('guest');
    expect(element.querySelector('#report').textContent).toBe('empty');
  } finally { storage.mockRestore(); }
});

test('focus refresh detects an account change and drops the previous report', async () => {
  getMe.mockResolvedValue({ user: { id: 'A' } });
  await mount(); await click('save');
  getMe.mockResolvedValue({ user: { id: 'B' } });
  await act(async () => window.dispatchEvent(new Event('focus')));
  expect(element.querySelector('#user').textContent).toBe('B');
  expect(element.querySelector('#report').textContent).toBe('empty');
});

test('401 notification clears user and private data', async () => {
  await mount(); await click('a'); await click('save');
  await act(async () => window.dispatchEvent(new Event('auth:unauthorized')));
  expect(element.querySelector('#user').textContent).toBe('guest');
  expect(element.querySelector('#report').textContent).toBe('empty');
});

test('temporary session-check failure on focus does not sign out a known user', async () => {
  getMe.mockResolvedValue({ user: { id: 'A' } });
  await mount();
  getMe.mockRejectedValue({ response: { status: 503 } });
  await act(async () => window.dispatchEvent(new Event('focus')));
  expect(element.querySelector('#user').textContent).toBe('A');
});

test('a late initial get-me response cannot replace a newer login', async () => {
  let resolve;
  getMe.mockImplementation(() => new Promise(done => { resolve = done; }));
  await mount(); await click('b');
  await act(async () => resolve({ user: { id: 'A' } }));
  expect(element.querySelector('#user').textContent).toBe('B');
});

test('legacy JWT storage is cleared and token URLs are never imported', async () => {
  localStorage.setItem('token', 'synthetic-legacy-token');
  sessionStorage.setItem('token', 'synthetic-legacy-token');
  window.history.replaceState({}, '', '/?token=synthetic-untrusted-token');
  await mount();
  expect(localStorage.getItem('token')).toBe(null);
  expect(sessionStorage.getItem('token')).toBe(null);
  expect(window.location.search).toBe('');
  expect(element.querySelector('#user').textContent).toBe('guest');
});

for (const action of ['login', 'otp']) {
  test(`${action} confirms cookie session and shows success before navigating`, async () => {
    vi.useFakeTimers();
    const authenticated = { id: 'A' };
    login.mockResolvedValue({ user: authenticated });
    verifyOtp.mockResolvedValue({ user: authenticated });
    function SignIn() {
      const { handleLogin, handleVerifyOtp } = useAuth();
      return <button id="submit" onClick={() => action === 'login'
        ? handleLogin({ email: 'user@example.com', password: 'ExamplePass9' })
        : handleVerifyOtp({ email: 'user@example.com', otp: '123456' })}>Submit</button>;
    }
    try {
      await act(async () => root.render(<AuthProvider><PrivateStateBoundary><MemoryRouter initialEntries={['/login']}><Routes>
        <Route path="/login" element={<GuestOnly><SignIn /></GuestOnly>} />
        <Route path="/workspace" element={<p id="workspace">Workspace</p>} />
      </Routes></MemoryRouter></PrivateStateBoundary></AuthProvider>));
      getMe.mockResolvedValue({ user: authenticated });
      await click('submit');
      expect(element.querySelector('[role="status"]').textContent).toContain('You’re signed in!');
      expect(element.querySelector('#workspace')).toBeNull();
      await act(async () => vi.advanceTimersByTime(899));
      expect(element.querySelector('#workspace')).toBeNull();
      await act(async () => vi.advanceTimersByTime(1));
      expect(element.querySelector('#workspace')).not.toBeNull();
    } finally { vi.useRealTimers(); }
  });
}

test('blocked session cookie never produces authenticated state or success', async () => {
  login.mockResolvedValue({ user: { id: 'A' } });
  let result;
  function SignIn() {
    const { handleLogin, user, error } = useAuth();
    return <><p id="user">{user?.id || 'guest'}</p><p id="error">{error}</p><button id="submit" onClick={async () => {
      result = await handleLogin({ email: 'user@example.com', password: 'ExamplePass9' });
    }}>Submit</button></>;
  }
  await act(async () => root.render(<AuthProvider><SignIn /></AuthProvider>));
  getMe.mockRejectedValue({ response: { status: 401 } });
  await click('submit');
  expect(result.success).toBe(false);
  expect(element.querySelector('#user').textContent).toBe('guest');
  expect(element.querySelector('#error').textContent).toContain('session could not be confirmed');
});
