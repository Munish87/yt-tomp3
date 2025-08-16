import ytdl from 'ytdl-core';
import ffmpeg from 'fluent-ffmpeg';
import { createRequire } from 'module';
import rateLimit from 'express-rate-limit';

// Create require function for CommonJS modules
const require = createRequire(import.meta.url);

// Load ffmpeg-static using CommonJS require
const ffmpegPath = require('ffmpeg-static');

// Set ffmpeg path
ffmpeg.setFfmpegPath(ffmpegPath);

// Rate limiter
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5, // limit each IP to 5 requests per window
  message: 'Too many conversion requests, please try again later'
});

export default async (req, res) => {
  // Apply rate limiter
  limiter(req, res, async () => {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { url } = req.body;

    if (!url) {
      return res.status(400).json({ error: 'URL is required' });
    }

    try {
      // Validate YouTube URL
      const isValid = ytdl.validateURL(url);
      if (!isValid) {
        return res.status(400).json({ error: 'Invalid YouTube URL' });
      }

      // Get video info
      const info = await ytdl.getInfo(url);
      const videoDetails = info.videoDetails;
      const title = videoDetails.title;
      const duration = parseInt(videoDetails.lengthSeconds);

      // Add video duration limit (10 minutes max)
      const MAX_DURATION = 600; // 10 minutes in seconds
      if (duration > MAX_DURATION) {
        return res.status(400).json({ 
          error: 'Videos longer than 10 minutes are not supported on the free plan' 
        });
      }

      // Create a pass-through stream for more efficient processing
      const audioStream = ytdl(url, {
        quality: 'highestaudio',
        highWaterMark: 1 << 25 // 32MB buffer instead of default 512MB
      });

      // Create converter stream
      const converter = ffmpeg(audioStream)
        .audioBitrate(128)
        .toFormat('mp3')
        .on('error', error => {
          console.error('FFmpeg error:', error);
          res.status(500).json({ error: 'Conversion failed' });
        });

      // Stream directly to response
      res.setHeader('Content-Type', 'audio/mpeg');
      res.setHeader('Content-Disposition', `attachment; filename="${title.replace(/[^a-z0-9]/gi, '_')}.mp3"`);
      
      converter.pipe(res);

    } catch (error) {
      console.error('Conversion error:', error);
      res.status(500).json({ error: 'Conversion failed', details: error.message });
    }
  });
};
