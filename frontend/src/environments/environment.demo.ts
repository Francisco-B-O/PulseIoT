// Static demo build (GitHub Pages): no backend, every API call is answered by demo.interceptor.ts
export const environment = {
  production: true,
  demo: true,
  apiGatewayUrl: '/api/v1',
  mlApiUrl: '/ml',
  discoveryUrl: '/discovery'
};
