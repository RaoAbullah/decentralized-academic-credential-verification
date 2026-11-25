/**
 * @file generateHash.js
 * @notice Cryptographic Privacy & Anti-Dictionary Commitment Generator
 * @dev Two-stage cryptographic architecture:
 *      Stage 1: payloadHash = keccak256(canonical UTF-8 JSON of academic credential)
 *      Stage 2: credentialHash = keccak256(abi.encode(payloadHash, salt))
 *      Matches Solidity: keccak256(abi.encode(bytes32, bytes32))
 */

const crypto = require("crypto");
const { ethers } = require("ethers");

/**
 * Recursively and deterministically sorts object keys for canonical JSON serialization
 * @param {*} value
 * @returns {*} canonical sorted representation
 */
function canonicalize(value) {
  if (value === null || typeof value !== "object") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.map(canonicalize);
  }
  const sortedKeys = Object.keys(value).sort();
  const sortedObj = {};
  for (const key of sortedKeys) {
    sortedObj[key] = canonicalize(value[key]);
  }
  return sortedObj;
}

/**
 * Serializes an object into a deterministic canonical UTF-8 JSON string
 * @param {Object} obj
 * @returns {string} deterministic JSON string
 */
function deterministicStringify(obj) {
  return JSON.stringify(canonicalize(obj));
}

/**
 * Generates a 256-bit (32-byte) cryptographically secure pseudorandom salt (CSPRNG)
 * @returns {string} 0x-prefixed 32-byte hex string (66 characters)
 */
function generateSalt() {
  return "0x" + crypto.randomBytes(32).toString("hex");
}

/**
 * Stage 1: Computes the 32-byte Keccak-256 hash of the canonical credential payload
 * @param {Object} credentialData The synthetic student academic record (WITHOUT salt)
 * @returns {{ canonicalPayload: Object, canonicalJson: string, payloadHash: string }}
 */
function computePayloadHash(credentialData) {
  const student = credentialData.student || credentialData;
  const canonicalPayload = {
    institution: credentialData.institution || "Mehran University of Engineering and Technology",
    institutionCode: credentialData.institutionCode || "PK-MUET-001",
    student: {
      cgpa: String(student.cgpa),
      degree: String(student.degree),
      fullName: String(student.fullName),
      graduationDate: String(student.graduationDate),
      rollNumber: String(student.rollNumber)
    }
  };

  const canonicalJson = deterministicStringify(canonicalPayload);
  const payloadHash = ethers.keccak256(ethers.toUtf8Bytes(canonicalJson));

  return {
    canonicalPayload,
    canonicalJson,
    payloadHash
  };
}

/**
 * Stage 2: Computes commitment hash via ethers ABI encoding matching Solidity abi.encode
 * Calculation: keccak256(abi.encode(bytes32 payloadHash, bytes32 salt))
 * @param {string} payloadHash 0x-prefixed 32-byte hex string
 * @param {string} salt 0x-prefixed 32-byte hex string
 * @returns {string} 0x-prefixed 32-byte commitment hash anchored on-chain
 */
function computeCredentialCommitment(payloadHash, salt) {
  if (!ethers.isHexString(payloadHash, 32)) {
    throw new Error("Invalid payloadHash: must be a 32-byte 0x-prefixed hex string");
  }
  if (!ethers.isHexString(salt, 32)) {
    throw new Error("Invalid salt: must be a 32-byte 0x-prefixed hex string");
  }

  const abiCoder = ethers.AbiCoder.defaultAbiCoder();
  const encoded = abiCoder.encode(["bytes32", "bytes32"], [payloadHash, salt]);
  return ethers.keccak256(encoded);
}

/**
 * Builds the complete two-stage credential verification package
 * @param {Object} credentialData Synthetic student academic record
 * @param {string} [existingSalt] Optional existing 256-bit salt
 * @returns {Object} Complete package containing payload, separate salt, and on-chain hash
 */
