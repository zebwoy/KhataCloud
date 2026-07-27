import { Handler, HandlerEvent } from '@netlify/functions';

export function vercelWrapper(netlifyHandler: Handler) {
  return async (req: any, res: any) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') return res.status(200).end();

    const queryStringParameters: Record<string, string> = {};
    if (req.query) {
      Object.keys(req.query).forEach(k => {
        const v = req.query[k];
        queryStringParameters[k] = Array.isArray(v) ? v[0] : String(v || '');
      });
    }

    const headers: Record<string, string> = {};
    if (req.headers) {
      Object.keys(req.headers).forEach(k => {
        const v = req.headers[k];
        headers[k] = Array.isArray(v) ? v[0] : String(v || '');
      });
    }

    let bodyStr = '';
    if (req.body) bodyStr = typeof req.body === 'string' ? req.body : JSON.stringify(req.body);

    const event: HandlerEvent = {
      rawUrl: req.url || '',
      rawQuery: req.url?.split('?')[1] || '',
      path: req.url?.split('?')[0] || '',
      httpMethod: req.method || 'GET',
      headers,
      multiValueHeaders: {},
      queryStringParameters,
      multiValueQueryStringParameters: {},
      body: bodyStr,
      isBase64Encoded: false,
    };

    try {
      const result = await netlifyHandler(event, {} as any, () => {});
      if (result) {
        if (result.headers) Object.keys(result.headers).forEach(k => res.setHeader(k, String(result.headers![k])));
        res.status(result.statusCode).send(result.body);
      } else {
        res.status(500).json({ error: 'No response from handler' });
      }
    } catch (err: any) {
      console.error('Vercel adapter error:', err);
      res.status(500).json({ error: err.message || 'Internal Server Error' });
    }
  };
}
