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

export const router = createBrowserRouter([
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
    element: <GuestOnly><ForgotPassword /></GuestOnly>
  },
  {
    path: "/reset-password/:token",
    element: <GuestOnly><ResetPassword /></GuestOnly>
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
