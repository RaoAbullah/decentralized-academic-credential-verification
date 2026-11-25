# STRIDE Threat Modeling & Security Analysis

**Course:** Blockchain Technologies and Applications (CS-491)  
**Project:** Decentralized Academic Credential Verification System  
**Institution:** Department of Computer Systems Engineering, MUET Jamshoro  

---

## 1. System Threat Modeling Methodology (STRIDE)

The STRIDE model categorizes cybersecurity threats into six threat classes. In an academic credentialing system, each class has concrete attack vectors against the smart contracts, validators, or off-chain data.

```
       +-------------------------------------------------------------+
       |                  STRIDE Threat Categories                   |
       +-------------------------------------------------------------+
       | S - Spoofing Identity                                       |
       | T - Tampering with Data                                     |
       | R - Repudiation                                             |
       | I - Information Disclosure                                  |
       | D - Denial of Service (DoS)                                 |
       | E - Elevation of Privilege                                  |
       +-------------------------------------------------------------+
```

---

## 2. Five Evaluated Concrete Attack Vectors & Mitigations

### Attack 1: Fraudulent University Credential Issuance (Spoofing)
* **Attack Scenario:** An attacker creates an Ethereum wallet and directly invokes `issueCredential(fakeHash)` to issue an engineering degree in their own name.
* **Vulnerability in Naive Systems:** Absence of cross-contract authorization checks.
* **Mitigation in Our System:** The `CredentialRegistry` performs an on-chain cross-contract check against `IInstitutionRegistry.isInstitutionActive(msg.sender)`. If the sender is not an approved university registered by the HEC regulator, the transaction reverts with custom error `UnauthorizedInstitution(msg.sender)`.
* **Automated Test Evidence:** Verified in `test/04_AccessControlSecurity.test.js` under test case `TC-SEC-01`.

### Attack 2: Regulator Role Hijacking (Elevation of Privilege)
* **Attack Scenario:** A compromised university account attempts to call `grantRole(REGULATOR_ROLE, attackerAddress)` or `registerInstitution()`.
* **Vulnerability in Naive Systems:** Flat single-admin permissioning or uninitialized initializers.
* **Mitigation in Our System:** OpenZeppelin `AccessControl` enforces strict two-tier role hierarchies. Only `DEFAULT_ADMIN_ROLE` can administer roles. Calling without permission reverts with `AccessControlUnauthorizedAccount`.
* **Automated Test Evidence:** Verified in `test/04_AccessControlSecurity.test.js` under test case `TC-SEC-02`.

### Attack 3: Unauthorized Revocation & Inter-University Sabotage (Repudiation / Tampering)
* **Attack Scenario:** NED University or an attacker attempts to revoke a valid degree issued by MUET.
* **Vulnerability in Naive Systems:** Checking only `isInstitutionActive(msg.sender)` on revocation rather than verifying credential ownership.
* **Mitigation in Our System:** `CredentialRegistry.revokeCredential()` enforces that only the **original issuing institution** (`msg.sender == record.issuer`) or the consortium regulator (`DEFAULT_ADMIN_ROLE`) can revoke a credential. Any other caller triggers `NotCredentialIssuerOrAdmin(caller, actualIssuer)`.
* **Automated Test Evidence:** Verified in `test/04_AccessControlSecurity.test.js` under test case `TC-SEC-03`.

### Attack 4: Unbounded Batch Issuance Gas Exhaustion (Denial of Service)
* **Attack Scenario:** An attacker or malfunctioning script passes an array of 5,000 hashes to `batchIssueCredentials()`, causing transaction gas to exceed the EVM block gas limit and stalling the node.
* **Vulnerability in Naive Systems:** Dynamic unbounded array loops without length assertions.
* **Mitigation in Our System:** The contract enforces a hard cap:
  ```solidity
  uint256 public constant MAX_BATCH_SIZE = 100;
  if (count > MAX_BATCH_SIZE) revert BatchSizeExceeded(count, MAX_BATCH_SIZE);
  ```
* **Automated Test Evidence:** Verified in `test/04_AccessControlSecurity.test.js` under test case `TC-SEC-04`.

### Attack 5: Emergency State Mutation during Circuit Breaker (Tampering)
* **Attack Scenario:** In the event of a compromised private key or zero-day vulnerability, an attacker attempts to issue credentials while the consortium admin is conducting incident response.
* **Vulnerability in Naive Systems:** Lack of global emergency pause controls.
* **Mitigation in Our System:** OpenZeppelin `Pausable` is integrated into all mutating entry points (`whenNotPaused`). The admin can instantly pause both `InstitutionRegistry` and `CredentialRegistry`.
* **Automated Test Evidence:** Verified in `test/04_AccessControlSecurity.test.js` under test case `TC-SEC-05`.

---

## 3. Static Security Analysis (Solhint) Findings & Scope Limitations

### 3.1 Static Linter Scope
> [!IMPORTANT]
> **Tooling Scope:** Solhint is an AST-based linter enforcing Solidity coding conventions, syntax patterns, and known security smells. **Solhint does not constitute a formal mathematical security audit, symbolic execution, or formal verification.**

### 3.2 Tool Execution Record (Solhint v5.2.0)
Warnings captured during draft development:
1. `immutable-vars-naming`: Variables declared in camelCase refactored to uppercase snake case (`INSTITUTION_REGISTRY`, `CREDENTIAL_REGISTRY`).
2. `no-unused-import`: Unused interface imports in `IVerificationGateway.sol` purged.
3. Compiler unused local variable: `bool isRevoked` in `VerificationGateway` destructuring omitted.

**Final Solhint Status:** `0 errors, 0 warnings`.

### 3.3 Slither Environment Limitation
* **Environment Observation:** Running `slither --version` fails because Slither requires Python 3.8+ and `solc-select`. Neither `python.exe` nor `docker.exe` is installed on the host Windows machine.
* **Reproducible Alternatives for Full Audits:**
  1. `docker run -v %cd%:/share trailofbits/eth-security-toolbox:latest slither /share`
  2. Running Slither inside a WSL2 Ubuntu environment.
  3. Aderyn standalone Rust binary.

---

## 4. Unresolved Security & Architectural Findings

1. **Single-Step Administrator Role Transfer:**
   - *Finding:* OpenZeppelin `AccessControl` assigns `DEFAULT_ADMIN_ROLE` immediately upon contract initialization. Transferring or granting this role is instantaneous (single-step).
   - *Risk:* If the administrator private key is compromised, an attacker can immediately grant themselves root privileges without any delay.
   - *Unresolved Architectural Recommendation:* In the production consortium deployment, `DEFAULT_ADMIN_ROLE` should be upgraded to **`AccessControlDefaultAdminRules`** (which mandates a two-step role transfer process with a multi-day timelock delay) or assigned to a Gnosis Safe multi-signature contract requiring $M$-of-$N$ board approvals.
2. **On-Chain Identity Transparency:**
   - *Finding:* While student PII and student wallet addresses are strictly off-chain, **university issuing wallet addresses (`address issuer`) and institutional status are public on-chain**.
   - *Impact:* Anyone can inspect which university wallet issued a particular commitment hash. This is by design for public institutional attribution, but means institutional activity volume is publicly auditable.
