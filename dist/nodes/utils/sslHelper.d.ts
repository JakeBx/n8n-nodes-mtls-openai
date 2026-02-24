import * as https from 'https';
/**
 * mTLS OpenAI API credential data (includes mTLS certificate fields).
 */
export interface IMtlsOpenAiApiCredentials {
    baseUrl: string;
    apiKey?: string;
    caCertificate?: string;
    clientCertificate?: string;
    clientKey?: string;
    passphrase?: string;
}
/**
 * Creates an HTTPS agent configured with mTLS client certificates
 * from the mTLS OpenAI API credential. Returns undefined if no SSL
 * certificate fields are populated.
 */
export declare function createHttpsAgent(credentials: IMtlsOpenAiApiCredentials): https.Agent | undefined;
/**
 * Builds a Record of custom headers from a fixedCollection value array.
 * Used by nodes that expose custom headers in their options.
 */
export declare function buildCustomHeaders(headersData?: {
    values?: Array<{
        name: string;
        value: string;
    }>;
}): Record<string, string>;
//# sourceMappingURL=sslHelper.d.ts.map