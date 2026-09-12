const { http } = require('@google-cloud/functions-framework');
http('authBridge', (req, res) => {
  res.json({
    ip: req.ip,
    ips: req.ips,
    xff: req.headers['x-forwarded-for'],
    remote: req.socket?.remoteAddress,
  });
});
