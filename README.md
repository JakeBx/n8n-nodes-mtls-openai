# n8n-nodes-mtls-openai

n8n community nodes for **OpenAI-compatible Chat Model and Embeddings** with **mTLS (mutual TLS) x509 client certificate authentication** — the first n8n community node purpose-built for enterprise teams operating under Zero Trust security requirements.

## Why mTLS?

Mutual TLS (mTLS) adds a second factor of authentication beyond API keys: the client must also present a valid x509 certificate signed by a trusted CA. This is increasingly required in regulated industries and enterprise security programs.

**Security Compliance**: Highly regulated sectors (Finance, Healthcare, Government) are adopting Zero Trust architectures. With mTLS, a leaked API key alone is not enough to make a request — an attacker also needs the corresponding client certificate. This significantly reduces the blast radius of credential exposure.

**OpenAI Native mTLS Support**: OpenAI now supports mTLS natively via their [Mutual TLS Beta Program](https://help.openai.com/en/articles/10876024-openai-mutual-tls-beta-program). Requests are sent to `https://mtls.api.openai.com` (or `https://mtls-eu.api.openai.com` for EU Data Residency). This node gives n8n users a first-class way to use that endpoint with full client certificate support.

**Future-Proofing**: Public CAs are increasingly restricting "Client Authentication" in standard TLS certificates. Many organizations are moving to private/internal CAs for mTLS. This node supports custom CA certificates natively, making it compatible with both public and private PKI setups.

## Overview

This package provides two n8n AI sub-nodes that enable connections to OpenAI-compatible API endpoints through mTLS authentication. Supported targets include:

- **OpenAI's native mTLS endpoint** (`mtls.api.openai.com`) — for enterprises enrolled in OpenAI's mTLS Beta Program
- **Self-hosted inference** behind mTLS-terminating proxies (nginx, Envoy, etc.) — for Ollama, vLLM, LiteLLM, and similar backends

## Nodes

### mTLS OpenAI Chat Model

- **Type**: AI Sub-Node (Language Model)
- **Output**: `ai_languageModel`
- **Use case**: Connect to OpenAI-compatible chat completion endpoints with mTLS authentication
- **Works with**: AI Agent, AI Chain, and other AI nodes in n8n

### mTLS OpenAI Embeddings

- **Type**: AI Sub-Node (Embedding)
- **Output**: `ai_embedding`
- **Use case**: Connect to OpenAI-compatible embedding endpoints with mTLS authentication
- **Works with**: Vector Store nodes for RAG pipelines (insert & retrieve)

## Installation

### In n8n (Community Nodes)

1. Go to **Settings** → **Community Nodes**
2. Select **Install**
3. Enter `n8n-nodes-mtls-openai`
4. Agree to the risks and click **Install**

### Manual Installation

```bash
cd ~/.n8n/nodes
npm install n8n-nodes-mtls-openai
```

## Credential Setup

Create a new **mTLS OpenAI API** credential with the following fields:

| Field | Required | Description |
|-------|----------|-------------|
| **Base URL** | Yes | The API base URL. For OpenAI's mTLS endpoint use `https://mtls.api.openai.com/v1` |
| **API Key** | No | API key for services that require it (leave empty if not needed) |
| **CA Certificate** | Yes | PEM-encoded CA certificate for verifying the server (supports private/internal CAs) |
| **Client Certificate** | Yes | PEM-encoded client certificate for mTLS authentication |
| **Client Key** | Yes | PEM-encoded client private key |
| **Passphrase** | No | Passphrase for the client key (if encrypted) |

### OpenAI mTLS Beta Setup

To use this node with OpenAI's native mTLS endpoint:

1. Enroll in [OpenAI's Mutual TLS Beta Program](https://help.openai.com/en/articles/10876024-openai-mutual-tls-beta-program) via your organization settings
2. Upload your CA certificate in the OpenAI platform dashboard (up to 50 CA certs supported per org)
3. Activate the CA certificate at the desired scope (organization or project level)
4. Set the **Base URL** credential field to `https://mtls.api.openai.com/v1`
5. Provide your client certificate and key signed by that CA

> EU Data Residency customers should use `https://mtls-eu.api.openai.com/v1`

## Use Cases

- **OpenAI mTLS Beta**: Connect n8n directly to `mtls.api.openai.com` — API key leaks alone cannot be used without the client certificate
- **Ollama behind mTLS proxy**: Connect n8n AI agents to Ollama instances protected by nginx/Envoy mTLS termination
- **vLLM with client certificates**: Access vLLM inference endpoints in secure enterprise networks
- **LiteLLM proxy**: Route through LiteLLM with mTLS authentication
- **Any OpenAI-compatible API**: Works with any service implementing the OpenAI API spec that requires client certificate authentication

## Architecture

### Self-hosted / Proxy Pattern

```
n8n ──► mTLS OpenAI Node ──► mTLS Proxy (nginx/envoy) ──► AI Backend (Ollama/vLLM/LiteLLM)
         │                        │
         │ Client Cert (x509)     │ Verifies client cert
         │ CA Cert                │ TLS termination
         └────────────────────────┘
```

### OpenAI Native mTLS Pattern

```
n8n ──► mTLS OpenAI Node ──► mtls.api.openai.com
         │                        │
         │ API Key                │ Verifies API key
         │ Client Cert (x509)     │ Verifies client cert against uploaded CA
         └────────────────────────┘
```

## Development

### Prerequisites

- Node.js 20+
- Docker & Docker Compose (for integration testing)

### Setup

```bash
cd n8n-nodes-mtls-openai
npm install
npm run build
```

### Testing

```bash
# Unit tests
npm test

# Integration tests (requires Docker)
cd ..
./certs/generate-certs.sh --force
cd docker && docker compose up -d
# ... run integration tests
docker compose down
```

### Linting

```bash
npm run lint
npm run lintfix
```

## License

[MIT](LICENSE)
