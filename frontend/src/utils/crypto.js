import { ethers } from 'ethers';

/**
 * Deterministically sorts object keys for canonical JSON serialization
 */
export function canonicalize(value) {
  if (value === null || typeof value !== 'object') {
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
 */
export function deterministicStringify(obj) {
  return JSON.stringify(canonicalize(obj));
}

/**
 * Generates a 256-bit (32-byte) cryptographically secure pseudorandom salt in browser
 */
export function generateSalt() {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return '0x' + Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}

/**
 * Stage 1: Computes the 32-byte Keccak-256 hash of the canonical credential payload
 */
export function computePayloadHash(credentialData) {
  const student = credentialData.student || credentialData;
  const canonicalPayload = {
    institution: credentialData.institution || "Mehran University of Engineering and Technology",
    institutionCode: credentialData.institutionCode || "PK-MUET-001",
    student: {
      cgpa: String(student.cgpa || "0.00"),
      degree: String(student.degree || ""),
      fullName: String(student.fullName || ""),
      graduationDate: String(student.graduationDate || ""),
      rollNumber: String(student.rollNumber || "")
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
 * Stage 2: Computes commitment hash via ethers ABI encoding matching Solidity abi.encode(bytes32, bytes32)
 */
export function computeCredentialCommitment(payloadHash, salt) {
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
 */
export function createCredentialPackage(credentialData, existingSalt = null) {
  const salt = existingSalt || generateSalt();
  const { canonicalPayload, canonicalJson, payloadHash } = computePayloadHash(credentialData);
  const credentialHash = computeCredentialCommitment(payloadHash, salt);

  return {
    canonicalPayload, // Publicly distributable transcript payload (DOES NOT contain salt)
    canonicalJson,
    payloadHash,      // bytes32 intermediate digest
    salt,             // Kept in memory by student; revealed ONLY to authorized verifiers
    credentialHash    // bytes32 commitment anchored on blockchain
  };
}

/**
 * Creates an authorized disclosure bundle intended for an employer
 */
export function createAuthorizedDisclosureBundle(credPackage, recipientName = "Prospective Employer") {
  return {
    recipient: recipientName,
    disclosureTimestamp: new Date().toISOString(),
    notice: "CONFIDENTIAL: Disclosing this bundle allows the designated recipient to reproduce and verify the on-chain commitment.",
    transcriptPayload: credPackage.canonicalPayload,
    disclosedSalt: credPackage.salt
  };
}
