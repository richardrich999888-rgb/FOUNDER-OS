declare namespace Cloudflare {
  interface Env {
    TWIN_AUTH_PROVIDER?: string;
    TWIN_AUTH_ISSUER?: string;
    TWIN_AUTH_AUDIENCE?: string;
    TWIN_AUTH_ACCOUNT_LINKS?: string;
    DB?: D1Database;
    BUCKET?: R2Bucket;
  }
}
