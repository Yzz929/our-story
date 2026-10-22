// 本地假 Supabase：只实现本项目用到的几个接口，用来在没注册账号前把云端链路跑通
// GET  /rest/v1/site?id=eq.1&select=data
// POST /rest/v1/site                        （upsert，读取 body 里的 data）
// POST /storage/v1/object/photos/:name      （上传图片）
// GET  /storage/v1/object/public/photos/:n  （公开读取）
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const PORT = Number(process.argv[2] ?? 5199);
const DATA_FILE = 'D:\\DSH\\AI-Projects\\_research\\mock-cloud.json';
const FILES_DIR = 'D:\\DSH\\AI-Projects\\_research\\mock-cloud-files';
fs.mkdirSync(FILES_DIR, { recursive: true });

let store = { row: null };
try {
  store = JSON.parse(fs.readFileSync(DATA_FILE, 'utf8'));
} catch {
  /* 首次运行 */
}

const save = () => fs.writeFileSync(DATA_FILE, JSON.stringify(store, null, 2));

const server = http.createServer((req, res) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${PORT}`);
  const p = url.pathname;
  console.log(req.method, p);
  const json = (code, obj) => {
    res.writeHead(code, { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' });
    res.end(JSON.stringify(obj));
  };

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': '*',
      'Access-Control-Allow-Methods': '*',
    });
    res.end();
    return;
  }

  if (p === '/rest/v1/site' && req.method === 'GET') {
    if (!store.row) return json(200, []);
    return json(200, [{ id: 1, data: store.row.data }]);
  }

  if (p === '/rest/v1/site' && req.method === 'POST') {
    let body = '';
    req.on('data', (c) => (body += c));
    req.on('end', () => {
      try {
        const rows = JSON.parse(body);
        const row = Array.isArray(rows) ? rows[0] : rows;
        store.row = { id: 1, data: row.data, updated_at: new Date().toISOString() };
        save();
        json(201, null);
      } catch (e) {
        json(400, { message: String(e) });
      }
    });
    return;
  }

  if (p.startsWith('/storage/v1/object/photos/') && req.method === 'POST') {
    const name = path.basename(p);
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => {
      fs.writeFileSync(path.join(FILES_DIR, name), Buffer.concat(chunks));
      json(200, { Key: `photos/${name}` });
    });
    return;
  }

  if (p.startsWith('/storage/v1/object/public/photos/') && req.method === 'GET') {
    const name = path.basename(p);
    const file = path.join(FILES_DIR, name);
    if (!fs.existsSync(file)) {
      res.writeHead(404).end('not found');
      return;
    }
    res.writeHead(200, { 'Content-Type': 'image/jpeg', 'Access-Control-Allow-Origin': '*' });
    fs.createReadStream(file).pipe(res);
    return;
  }

  json(404, { error: 'not found' });
});

server.listen(PORT, '127.0.0.1', () => console.log(`mock supabase on http://127.0.0.1:${PORT}`));
