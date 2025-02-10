const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 4000;
const VIDEO_BASE_PATH = '/volume1/video';

// CORS 설정
app.use(cors());

// 디버깅을 위한 로깅 미들웨어
app.use((req, res, next) => {
  console.log('Request URL:', req.url);
  console.log('Request path:', req.path);
  next();
});

// 서버 측 API 예시
app.get('/api/files/:classId/:lectureId', (req, res) => {
  const dirPath = `/volume1/video/lecture/_repo/class101/html/classes/${req.params.classId}/${req.params.lectureId}/files`;
  fs.readdir(dirPath, (err, files) => {
    if (err) {
      console.error('Directory read error:', err);
      res.json({ files: [] });  // 디렉토리가 없는 경우 빈 배열 반환
      return;
    }
    res.json({ files });
  });
});

// 파일 스트리밍 미들웨어
app.get('/*', (req, res, next) => {
  const ext = path.extname(req.path).toLowerCase();
  const relativePath = req.path.startsWith('/') ? req.path.slice(1) : req.path;
  const decodedPath = decodeURIComponent(relativePath);
  const filePath = path.join(VIDEO_BASE_PATH, decodedPath);
  
  console.log('Path info:');
  console.log('- relativePath:', relativePath);
  console.log('- decodedPath:', decodedPath);
  console.log('- VIDEO_BASE_PATH:', VIDEO_BASE_PATH);
  console.log('- Final filePath:', filePath);
  
  // VTT 파일 처리
  if (ext === '.vtt') {
    try {
      fs.accessSync(filePath, fs.constants.F_OK);
      const content = fs.readFileSync(filePath, 'utf8');
      res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
      res.send(content);
      return;
    } catch (err) {
      console.error('VTT file access error:', err);
      return res.status(404).send('File not found');
    }
  }
  
  // HTML 파일 처리
  if (ext === '.html') {
    try {
      fs.accessSync(filePath, fs.constants.F_OK);
      const content = fs.readFileSync(filePath, 'utf8');
      res.setHeader('Content-Type', 'text/html; charset=utf-8');
      res.send(content);
      return;
    } catch (err) {
      console.error('HTML file access error:', err);
      return res.status(404).send('File not found');
    }
  }
  
  // JSON 파일 처리
  if (ext === '.json') {
    try {
      fs.accessSync(filePath, fs.constants.F_OK);
      const content = fs.readFileSync(filePath, 'utf8');
      res.setHeader('Content-Type', 'application/json; charset=utf-8');
      res.send(content);
      return;
    } catch (err) {
      console.error('JSON file access error:', err);
      return res.status(404).send('File not found');
    }
  }
  
  // 이미지 파일 처리
  if (['.jpg', '.jpeg', '.png', '.gif', '.webp'].includes(ext)) {
    try {
      fs.accessSync(filePath, fs.constants.F_OK);
      const contentTypeMap = {
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.png': 'image/png',
        '.gif': 'image/gif',
        '.webp': 'image/webp'
      };
      res.setHeader('Content-Type', contentTypeMap[ext]);
      fs.createReadStream(filePath).pipe(res);
      return;
    } catch (err) {
      console.error('Image file access error:', err);
      return res.status(404).send('File not found');
    }
  }
  
  // 비디오 파일 처리
  if (['.mkv', '.mp4', '.avi'].includes(ext)) {
    try {
      fs.accessSync(filePath, fs.constants.F_OK);
      const stat = fs.statSync(filePath);
      const fileSize = stat.size;
      const range = req.headers.range;

      // 공통 헤더 설정
      const commonHeaders = {
        'Accept-Ranges': 'bytes',
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD',
        'Access-Control-Allow-Headers': 'Range',
        'Cache-Control': 'no-cache',
        'Content-Type': 'video/mp4'
      };

      // 파일 확장자에 따른 Content-Type 설정
      switch (ext) {
        case '.mkv':
          commonHeaders['Content-Type'] = 'video/x-matroska';
          break;
        case '.avi':
          commonHeaders['Content-Type'] = 'video/x-msvideo';
          break;
      }

      if (range) {
        // 범위 요청 처리
        const parts = range.replace(/bytes=/, '').split('-');
        const start = parseInt(parts[0], 10);
        const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
        const chunksize = (end - start) + 1;

        const head = {
          ...commonHeaders,
          'Content-Range': `bytes ${start}-${end}/${fileSize}`,
          'Content-Length': chunksize,
        };

        res.writeHead(206, head);
        fs.createReadStream(filePath, { start, end }).pipe(res);
      } else {
        // 전체 파일 요청 처리
        const head = {
          ...commonHeaders,
          'Content-Length': fileSize,
        };

        res.writeHead(200, head);
        fs.createReadStream(filePath).pipe(res);
      }
    } catch (err) {
      console.error('Video file error:', err);
      return res.status(404).send('File not found');
    }
    return;
  }

  // 그 외 모든 파일 다운로드 처리
  try {
    fs.accessSync(filePath, fs.constants.F_OK);
    const filename = path.basename(filePath);
    const mimeType = {
      '.pdf': 'application/pdf',
      '.zip': 'application/zip',
      '.py': 'text/x-python',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.hwp': 'application/x-hwp',
      '.txt': 'text/plain',
      '.csv': 'text/csv',
      '.md': 'text/markdown',
    }[ext] || 'application/octet-stream';  // 알 수 없는 확장자는 'application/octet-stream'으로 처리

    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
    fs.createReadStream(filePath).pipe(res);
    return;
  } catch (err) {
    console.error('File access error:', err);
    return res.status(404).send('File not found');
  }

  // 지원하지 않는 파일 형식
  next();
});

// 404 에러 처리
app.use((req, res) => {
  console.log('404 Not Found:', req.url);
  res.status(404).send('Not Found');
});

// 에러 처리 미들웨어
app.use((err, req, res, next) => {
  console.error('Server error:', err.stack);
  res.status(500).send('Something broke!');
});

// HTTP 서버 시작
app.listen(PORT, '0.0.0.0', () => {
  console.log(`File server running at http://0.0.0.0:${PORT}`);
});
