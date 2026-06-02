import { handler } from '../netlify/functions/entities';
import { vercelWrapper } from './utils/vercelWrapper';

export default vercelWrapper(handler);
