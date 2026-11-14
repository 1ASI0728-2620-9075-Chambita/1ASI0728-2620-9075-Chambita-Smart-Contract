# Chambita · Smart Contract

Soulbound ERC-721 (EIP-5192) that registers Chambita experience certificates on Ethereum Sepolia.
Part of the **Chambita** solution by Chambita Labs (UPC · 1ASI0728 Arquitecturas de Software Emergentes).

- Each token stores only the **certificate hash** and is minted to an **address derived from the holder's pseudonymous id** (`keccak256(id)`, last 20 bytes). No personal data goes on-chain.
- Tokens cannot be transferred, approved or burned (`Soulbound()`); `locked(tokenId)` always returns `true`.
- `ISSUER_ROLE` (the backend account) issues and revokes; `DEFAULT_ADMIN_ROLE` rotates issuers and the base URI.
- `verify(hash)` is a public view used by the verification portal without going through the backend.
- `tokenURI` points to the verification portal: `<base-uri><certificate-hash>`.

## Requirements

Node.js 20 or newer and npm.

## Usage

```bash
npm ci
npx hardhat test                 # unit tests (Hardhat + Chai)
cp .env.example .env             # fill in Alchemy URL, deployer key and portal base URI
npm run deploy:sepolia           # deploys ChambitaCertificate to Sepolia
```

## Contract API

| Function | Access | Description |
|----------|--------|-------------|
| `issue(address holder, bytes32 certificateHash)` | `ISSUER_ROLE` | Mints a locked certificate; rejects empty or repeated hashes. |
| `revoke(uint256 tokenId)` | `ISSUER_ROLE` | Flags a certificate as revoked (proven fraud). |
| `verify(bytes32 certificateHash)` | public view | Returns `exists`, `revoked`, `tokenId`, `holder`, `issuedAt`, `revokedAt`. |
| `locked(uint256 tokenId)` | public view | EIP-5192; always `true`. |
| `setBaseURI(string)` | `DEFAULT_ADMIN_ROLE` | Changes the verification portal URL prefix. |

## Conventions

GitFlow (`main`, `develop`, `feature/*`, `release/*`, `hotfix/*`), Semantic Versioning and Conventional Commits.
