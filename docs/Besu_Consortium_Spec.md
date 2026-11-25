# Consortium Architecture Specification: Hyperledger Besu with QBFT

**Course:** Blockchain Technologies and Applications (CS-491)  
**Project:** Decentralized Academic Credential Verification System  
**Institution:** Department of Computer Systems Engineering, MUET Jamshoro  

---

## 1. Executive Summary & Architectural Scope

This specification establishes the **proposed production architecture** for an inter-university academic credential verification consortium using **Hyperledger Besu** and the **QBFT (Quorum Byzantine Fault Tolerance)** consensus protocol.

> [!NOTE]
> **Implementation Scope Distinction:**
> - **Currently Implemented & Tested:** The system is fully engineered, compiled, tested (38 test cases), and gas-benchmarked on a **local Hardhat EVM environment** (`d:\BTA`).
> - **Proposed Production Architecture:** The multi-node Hyperledger Besu QBFT consortium described herein represents the target deployment specification for institutional production, not a live cluster currently running on this workstation.

---

## 2. Theoretical Formulation & Fault-Tolerance Limits

### 2.1 The Byzantine Fault Tolerance Formula
QBFT requires that the total number of validator nodes $N$ and the maximum tolerated faulty/Byzantine nodes $F$ satisfy:

$$N \ge 3F + 1 \quad \Longleftrightarrow \quad F \le \left\lfloor \frac{N - 1}{3} \right\rfloor$$

### 2.2 Four-Validator Academic Consortium Model
In our national university consortium comprising four initial validators:
1. **Validator 1:** Higher Education Commission (HEC), Islamabad (Regulatory Root)
2. **Validator 2:** Mehran University of Engineering and Technology (MUET), Jamshoro
3. **Validator 3:** NED University of Engineering and Technology, Karachi
4. **Validator 4:** University of Engineering and Technology (UET), Lahore

Substituting $N = 4$:
$$F = \left\lfloor \frac{4 - 1}{3} \right\rfloor = 1$$

### 2.3 Quorum Size & Liveness Requirements
* **Quorum Threshold:** To commit any new block, QBFT requires signatures from at least:
  $$Q = 2F + 1 = 2(1) + 1 = 3 \text{ validators}$$
* **Failure Analysis:**
  - **$F = 1$ Node Offline (e.g., NED Server Outage):** System continues uninterrupted ($4 - 1 = 3$ nodes remain, meeting the quorum of 3).
  - **$F = 2$ Nodes Offline (e.g., NED and UET Offline):** Only 2 nodes remain online. The quorum of 3 cannot be achieved. **Block production halts safely** (liveness failure). No forks or corrupted states occur.

---

## 3. Local EVM Prototype vs. Consortium Deployment

| Engineering Parameter | Local Hardhat Prototype (Implemented) | Hyperledger Besu Consortium (Proposed) |
| :--- | :--- | :--- |
| **Current Status** | **Fully Implemented & Verified in `d:\BTA`** | **Proposed Production Target Architecture** |
| **Primary Purpose** | Fast iteration, automated test suites, gas benchmarking | Production multi-university trust and final state storage |
| **Consensus Engine** | Instant single-thread automine | Distributed round-robin QBFT with deterministic finality |
| **Block Finality** | Immediate, simulated | Deterministic single-block finality (no chain forks) |
| **Node Network** | Local host memory (`d:\BTA`) | Geographically distributed enterprise nodes across universities |
| **EVM Compatibility** | Solidity `0.8.24` (Cancun target) | Identical EVM bytecode runs without recompilation |
| **Transaction Gas Pricing** | Simulated gas units measured | Configurable to `0` for zero-fee university operations |
| **Infrastructure Costs** | Zero host cost | Enterprise servers, HSMs, network bandwidth, IT staff |

---

## 4. Operational Cost & Infrastructure Reality

Setting `min-gas-price = 0` in Hyperledger Besu eliminates transaction fees for end users and issuing universities, but **does not make the system free to operate**:

1. **Hardware & Datacenter Hosting:** Each of the 4 validator institutions must host a dedicated physical or cloud virtual machine (minimum 4 vCPUs, 16 GB RAM, 500 GB NVMe SSD) with high availability and redundant power.
2. **Hardware Security Modules (HSMs):** Validator signing private keys must be secured in enterprise HSMs (e.g., AWS CloudHSM, Azure Key Vault, or on-premise SafeNet Luna) to prevent key exfiltration.
3. **Bandwidth & Networking:** Persistent, encrypted site-to-site VPN tunnels connecting HEC and university campus datacenters.
4. **Denial of Service (DoS) & Spam Mitigation:** On a zero-gas network, malicious or compromised accounts could flood nodes with free transactions. Therefore, Besu must be configured with:
   - Smart contract account and node permissioning (`PermissibleConnectionManager`).
   - Reverse-proxy rate limiting (NGINX / Envoy) at all JSON-RPC endpoints.
5. **Administrative Overhead:** Dedicated DevOps and security operations personnel across institutions for regular patching, node synchronization monitoring, and disaster recovery drills.
