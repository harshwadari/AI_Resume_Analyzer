import { useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import AuthSuccess from '../components/AuthSuccess.jsx';

// OAuth returns here after setting the cookie. Protected confirms the session
// before this transition mounts; refreshing simply starts a fresh countdown.
export default function AuthRedirect() {
  const navigate = useNavigate();
  const complete = useCallback(() => navigate('/dashboard', { replace: true }), [navigate]);
  return <AuthSuccess onComplete={complete} />;
}
