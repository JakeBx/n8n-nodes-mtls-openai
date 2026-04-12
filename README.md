# n8n-nodes-mtls-openai

n8n community nodes for **OpenAI-compatible Chat Model and Embeddings** with **mTLS (mutual TLS) x509 client certificate authentication** — for enterprise users connecting to AI inference endpoints behind auth proxies.

## Overview

This package provides two n8n AI sub-nodes that enable connections to OpenAI-compatible API endpoints (Ollama, vLLM, LiteLLM, etc.) through mTLS authentication proxies. This is essential for enterprise environments where AI inference services are protected by mutual TLS with x509 client certificates.

## Nodes

### mTLS OpenAI Chat Model

- **Type**: AI Sub-Node (Language Model)
- **Output**: `ai_languageModel`
- **Use case**: Connect to OpenAI-compatible chat completion endpoints behind mTLS proxies
- **Works with**: AI Agent, AI Chain, and other AI nodes in n8n

### mTLS OpenAI Embeddings

- **Type**: AI Sub-Node (Embedding)
- **Output**: `ai_embedding`
- **Use case**: Connect to OpenAI-compatible embedding endpoints behind mTLS proxies
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
| **Base URL** | Yes | The OpenAI-compatible API base URL (e.g., `https://your-proxy:8443/v1`) |
| **API Key** | No | API key for services that require it (leave empty if not needed) |
| **CA Certificate** | Yes | PEM-encoded CA certificate for verifying the server |
| **Client Certificate** | Yes | PEM-encoded client certificate for mTLS authentication |
| **Client Key** | Yes | PEM-encoded client private key |
| **Passphrase** | No | Passphrase for the client key (if encrypted) |

## Use Cases

- **Ollama behind mTLS proxy**: Connect n8n AI agents to Ollama instances protected by nginx/envoy mTLS termination
- **vLLM with client certificates**: Access vLLM inference endpoints in secure enterprise networks
- **LiteLLM proxy**: Route through LiteLLM with mTLS authentication
- **Any OpenAI-compatible API**: Works with any service that implements the OpenAI API specification and requires client certificate authentication

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MTLS_SKIP_HOSTNAME_VERIFICATION` | *(unset)* | Set to `true` to disable TLS hostname/SAN verification when a private CA certificate is configured. Useful for Docker Desktop where `host.docker.internal` is not in the server cert's SANs. **Do not enable in production** — it weakens TLS security by skipping hostname checks (CA chain validation still applies). |
| `N8N_LOG_LEVEL` | `info` | When set to `debug`, the mTLS nodes emit per-request debug lines via `console.debug`. No certificate contents, API keys, or authorization headers are logged — only request method, hostname, path, and boolean status flags. |

## Architecture

```
n8n ──► mTLS OpenAI Node ──► mTLS Proxy (nginx/envoy) ──► AI Backend (Ollama/vLLM/LiteLLM)
         │                        │
         │ Client Cert (x509)     │ Verifies client cert
         │ CA Cert                │ TLS termination
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
