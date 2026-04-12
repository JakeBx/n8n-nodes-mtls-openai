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
 * Conditional debug logger — only emits when N8N_LOG_LEVEL=debug.
 *
 * Rules:
 * - Never log certificate contents, API keys, passphrases, or full request headers.
 * - Safe: request method, URL hostname + path, boolean flags, HTTP status codes.
 */
export function debugLog(...args: unknown[]): void {
	if (process.env.N8N_LOG_LEVEL === 'debug') {
		// eslint-disable-next-line no-console
		console.debug('[mTLS]', ...args);
	}
}

/**
 * Normalizes a PEM string that may have had its newlines stripped.
 * PEM format requires line breaks after the header, every 64 characters
 * of Base64 content, and before the footer.
 *
 * Handles both correctly formatted PEM and single-line mangled PEM.
 */
function normalizePem(pem: string): string {
	if (!pem || !pem.trim()) {
		return pem;
	}

	const trimmed = pem.trim();

	// If the PEM already has proper line breaks (contains newlines between
	// BEGIN and END markers), return as-is
	const lines = trimmed.split(/\r?\n/);
	if (lines.length > 3) {
		return trimmed;
	}

	// PEM has been collapsed into one or few lines — reconstruct it.
	// Match the header, base64 body, and footer.
	const pemRegex = /^(-----BEGIN [A-Z0-9 ]+-----)([A-Za-z0-9+/=\s]+)(-----END [A-Z0-9 ]+-----)$/;
	const match = trimmed.replace(/\s+/g, '').match(pemRegex);

	if (!match) {
		// PEM might have spaces or partial formatting; try a looser approach
		const headerMatch = trimmed.match(/(-----BEGIN [A-Z0-9 ]+-----)/);
		const footerMatch = trimmed.match(/(-----END [A-Z0-9 ]+-----)/);
		if (headerMatch && footerMatch) {
			const header = headerMatch[1];
			const footer = footerMatch[1];
			const headerIdx = trimmed.indexOf(header) + header.length;
			const footerIdx = trimmed.lastIndexOf(footer);
			const body = trimmed.substring(headerIdx, footerIdx).replace(/\s+/g, '');

			// Split body into 64-character lines
			const bodyLines = body.match(/.{1,64}/g) || [];
			return [header, ...bodyLines, footer].join('\n');
		}

		// Not a recognized PEM format — return as-is and let OpenSSL report the error
		return trimmed;
	}

	const [, header, body, footer] = match;
	const cleanBody = body.replace(/\s+/g, '');
	const bodyLines = cleanBody.match(/.{1,64}/g) || [];
	return [header, ...bodyLines, footer].join('\n');
}

/**
 * Creates an HTTPS agent configured with mTLS client certificates
 * from the mTLS OpenAI API credential. Returns undefined if no SSL
 * certificate fields are populated.
 */
export function createHttpsAgent(credentials: IMtlsOpenAiApiCredentials): https.Agent | undefined {
	const hasCa = !!credentials.caCertificate?.trim();
	const hasCert = !!credentials.clientCertificate?.trim();
	const hasKey = !!credentials.clientKey?.trim();

	// If none of the SSL fields are provided, skip agent creation
	if (!hasCa && !hasCert && !hasKey) {
		return undefined;
	}

	const agentOptions: https.AgentOptions = {
		rejectUnauthorized: true,
	};

	if (hasCa) {
		agentOptions.ca = normalizePem(credentials.caCertificate!);
		// Hostname/SAN verification bypass is opt-in via env var.
		// When MTLS_SKIP_HOSTNAME_VERIFICATION=true, connections succeed even if the
		// serving hostname (e.g. host.docker.internal) is absent from the server cert's
		// SANs. CA chain validation still applies. DO NOT enable in production.
		if (process.env.MTLS_SKIP_HOSTNAME_VERIFICATION?.toLowerCase() === 'true') {
			agentOptions.checkServerIdentity = () => undefined;
			debugLog('hostname verification disabled via MTLS_SKIP_HOSTNAME_VERIFICATION');
		}
	}
	if (hasCert) {
		agentOptions.cert = normalizePem(credentials.clientCertificate!);
	}
	if (hasKey) {
		agentOptions.key = normalizePem(credentials.clientKey!);
	}
	if (credentials.passphrase) {
		agentOptions.passphrase = credentials.passphrase;
	}

	return new https.Agent(agentOptions);
}

