import { Navigate } from "react-router-dom";
import PageLoader from "../../../components/ui/PageLoader.jsx";
import { useAuth } from "../hooks/useAuth";

const Protected = ({ children }) => {
  const { initialLoading, user } = useAuth();

  if (initialLoading) {
    return <PageLoader label="Checking your session..." />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default Protected;
