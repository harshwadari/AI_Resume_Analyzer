import { Navigate } from "react-router-dom";
import PageLoader from "../../../components/ui/PageLoader.jsx";
import { useAuth } from "../hooks/useAuth";
import { useCallback, useContext } from 'react';
import { AuthContext } from '../auth.state';
import AuthSuccess from './AuthSuccess';

const GuestOnly = ({ children }) => {
  const { user, initialLoading } = useAuth();
  const { authSuccess, setAuthSuccess } = useContext(AuthContext);
  const complete = useCallback(() => setAuthSuccess(false), [setAuthSuccess]);

  if (initialLoading) {
    return <PageLoader label="Preparing authentication..." />;
  }

  if (user) {
    if (authSuccess) return <AuthSuccess onComplete={complete} />;
    return <Navigate to="/dashboard" replace />;
  }

  return children;
};

export default GuestOnly;
