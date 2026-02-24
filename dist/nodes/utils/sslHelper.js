"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.createHttpsAgent = createHttpsAgent;
exports.buildCustomHeaders = buildCustomHeaders;
const https = __importStar(require("https"));
/**
 * Normalizes a PEM string that may have had its newlines stripped.
 * PEM format requires line breaks after the header, every 64 characters
 * of Base64 content, and before the footer.
 *
 * Handles both correctly formatted PEM and single-line mangled PEM.
 */
function normalizePem(pem) {
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
function createHttpsAgent(credentials) {
    var _a, _b, _c;
    const hasCa = !!((_a = credentials.caCertificate) === null || _a === void 0 ? void 0 : _a.trim());
    const hasCert = !!((_b = credentials.clientCertificate) === null || _b === void 0 ? void 0 : _b.trim());
    const hasKey = !!((_c = credentials.clientKey) === null || _c === void 0 ? void 0 : _c.trim());
    // If none of the SSL fields are provided, skip agent creation
    if (!hasCa && !hasCert && !hasKey) {
        return undefined;
    }
    const agentOptions = {
        rejectUnauthorized: true,
    };
    if (hasCa) {
        agentOptions.ca = normalizePem(credentials.caCertificate);
    }
    if (hasCert) {
        agentOptions.cert = normalizePem(credentials.clientCertificate);
    }
    if (hasKey) {
        agentOptions.key = normalizePem(credentials.clientKey);
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
function buildCustomHeaders(headersData) {
    const headers = {};
    if (headersData === null || headersData === void 0 ? void 0 : headersData.values) {
        for (const header of headersData.values) {
            if (header.name) {
                headers[header.name] = header.value;
            }
        }
    }
    return headers;
}
//# sourceMappingURL=sslHelper.js.map