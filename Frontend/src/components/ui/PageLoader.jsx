import LoadingSpinner from "./LoadingSpinner.jsx";

const PageLoader = ({ label = "Loading..." }) => {
  return (
    <div className="page-shell flex min-h-screen items-center justify-center px-4">
      <div className="glass-panel-strong flex max-w-md flex-col items-center rounded-[28px] px-8 py-10 text-center">
        <LoadingSpinner size="lg" />
        <h1 className="mt-6 text-2xl font-semibold text-slate-900 dark:text-slate-50">{label}</h1>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
          We are getting everything ready for you.
        </p>
      </div>
    </div>
  );
};

export default PageLoader;
