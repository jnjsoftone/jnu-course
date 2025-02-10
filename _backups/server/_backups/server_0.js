const express = require('express');
const fs = require('fs');
const path = require('path');
const https = require('https');

const app = express();
const PORT = 4000;
const VIDEO_BASE_PATH = '/volume1/video';

// HTTPS 인증서 설정
const options = {
  key: fs.readFileSync(path.join(__dirname, 'private.key')),
  cert: fs.readFileSync(path.join(__dirname, 'certificate.crt'))
};

// 비디오 스트리밍 미들웨어
app.get('/**/*.@(mkv|mp4|avi)', (req, res) => {
  const videoPath = path.join(VIDEO_BASE_PATH, req.path);

  // 파일 존재 여부 확인
  fs.access(videoPath, fs.constants.F_OK, (err) => {
    if (err) {
      console.error(`File not found: ${videoPath}`);
      return res.status(404).send('File not found');
    }

    // 파일 정보 가져오기
    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      // 범위 요청 처리
      const parts = range.replace(/bytes=/, '').split('-');
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(videoPath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'video/mp4'  // 기본값으로 mp4 설정
      };

      // 파일 확장자에 따른 Content-Type 설정
      switch (path.extname(videoPath).toLowerCase()) {
        case '.mkv':
          head['Content-Type'] = 'video/x-matroska';
          break;
        case '.avi':
          head['Content-Type'] = 'video/x-msvideo';
          break;
      }

      res.writeHead(206, head);
      file.pipe(res);
    } else {
      // 전체 파일 요청 처리
      const head = {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4'
      };

      // 파일 확장자에 따른 Content-Type 설정
      switch (path.extname(videoPath).toLowerCase()) {
        case '.mkv':
          head['Content-Type'] = 'video/x-matroska';
          break;
        case '.avi':
          head['Content-Type'] = 'video/x-msvideo';
          break;
      }

      res.writeHead(200, head);
      fs.createReadStream(videoPath).pipe(res);
    }
  });
});

// 404 에러 처리
app.use((req, res) => {
  res.status(404).send('Not Found');
});

// 에러 처리 미들웨어
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

// HTTPS 서버 시작
https.createServer(options, app).listen(PORT, '0.0.0.0', () => {
  console.log(`Video streaming server running at https://0.0.0.0:${PORT}`);
});
