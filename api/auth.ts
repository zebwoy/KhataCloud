import { handler } from '../netlify/functions/auth';
import { vercelWrapper } from './utils/vercelWrapper';

export default vercelWrapper(handler);
