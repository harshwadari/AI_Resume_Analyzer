import { useContext } from 'react';
import { AuthContext } from '../auth.state';
import { InterviewProvider } from '../../interview/interview.context';

export default function PrivateStateBoundary({ children }) {
  const { user } = useContext(AuthContext);
  return <InterviewProvider key={user?.id || 'guest'}>{children}</InterviewProvider>;
}
