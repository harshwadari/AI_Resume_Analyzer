import { Navigate } from "react-router-dom";
import PageLoader from "../../../components/ui/PageLoader.jsx";
import { useAuth } from "../hooks/useAuth";

const GuestOnly = ({ children }) => {
  const { user, initialLoading } = useAuth();

  if (initialLoading) {
    return <PageLoader label="Preparing authentication..." />;
  }

  if (user) {
    return <Navigate to="/workspace" replace />;
  }

  return children;
};

export default GuestOnly;
