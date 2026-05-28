const sizeClasses = {
  sm: "h-4 w-4 border-2",
  md: "h-6 w-6 border-2",
  lg: "h-10 w-10 border-[3px]"
};

const LoadingSpinner = ({ size = "md", className = "" }) => {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-slate-300/30 border-t-fuchsia-500 ${sizeClasses[size]} ${className}`}
      aria-hidden="true"
    />
  );
};

export default LoadingSpinner;