/**
 * Creates a custom fetch function that routes requests through the mTLS HTTPS agent.
 *
 * Node.js 22 uses native fetch (undici) where the OpenAI SDK's `httpAgent` option is
 * silently ignored — undici requires a `dispatcher`, not an `http.Agent`. Passing a
 * custom `fetch` via ClientOptions is the supported escape hatch: the OpenAI SDK calls
 * whatever fetch function you supply, so we route it through `https.request` (which
 * honours our https.Agent with client certificates) and wrap the result in a standard
 * Response object.
 *
 * Returns undefined when no certificate fields are configured, leaving the SDK to use
 * its default fetch for plain API-key-only connections.
 */
export function createMtlsFetch(
	credentials: IMtlsOpenAiApiCredentials,
): ((input: string | URL, init?: RequestInit) => Promise<Response>) | undefined {
	const agent = createHttpsAgent(credentials);
	if (!agent) return undefined;

	return async (input: string | URL, init?: RequestInit): Promise<Response> => {
		const url = new URL(typeof input === 'string' ? input : input.href);
		debugLog('-->', init?.method ?? 'GET', url.hostname + url.pathname);

		// Flatten Headers / array / plain-object into a simple Record
		const headers: Record<string, string> = {};
		if (init?.headers) {
			if (init.headers instanceof Headers) {
				init.headers.forEach((val: string, key: string) => {
					headers[key] = val;
				});
			} else if (Array.isArray(init.headers)) {
				for (const [key, val] of init.headers as [string, string][]) {
					headers[key] = val;
				}
			} else {
				Object.assign(headers, init.headers as Record<string, string>);
			}
		}

		const body = init?.body;

		return new Promise<Response>((resolve, reject) => {
			const req = https.request(
				{
					hostname: url.hostname,
					port: url.port || '443',
					path: url.pathname + (url.search || ''),
					method: init?.method ?? 'GET',
					headers,
					agent,
				},
				(res) => {
					const responseHeaders = new Headers();
					for (const [key, val] of Object.entries(res.headers)) {
						if (val != null) {
							responseHeaders.set(key, Array.isArray(val) ? val.join(', ') : val);
						}
					}

					// Use a ReadableStream so the OpenAI SDK can process SSE events
					// incrementally — required for streaming chat completions used by
					// n8n's AI Agent nodes.
					const readable = new ReadableStream({
						start(controller) {
							res.on('data', (chunk: Buffer) => controller.enqueue(chunk));
							res.on('end', () => controller.close());
							res.on('error', (err: Error) => controller.error(err));
						},
					});

					resolve(
						new Response(readable, {
							status: res.statusCode ?? 200,
							headers: responseHeaders,
						}),
					);
				},
			);

			req.on('error', (err) => {
				debugLog('request error:', err.message);
				reject(err);
			});

			// Write the request body, handling all supported types.
			if (body != null) {
				if (typeof body === 'string' || Buffer.isBuffer(body)) {
					req.write(body);
					req.end();
				} else if (body instanceof ArrayBuffer) {
					req.write(Buffer.from(body));
					req.end();
				} else if (body instanceof ReadableStream) {
					// Pipe ReadableStream chunks into the request, then end.
					const reader = (body as ReadableStream<Uint8Array>).getReader();
					const pump = (): void => {
						reader.read().then(({ done, value }) => {
							if (done) {
								req.end();
								return;
							}
							req.write(value);
							pump();
						}).catch((err: Error) => {
							reject(err);
						});
					};
					pump();
				} else {
					// Unknown body type — send what we have and let the server decide.
					req.end();
				}
			} else {
				req.end();
			}
		});
	};
}

/**
 * Builds a Record of custom headers from a fixedCollection value array.
 * Used by nodes that expose custom headers in their options.
 */
export function buildCustomHeaders(
	headersData?: { values?: Array<{ name: string; value: string }> },
): Record<string, string> {
	const headers: Record<string, string> = {};

	if (headersData?.values) {
		for (const header of headersData.values) {
			if (header.name) {
				headers[header.name] = header.value;
			}
		}
	}

	return headers;
}
