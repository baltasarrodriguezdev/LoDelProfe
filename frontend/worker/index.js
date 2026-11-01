const API_HOST = 'api.lodelprofe.com';

// Reenvia /api/* al backend para clientes con un build viejo que llaman a /api en el mismo dominio.
export default {
  async fetch(request) {
    const url = new URL(request.url);
    url.protocol = 'https:';
    url.hostname = API_HOST;
    url.port = '';
    return fetch(new Request(url, request));
  }
};
