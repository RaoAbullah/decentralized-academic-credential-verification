const { expect } = require("chai");
const { ethers } = require("hardhat");
const {
  canonicalize,
  deterministicStringify,
  computePayloadHash,
  computeCredentialCommitment,
  createCredentialPackage,
  verifyCredentialProof
} = require("../scripts/generateHash");

describe("Cryptographic Consistency & Two-Stage Salted Commitment (Task 1)", function () {
  let cryptoHelper;
  let instRegistry;
  let credRegistry;
  let gateway;
  let admin, muet, employer;

  // Synthetic student test record (no real personal identifiable data)
  const syntheticStudent = {
    institution: "Mehran University of Engineering and Technology",
    institutionCode: "PK-MUET-001",
    rollNumber: "21CS045-SYNTHETIC",
    fullName: "Synthetic Test Student",
    degree: "Bachelor of Engineering (Computer Systems)",
    cgpa: "3.85",
    graduationDate: "2025-12-15"
  };

  before(async function () {
    [admin, muet, employer] = await ethers.getSigners();

    // Deploy CryptoTestHelper
    const HelperFactory = await ethers.getContractFactory("CryptoTestHelper");
    cryptoHelper = await HelperFactory.deploy();
    await cryptoHelper.waitForDeployment();

    // Deploy core registries
    const InstFactory = await ethers.getContractFactory("InstitutionRegistry");
    instRegistry = await InstFactory.deploy(admin.address);
    await instRegistry.waitForDeployment();

    await instRegistry.connect(admin).registerInstitution(
      muet.address,
      "Mehran University of Engineering and Technology",
      "PK-MUET-001"
    );

    const CredFactory = await ethers.getContractFactory("CredentialRegistry");
    credRegistry = await CredFactory.deploy(admin.address, await instRegistry.getAddress());
    await credRegistry.waitForDeployment();

    const GatewayFactory = await ethers.getContractFactory("VerificationGateway");
    gateway = await GatewayFactory.deploy(
      await instRegistry.getAddress(),
      await credRegistry.getAddress()
    );
    await gateway.waitForDeployment();
  });

  describe("1. Exact JavaScript vs. Solidity Equivalence", function () {
    it("TC-CRYPTO-01: Stage 1 payloadHash matches Solidity keccak256(canonicalJsonBytes)", async function () {
      const { canonicalJson, payloadHash } = computePayloadHash(syntheticStudent);
      const jsonBytes = ethers.toUtf8Bytes(canonicalJson);

      const evmPayloadHash = await cryptoHelper.computePayloadHash(jsonBytes);
      expect(evmPayloadHash).to.equal(payloadHash);
    });

    it("TC-CRYPTO-02: Stage 2 commitment hash matches Solidity keccak256(abi.encode(payloadHash, salt))", async function () {
      const pkg = createCredentialPackage(syntheticStudent);

      // On-chain helper computes keccak256(abi.encode(bytes32, bytes32))
      const evmCommitmentHash = await cryptoHelper.computeCredentialHash(pkg.payloadHash, pkg.salt);
      expect(evmCommitmentHash).to.equal(pkg.credentialHash);

      // Direct end-to-end Solidity computation
      const evmDirectFullHash = await cryptoHelper.computeFullCredentialHash(
        ethers.toUtf8Bytes(pkg.canonicalJson),
        pkg.salt
      );
      expect(evmDirectFullHash).to.equal(pkg.credentialHash);
    });

    it("TC-CRYPTO-03: Canonicalization is strictly invariant to JSON key insertion order", async function () {
      // Re-ordered input keys
      const disorderedInput = {
        graduationDate: "2025-12-15",
        cgpa: "3.85",
        degree: "Bachelor of Engineering (Computer Systems)",
        fullName: "Synthetic Test Student",
        rollNumber: "21CS045-SYNTHETIC",
        institutionCode: "PK-MUET-001",
        institution: "Mehran University of Engineering and Technology"
      };

      const fixedSalt = "0xaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa";

      const normal = createCredentialPackage(syntheticStudent, fixedSalt);
      const disordered = createCredentialPackage(disorderedInput, fixedSalt);

      expect(normal.canonicalJson).to.equal(disordered.canonicalJson);
      expect(normal.payloadHash).to.equal(disordered.payloadHash);
      expect(normal.credentialHash).to.equal(disordered.credentialHash);
    });
  });

  describe("2. Tamper Detection & Salt Sensitivity", function () {
    let baselinePkg;

    beforeEach(function () {
      baselinePkg = createCredentialPackage(syntheticStudent);
    });

    it("TC-CRYPTO-04: Modified CGPA (3.85 -> 3.86) alters payloadHash and fails proof verification", async function () {
      const tamperedStudent = { ...syntheticStudent, cgpa: "3.86" };
      const { payloadHash: tamperedPayloadHash } = computePayloadHash(tamperedStudent);

      expect(tamperedPayloadHash).to.not.equal(baselinePkg.payloadHash);

      const isValid = verifyCredentialProof(
        tamperedStudent,
        baselinePkg.salt,
        baselinePkg.credentialHash
      );
      expect(isValid).to.be.false;
    });

    it("TC-CRYPTO-05: Single-character change in roll number alters payloadHash and fails verification", async function () {
      const tamperedStudent = { ...syntheticStudent, rollNumber: "21CS045-SYNTHETIX" };
      const { payloadHash: tamperedPayloadHash } = computePayloadHash(tamperedStudent);

      expect(tamperedPayloadHash).to.not.equal(baselinePkg.payloadHash);

      const isValid = verifyCredentialProof(
        tamperedStudent,
        baselinePkg.salt,
        baselinePkg.credentialHash
      );
      expect(isValid).to.be.false;
    });

    it("TC-CRYPTO-06: Incorrect salt (flipped bit) produces different commitment hash and fails verification", async function () {
      const lastChar = baselinePkg.salt.slice(-1);
      const corruptedChar = lastChar === "0" ? "1" : "0";
      const corruptedSalt = baselinePkg.salt.slice(0, -1) + corruptedChar;

      const corruptedCommitment = computeCredentialCommitment(baselinePkg.payloadHash, corruptedSalt);
      expect(corruptedCommitment).to.not.equal(baselinePkg.credentialHash);

      const isValid = verifyCredentialProof(
        syntheticStudent,
        corruptedSalt,
        baselinePkg.credentialHash
      );
      expect(isValid).to.be.false;
    });
  });

  describe("3. End-to-End On-Chain Credential Verification", function () {
    it("TC-CRYPTO-07: Legitimate package verifies on-chain; tampered payload or salt fails", async function () {
      const pkg = createCredentialPackage(syntheticStudent);

      // Issue genuine credential hash on-chain
      await credRegistry.connect(muet).issueCredential(pkg.credentialHash);

      // 1. Authorized employer receives genuine payload + salt
      const employerComputedCommitment = computeCredentialCommitment(pkg.payloadHash, pkg.salt);
      const onChainResult = await gateway.verifyCredential(employerComputedCommitment);

      expect(onChainResult.isValid).to.be.true;
      expect(onChainResult.statusMessage).to.equal("Credential is valid and issuing institution is accredited");
      expect(onChainResult.issuerAddress).to.equal(muet.address);

      // 2. Fraudulent attempt with modified degree title
      const fraudulentStudent = { ...syntheticStudent, degree: "Doctor of Engineering" };
      const { payloadHash: fraudPayloadHash } = computePayloadHash(fraudulentStudent);
      const fraudCommitment = computeCredentialCommitment(fraudPayloadHash, pkg.salt);

      const fraudOnChainResult = await gateway.verifyCredential(fraudCommitment);
      expect(fraudOnChainResult.isValid).to.be.false;
      expect(fraudOnChainResult.statusMessage).to.equal("Credential hash not found on ledger");
    });
  });
});
