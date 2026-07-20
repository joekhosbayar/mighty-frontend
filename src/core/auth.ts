import { Amplify } from 'aws-amplify';

export function configureAuth() {
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId: import.meta.env.VITE_COGNITO_POOL_ID || '',
        userPoolClientId: import.meta.env.VITE_COGNITO_CLIENT_ID || '',
        identityPoolId: '',
        signUpVerificationMethod: 'code',
      }
    }
  });
}
