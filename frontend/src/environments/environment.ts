export const environment = {
  production: false,
  demo: false,
  apiGatewayUrl: window.location.protocol + '//' + window.location.hostname + ':8080/api/v1',
  mlApiUrl: window.location.protocol + '//' + window.location.hostname + ':8000',
  discoveryUrl: window.location.protocol + '//' + window.location.hostname + ':8761'
};
