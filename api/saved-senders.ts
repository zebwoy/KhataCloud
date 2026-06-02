import { handler } from '../netlify/functions/saved-senders';
import { vercelWrapper } from './utils/vercelWrapper';

export default vercelWrapper(handler);
