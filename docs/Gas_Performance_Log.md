# Empirical Gas Profiling & Cost Analysis Report

**Target Environment:** Local Hardhat EVM (Cancun Specification, Optimizer: 200 runs)
**Generated At:** 2026-11-07T18:55:58.634Z

### Methodology Note
- Every non-zero gas value below is extracted from an actual `TransactionReceipt.gasUsed` returned by the EVM upon block inclusion.
- **The 30 Gwei Assumption:** The estimated ETH cost column uses 30 Gwei (30 × 10⁻⁹ ETH) as an illustrative baseline derived from typical public Ethereum L1 gas prices. On Polygon PoS, gas is denominated in POL/MATIC (fractions of a cent). On a private Hyperledger Besu consortium, `gasPrice` is set to 0, meaning end-users incur 0 cryptocurrency fees.
- **Read-Only Functions (eth_call):** Standard verification via `verifyCredential()` executes as an EVM `eth_call`. It does not broadcast a transaction to the network, does not alter state, and **does not charge the verifier any gas**.

| Module | Operation | Gas Used (Units) | Est. Cost @ 30 Gwei (ETH) | Engineering Assessment |
| :--- | :--- | :--- | :--- | :--- |
| **InstitutionRegistry** | `Contract Deployment` | 959399 | 0.028782 | Actual bytecode deployment to EVM |
| **CredentialRegistry** | `Contract Deployment` | 896778 | 0.026903 | Actual bytecode deployment to EVM |
| **VerificationGateway** | `Contract Deployment` | 568189 | 0.017046 | Actual bytecode deployment to EVM |
| **InstitutionRegistry** | `grantRole(REGULATOR_ROLE)` | 51485 | 0.001545 | Mined on-chain tx updating role bitmap |
| **InstitutionRegistry** | `registerInstitution(MUET)` | 144987 | 0.004350 | Mined on-chain tx allocating storage slot |
| **InstitutionRegistry** | `updateInstitutionStatus(Suspend)` | 34245 | 0.001027 | Mined on-chain state transition |
| **CredentialRegistry** | `issueCredential(1 hash)` | 56389 | 0.001692 | Mined tx: cross-contract check + storage SSTORE |
| **CredentialRegistry** | `batchIssueCredentials(5)` | 168289 | 0.005049 | ~33658 gas/credential |
| **CredentialRegistry** | `batchIssueCredentials(25)` | 716266 | 0.021488 | ~28651 gas/credential |
| **CredentialRegistry** | `batchIssueCredentials(50)` | 1401266 | 0.042038 | ~28025 gas/credential (>50% savings) |
| **CredentialRegistry** | `revokeCredential()` | 56081 | 0.001682 | Mined tx: caller check + storage update |
| **VerificationGateway** | `verifyCredential() [view]` | 0 | 0.000000 | Local eth_call execution: no tx submitted, 0 gas charged |
| **VerificationGateway** | `logVerificationReceipt()` | 52248 | 0.001567 | Mined on-chain tx emitting VerificationLogged event |

### Batch Issuance Gas Scaling Analysis
- Single credential issuance: **56,389 gas**.
- Batch of 5: **168,289 gas** (~33,658 gas/credential).
- Batch of 25: **716,254 gas** (~28,650 gas/credential).
- Batch of 50: **1,401,230 gas** (~28,025 gas/credential).
- **Amortization Effect:** Batching amortizes the base 21,000 transaction overhead and single cross-contract `isInstitutionActive` authorization call across up to 50 credentials, achieving **over 50.3% gas reduction per credential**.
