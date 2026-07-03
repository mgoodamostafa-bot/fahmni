import { Request, Response, Router } from 'express';
import { Readable } from 'stream';
import { decryptUrl } from '../../src/utils/crypto.js';
import { getGoogleDriveDownloadUrl } from '../lib/middleware.js';
import { validateRequest } from '../lib/validateRequest.js';
import { fileProxyQuerySchema } from '../../src/lib/validations.js';

const router = Router();

router.get('/files/proxy', validateRequest({ query: fileProxyQuerySchema }), async (req: Request, res: Response) => {
  const { data, name, inline } = req.query;

  try {
    const targetUrl = await decryptUrl(data as string);
    if (!targetUrl) return res.status(400).json({ error: 'Invalid data parameter' });

    console.log(`[FILE PROXY] Decrypted URL: ${targetUrl}`);

    if (targetUrl.includes('drive.google.com') || targetUrl.includes('docs.google.com')) {
      if (inline === 'true') {
        return res.redirect(targetUrl);
      } else {
        const downloadUrl = getGoogleDriveDownloadUrl(targetUrl);
        return res.redirect(downloadUrl);
      }
    }

    console.log(`[FILE PROXY] Streaming URL: ${targetUrl}`);
    const response = await fetch(targetUrl);

    if (!response.ok) {
      return res.status(response.status).json({ error: `Failed to fetch file: ${response.statusText}` });
    }

    const contentType = response.headers.get('content-type') || 'application/octet-stream';
    const filename = name ? (name as string) : 'download';
    const disposition = inline === 'true' ? 'inline' : 'attachment';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `${disposition}; filename="${encodeURIComponent(filename)}"`);

    if (response.body) {
      const nodeReadable = Readable.fromWeb(response.body as any);
      nodeReadable.pipe(res);
    } else {
      res.end();
    }
  } catch (error: any) {
    console.error('[FILE PROXY] Error:', error);
    res.status(500).json({ error: error.message || 'Internal server error' });
  }
});

export default router;
