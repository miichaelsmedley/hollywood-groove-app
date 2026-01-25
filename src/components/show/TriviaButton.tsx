import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { HelpCircle } from 'lucide-react';
import { useShow } from '../../contexts/ShowContext';

export default function TriviaButton() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { liveTrivia } = useShow();

  // Check if trivia is live (question or answer phase)
  const isTriviaLive = liveTrivia &&
    liveTrivia.phase !== 'idle' &&
    liveTrivia.activityId;

  // Check if we're already on the trivia page
  const isOnTriviaPage = location.pathname.endsWith('/trivia');

  // Don't render if trivia isn't live or we're already on trivia page
  if (!isTriviaLive || isOnTriviaPage) {
    return null;
  }

  const handleClick = () => {
    if (id) {
      navigate(`/shows/${id}/trivia`);
    }
  };

  return (
    <button
      onClick={handleClick}
      className="flex-1 flex flex-col items-center justify-center gap-0.5 px-2 py-2 rounded-xl bg-primary/20 border border-primary text-primary hover:bg-primary/30 transition-all active:scale-95 min-w-0"
    >
      <HelpCircle className="w-4 h-4 shrink-0" />
      <span className="text-xs font-bold truncate">
        {liveTrivia.phase === 'question' ? 'Answer!' : 'Answer'}
      </span>
    </button>
  );
}
