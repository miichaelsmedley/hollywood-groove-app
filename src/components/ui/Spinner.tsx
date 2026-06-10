export interface SpinnerProps {
  className?: string;
}

export default function Spinner({
  className = "w-8 h-8 border-4 border-primary border-t-transparent",
}: SpinnerProps) {
  return <div className={`${className} rounded-full animate-spin`} />;
}
