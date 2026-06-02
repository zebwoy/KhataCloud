import { handler } from '../netlify/functions/transactions';
import { vercelWrapper } from './utils/vercelWrapper';

export default vercelWrapper(handler);
