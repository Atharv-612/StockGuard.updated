module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');

  res.write('event: connected\ndata: {"status":"connected"}\n\n');

  // Keep alive ping
  const interval = setInterval(() => {
    res.write('event: ping\ndata: {}\n\n');
  }, 15000);

  req.on('close', () => {
    clearInterval(interval);
    res.end();
  });
};
