const target = process.env.E2E_API_URL || 'http://127.0.0.1:3100';

module.exports = {
  '/api': {
    target,
    secure: false,
    ws: true,
    changeOrigin: false,
    pathRewrite: {
      '^/api': ''
    }
  }
};
