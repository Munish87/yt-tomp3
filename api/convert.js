// Add these optimizations to your existing convert.js
import ytdl from 'ytdl-core';
import ffmpeg from 'fluent-ffmpeg';
import { PassThrough } from 'stream';

export default async (req, res) => {
  // ... existing validation code ...

  try {
    // ... existing video info code ...

    // Create a pass-through stream for more efficient processing
    const audioStream = ytdl(url, {
      quality: 'highestaudio',
      highWaterMark: 1 << 25 // 32MB buffer instead of default 512MB
    });

    // Create a converter stream
    const converter = ffmpeg(audioStream)
      .audioBitrate(128)
      .toFormat('mp3')
      .on('error', error => {
        console.error('FFmpeg error:', error);
        res.status(500).json({ error: 'Conversion failed' });
      });

    // Stream directly to response
    res.setHeader('Content-Type', 'audio/mpeg');
    res.setHeader('Content-Disposition', `attachment; filename="${title}.mp3"`);
    
    converter.pipe(res);

  } catch (error) {
    console.error('Conversion error:', error);
    res.status(500).json({ error: 'Conversion failed' });
  }
};
