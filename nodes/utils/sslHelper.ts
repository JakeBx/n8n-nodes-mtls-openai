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
