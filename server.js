const http = require('http');
const fs = require('fs');
const { TikTokLiveConnection } = require('tiktok-live-connector');

const USER = (process.env.TIKTOK_USER || '').replace('@', '').trim();
const clients = new Set();

function send(obj) {
  const msg = 'data: ' + JSON.stringify(obj) + '\n\n';
  clients.forEach((c) => c.write(msg));
}

http.createServer((req, res) => {
  if (req.url.startsWith('/events')) {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });
    res.write('retry: 3000\n\n');
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }
  res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
  fs.createReadStream(__dirname + '/index.html').pipe(res);
}).listen(process.env.PORT || 3000, () => console.log('Servidor no ar'));

setInterval(() => clients.forEach((c) => c.write(':ping\n\n')), 20000);

function pic(d) {
  return (
    d.profilePictureUrl ||
    (d.user && d.user.profilePicture && d.user.profilePicture.url) ||
    (d.profilePicture && d.profilePicture.urls && d.profilePicture.urls[0]) ||
    ''
  );
}
function who(d) {
  return {
    id: String(d.uniqueId || (d.user && d.user.uniqueId) || d.userId || 'anon'),
    name: d.nickname || (d.user && d.user.nickname) || d.uniqueId || '',
    pic: pic(d),
  };
}

function start() {
  if (!USER) {
    console.log('Falta definir TIKTOK_USER (seu @ do TikTok)');
    return;
  }
  const c = new TikTokLiveConnection(USER, {});
  c.on('chat', (d) => send({ t: 'chat', text: d.comment, ...who(d) }));
  c.on('member', (d) => send({ t: 'join', ...who(d) }));
  c.on('gift', (d) =>
    send({ t: 'gift', gift: d.giftName || 'Presente', ...who(d) })
  );
  c.on('disconnected', () => setTimeout(start, 15000));
  c.connect()
    .then(() => console.log('Conectado na live de @' + USER))
    .catch((e) => {
      console.log('Erro ao conectar (a live precisa estar no ar):', e.message || e);
      setTimeout(start, 15000);
    });
}
start();
