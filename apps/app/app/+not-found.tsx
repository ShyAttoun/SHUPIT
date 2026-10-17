import { Redirect } from 'expo-router';

/**
 * Any link that matches no screen (for example a private deep link delivered while the app is already
 * open) lands on Home instead of an "Unmatched Route" error page.
 */
export default function NotFound() {
  return <Redirect href="/" />;
}