function createCredentialPackage(credentialData, existingSalt = null) {
  const salt = existingSalt || generateSalt();
  const { canonicalPayload, canonicalJson, payloadHash } = computePayloadHash(credentialData);
  const credentialHash = computeCredentialCommitment(payloadHash, salt);

  return {
    canonicalPayload, // Publicly distributable transcript payload (DOES NOT contain salt)
    canonicalJson,
    payloadHash,      // bytes32 intermediate digest
    salt,             // Kept private by student; revealed ONLY to authorized verifiers
    credentialHash    // bytes32 commitment anchored on blockchain
  };
}

/**
 * Generates an authorized disclosure bundle intended strictly for transmission to an employer
 * @param {Object} credPackage
 * @param {string} recipientName Name of authorized verifying employer
 * @returns {Object} Bundle containing public transcript and revealed salt for that employer
 */
function createAuthorizedDisclosureBundle(credPackage, recipientName = "Prospective Employer") {
  return {
    recipient: recipientName,
    disclosureTimestamp: new Date().toISOString(),
    notice: "CONFIDENTIAL: Disclosing this bundle allows the designated recipient to reproduce and verify the on-chain commitment.",
    transcriptPayload: credPackage.canonicalPayload,
    disclosedSalt: credPackage.salt
  };
}

/**
 * Verifies if an off-chain candidate credential payload + salt matches the target on-chain hash
 * @param {Object} candidatePayload
 * @param {string} salt
 * @param {string} targetOnChainHash
 * @returns {boolean} true if computed commitment matches targetOnChainHash
 */
function verifyCredentialProof(candidatePayload, salt, targetOnChainHash) {
  try {
    const { payloadHash } = computePayloadHash(candidatePayload);
    const computedHash = computeCredentialCommitment(payloadHash, salt);
    return computedHash.toLowerCase() === targetOnChainHash.toLowerCase();
  } catch {
    return false;
  }
}

module.exports = {
  canonicalize,
  deterministicStringify,
  generateSalt,
  computePayloadHash,
  computeCredentialCommitment,
  createCredentialPackage,
  createCredentialManifest: createCredentialPackage,
  createAuthorizedDisclosureBundle,
  verifyCredentialProof
};

// CLI execution block using strictly synthetic test data
if (require.main === module) {
  console.log("===============================================================================");
  console.log("  CRYPTOGRAPHIC COMMITMENT GENERATOR (SYNTHETIC TEST DEMONSTRATION ONLY)       ");
  console.log("===============================================================================\n");

  const syntheticSample = {
    institution: "Mehran University of Engineering and Technology",
    institutionCode: "PK-MUET-001",
    rollNumber: "21CS045-SYNTHETIC",
    fullName: "Synthetic Demo Student",
    degree: "Bachelor of Engineering (Computer Systems)",
    cgpa: "3.85",
    graduationDate: "2025-12-15"
  };

  const result = createCredentialPackage(syntheticSample);
  console.log("[1] Public Credential Data (Canonical JSON - Salt Omitted):");
  console.log(result.canonicalJson);
  console.log("\n[2] Stage 1 Intermediate Hash (payloadHash):");
  console.log("   ", result.payloadHash);
  
  // Privacy Safeguard: Redact raw salt from default standard console logs
  const revealRequested = process.argv.includes("--reveal-salt");
  console.log("\n[3] Stage 2 Secret Salt (Stored in Graduate's Private Vault):");
  if (revealRequested) {
    console.log("   ", result.salt, "(CAUTION: Raw salt disclosed via CLI flag)");
  } else {
    const maskedSalt = result.salt.slice(0, 6) + "..." + result.salt.slice(-4) + " [REDACTED: 256-bit CSPRNG stored in student private vault; pass --reveal-salt to display]";
    console.log("   ", maskedSalt);
  }

  console.log("\n[4] Anchored On-Chain Commitment Hash: keccak256(abi.encode(payloadHash, salt)):");
  console.log("   ", result.credentialHash);
  console.log("\n[5] Note on Authorized Disclosure:");
  console.log("    To permit employer verification, the student generates an Authorized Disclosure Bundle.");
  console.log("    Once shared with an employer, that employer possesses the salt and can reproduce the commitment.");
}
