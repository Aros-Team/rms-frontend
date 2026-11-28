export const environment = {
  production: false,
  apiUrl: 'http://localhost:8080/api',
  wsUrl: 'ws://localhost:8080/ws-native',
  customer: 'Restaurante de prueba',
  baseColor: '#fbb409',
  agentHost: `http://${typeof window !== 'undefined' && window.location.hostname !== 'localhost' ? window.location.hostname : '127.0.0.1'}:8000/api/v1`,
};
