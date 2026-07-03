import { Request, Response, Router } from 'express';
import { google } from 'googleapis';
import { validateRequest } from '../lib/validateRequest.js';
import { youtubePlaylistQuerySchema } from '../../src/lib/validations.js';

const router = Router();

router.get('/youtube/playlist', validateRequest({ query: youtubePlaylistQuerySchema }), async (req: Request, res: Response) => {
  const playlistId = req.query.playlistId as string;
  const apiKey = process.env.YOUTUBE_API_KEY;

  if (!apiKey) {
    res.status(500).json({ error: 'YouTube API Key is not configured' });
    return;
  }

  try {
    const youtube = google.youtube({ version: 'v3', auth: apiKey });

    const playlistResponse = await youtube.playlists.list({
      part: ['snippet'],
      id: [playlistId],
    });

    if (!playlistResponse.data.items || playlistResponse.data.items.length === 0) {
      res.status(404).json({ error: 'Playlist not found' });
      return;
    }

    const playlist = playlistResponse.data.items[0];
    const playlistInfo = {
      title: playlist.snippet?.title,
      description: playlist.snippet?.description,
      thumbnail: playlist.snippet?.thumbnails?.maxres?.url || playlist.snippet?.thumbnails?.high?.url,
    };

    const videos: any[] = [];
    let nextPageToken: string | undefined | null = undefined;

    do {
      const playlistItemsResponse: any = await youtube.playlistItems.list({
        part: ['snippet', 'contentDetails'],
        playlistId,
        maxResults: 50,
        pageToken: nextPageToken || undefined,
      });

      const items = playlistItemsResponse.data.items || [];
      videos.push(...items.map((item: any) => ({
        title: item.snippet.title,
        description: item.snippet.description,
        videoId: item.contentDetails.videoId,
        thumbnail: item.snippet.thumbnails?.high?.url || item.snippet.thumbnails?.default?.url,
        position: item.snippet.position,
      })));

      nextPageToken = playlistItemsResponse.data.nextPageToken;
    } while (nextPageToken);

    res.json({ playlist: playlistInfo, videos });
  } catch (error: any) {
    console.error('YouTube API Error:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch playlist data' });
  }
});

export default router;
