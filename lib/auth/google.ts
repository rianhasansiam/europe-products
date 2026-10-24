import "server-only";

type GoogleAuthEnvironment = {
  AUTH_GOOGLE_ID?: string;
  AUTH_GOOGLE_SECRET?: string;
};

const TEMPLATE_CREDENTIAL = /^(?:your(?:[-_\s]|$)|replace(?:[-_\s]|$)|change[-_\s]?me$|placeholder(?:[-_\s]|$)|example(?:[-_\s]|$)|dummy$|test$|<|\$\{|\{\{|(?:AUTH_)?GOOGLE_(?:CLIENT_)?(?:ID|SECRET)$|CLIENT[_-](?:ID|SECRET)$)/i;

function configuredCredential(value: string | undefined): string | null {
  const credential = value?.trim();
  return credential && !TEMPLATE_CREDENTIAL.test(credential) ? credential : null;
}

/** Keep credentials server-only and omit an optional provider until both exist. */
export function getGoogleAuthCredentials(environment: GoogleAuthEnvironment = {
  AUTH_GOOGLE_ID: process.env.AUTH_GOOGLE_ID,
  AUTH_GOOGLE_SECRET: process.env.AUTH_GOOGLE_SECRET,
}) {
  const clientId = configuredCredential(environment.AUTH_GOOGLE_ID);
  const clientSecret = configuredCredential(environment.AUTH_GOOGLE_SECRET);
  return clientId && clientSecret ? { clientId, clientSecret } : null;
}
