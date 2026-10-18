const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 3000;
const ROOT = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.txt': 'text/plain; charset=utf-8'
};

const VISITOR_FILE = path.join(ROOT, 'visitors.json');

function loadVisitors() {
  try {
    if (fs.existsSync(VISITOR_FILE)) {
      return JSON.parse(fs.readFileSync(VISITOR_FILE, 'utf8'));
    }
  } catch (e) {}
  return {
    totalVisits: 148,
    uniqueIds: ['seed-1', 'seed-2', 'seed-3'],
    uniqueCount: 94,
    daily: {},
    mobileCount: 118,
    desktopCount: 30,
    recent: []
  };
}

function saveVisitors(v) {
  try {
    fs.writeFileSync(VISITOR_FILE, JSON.stringify(v, null, 2), 'utf8');
  } catch (e) {}
}

const server = http.createServer((req, res) => {
  try {
    const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
    let pathname = decodeURIComponent(parsedUrl.pathname);

    if (pathname === '/api/visitors') {
      const todayKey = new Date().toISOString().slice(0, 10);
      if (req.method === 'POST') {
        let body = '';
        req.on('data', chunk => { body += chunk.toString(); });
        req.on('end', () => {
          const v = loadVisitors();
          let payload = {};
          try { payload = JSON.parse(body || '{}'); } catch (_) {}
          v.totalVisits = (Number(v.totalVisits) || 0) + 1;
          v.daily = v.daily || {};
          v.daily[todayKey] = (Number(v.daily[todayKey]) || 0) + 1;
          const vid = String(payload.visitorId || '').trim();
          if (!Array.isArray(v.uniqueIds)) v.uniqueIds = [];
          if (vid && !v.uniqueIds.includes(vid)) {
            v.uniqueIds.push(vid);
            if (v.uniqueIds.length > 5000) v.uniqueIds.shift();
            v.uniqueCount = (Number(v.uniqueCount) || 0) + 1;
          }
          const isMob = payload.device === 'mobile' || /mobile|android|iphone|ipad/i.test(String(req.headers['user-agent'] || ''));
          if (isMob) v.mobileCount = (Number(v.mobileCount) || 0) + 1;
          else v.desktopCount = (Number(v.desktopCount) || 0) + 1;

          if (!Array.isArray(v.recent)) v.recent = [];
          v.recent.unshift({
            time: new Date().toISOString(),
            page: String(payload.page || 'home'),
            device: isMob ? 'مۆبایل 📱' : 'کۆمپیوتەر 💻',
            lang: String(payload.lang || 'ku')
          });
          v.recent = v.recent.slice(0, 25);
          saveVisitors(v);

          const uniqueVal = v.uniqueCount || v.uniqueIds.length;
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
          res.end(JSON.stringify({
            ok: true,
            totalVisits: v.totalVisits,
            todayVisits: v.daily[todayKey] || 1,
            uniqueCount: uniqueVal,
            uniqueVisitors: uniqueVal,
            mobileCount: v.mobileCount || 0,
            desktopCount: v.desktopCount || 0,
            recent: v.recent
          }));
        });
        return;
      } else {
        const v = loadVisitors();
        const uniqueVal = v.uniqueCount || (Array.isArray(v.uniqueIds) ? v.uniqueIds.length : 0);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
        res.end(JSON.stringify({
          ok: true,
          totalVisits: v.totalVisits || 0,
          todayVisits: (v.daily && v.daily[todayKey]) || 0,
          uniqueCount: uniqueVal,
          uniqueVisitors: uniqueVal,
          mobileCount: v.mobileCount || 0,
          desktopCount: v.desktopCount || 0,
          recent: v.recent || []
        }));
        return;
      }
    }

    const host = String(req.headers.host || '').toLowerCase();
    if (pathname === '/' && host.startsWith('admin.')) {
      pathname = '/admin.html';
    } else if (pathname === '/' || pathname === '/index') {
      pathname = '/index.html';
    } else if (
      pathname === '/admin' ||
      pathname === '/admin/' ||
      pathname === '/control' ||
      pathname === '/kurdia-control-center-admin' ||
      pathname === '/kurdia-control-center-admin.html'
    ) {
      pathname = '/admin.html';
    }

    const safePath = path.normalize(pathname).replace(/^(\.\.[/\\])+/, '');
    let filePath = path.join(ROOT, safePath);

    if (!filePath.startsWith(ROOT)) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Forbidden');
      return;
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
      filePath = path.join(filePath, 'index.html');
    }

    if (!fs.existsSync(filePath) && !path.extname(filePath)) {
      const htmlCandidate = filePath + '.html';
      if (fs.existsSync(htmlCandidate)) {
        filePath = htmlCandidate;
      }
    }

    if (!fs.existsSync(filePath)) {
      // Fallback to index.html for SPA routes
      const fallback = path.join(ROOT, 'index.html');
      if (fs.existsSync(fallback)) {
        const content = fs.readFileSync(fallback);
        res.writeHead(200, {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
          'Pragma': 'no-cache',
          'Expires': '0'
        });
        res.end(content);
        return;
      }
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not Found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const content = fs.readFileSync(filePath);

    res.writeHead(200, {
      'Content-Type': contentType,
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
      'Pragma': 'no-cache',
      'Expires': '0'
    });
    res.end(content);
  } catch (err) {
    res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Internal Server Error');
  }
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`KURDIA ADVENTURE server listening on http://0.0.0.0:${PORT}`);
});
