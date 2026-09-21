import LinkGoogle from './features/auth/pages/LinkGoogle.jsx';
import { createBrowserRouter } from "react-router-dom";
import GuestOnly from "./features/auth/components/GuestOnly.jsx";
import Protected from "./features/auth/components/Protected.jsx";
import Login from "./features/auth/pages/Login.jsx";
import Register from "./features/auth/pages/Register.jsx";
import VerifyOtp from "./features/auth/pages/VerifyOtp.jsx";
import ForgotPassword from "./features/auth/pages/ForgotPassword.jsx";
import ResetPassword from "./features/auth/pages/ResetPassword.jsx";
import Landing from "./features/marketing/pages/Landing.jsx";
import Home from "./features/interview/pages/Home.jsx";
import Interview from "./features/interview/pages/Interview.jsx";
import Dashboard from './features/dashboard/pages/Dashboard.jsx';
import Recruiter from './features/dashboard/pages/Recruiter.jsx';
import AuthRedirect from './features/auth/pages/AuthRedirect.jsx';
import RecruiterLayout from './features/recruiter/components/RecruiterLayout.jsx';
import RecruiterPlaceholder from './features/recruiter/pages/RecruiterPlaceholder.jsx';
import NewAnalysis from './features/recruiter/pages/NewAnalysis.jsx';
import AnalysisOverview from './features/recruiter/pages/AnalysisOverview.jsx';
import Settings, { SettingsContent } from './features/settings/pages/Settings.jsx';
import Profile from './features/settings/pages/Profile.jsx';

export const router = createBrowserRouter([
  { path: '/auth/success', element: <Protected><AuthRedirect /></Protected> },
  { path: '/dashboard', element: <Protected><Dashboard /></Protected> },
  { path: '/settings', element: <Protected><Settings /></Protected> },
  { path: '/profile', element: <Protected><Profile /></Protected> },
  {
    path: '/recruiter',
    element: <Protected><RecruiterLayout /></Protected>,
    children: [
      { index: true, element: <Recruiter /> },
      { path: 'settings', element: <SettingsContent /> },
      { path: 'analysis/new', element: <NewAnalysis /> },
      { path: 'analysis/:analysisId', element: <AnalysisOverview /> },
      { path: 'analysis/:analysisId/candidates', element: <RecruiterPlaceholder title="Candidates and results" description="Ranked candidates and supporting evidence will appear here when results are available." /> },
      { path: 'analysis/:analysisId/chat', element: <RecruiterPlaceholder title="Analysis chat" description="Questions about this analysis will be available here in a future checkpoint." /> },
    ],
  },
  { path: "/link-google", element: <Protected><LinkGoogle /></Protected> },
  {
    path: "/",
    element: <Landing />
  },
  {
    path: "/login",
    element: <GuestOnly><Login /></GuestOnly>
  },
  {
    path: "/register",
    element: <GuestOnly><Register /></GuestOnly>
  },
  {
    path: "/verify-otp",
    element: <GuestOnly><VerifyOtp /></GuestOnly>
  },
  {
    path: "/forgot-password",
    element: <ForgotPassword />
  },
  {
    path: "/reset-password/:token",
    element: <ResetPassword />
  },
  {
    path: "/workspace",
    element: <Protected><Home /></Protected>
  },
  {
    path: "/interview/:interviewId",
    element: <Protected><Interview /></Protected>
  }
]);
