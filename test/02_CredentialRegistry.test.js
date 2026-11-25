const { expect } = require("chai");
const { ethers } = require("hardhat");
const { createCredentialManifest } = require("../scripts/generateHash");

describe("CredentialRegistry (Module 2 - Lifecycle & Hash Anchoring)", function () {
  let instRegistry;
  let credRegistry;
  let admin, regulator, muet, unauthorized, student;

  const MUET_NAME = "Mehran University of Engineering and Technology";
  const MUET_CODE = "PK-MUET-001";

  beforeEach(async function () {
    [admin, regulator, muet, unauthorized, student] = await ethers.getSigners();

    const InstFactory = await ethers.getContractFactory("InstitutionRegistry");
    instRegistry = await InstFactory.deploy(admin.address);
    await instRegistry.waitForDeployment();

    const REGULATOR_ROLE = await instRegistry.REGULATOR_ROLE();
    await instRegistry.connect(admin).grantRole(REGULATOR_ROLE, regulator.address);
    await instRegistry.connect(regulator).registerInstitution(muet.address, MUET_NAME, MUET_CODE);

    const CredFactory = await ethers.getContractFactory("CredentialRegistry");
    credRegistry = await CredFactory.deploy(admin.address, await instRegistry.getAddress());
    await credRegistry.waitForDeployment();
  });

  describe("Single Credential Issuance", function () {
    it("TC-POS-04: should allow accredited institution to issue a salted credential hash", async function () {
      const manifest = createCredentialManifest({
        rollNumber: "21CS045-SYNTHETIC",
        fullName: "Synthetic Test Student",
        degree: "BE Computer Systems Engineering",
        cgpa: "3.85",
        graduationDate: "2025-12-15"
      });

      const tx = await credRegistry.connect(muet).issueCredential(manifest.credentialHash);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      await expect(tx)
        .to.emit(credRegistry, "CredentialIssued")
        .withArgs(manifest.credentialHash, muet.address, block.timestamp);

      const record = await credRegistry.getCredential(manifest.credentialHash);
      expect(record.issuer).to.equal(muet.address);
      expect(record.isRevoked).to.be.false;
      expect(record.state).to.equal(1); // Issued
    });

    it("TC-NEG-06: should revert if unauthorized wallet attempts to issue credential", async function () {
      const dummyHash = ethers.keccak256(ethers.toUtf8Bytes("fraudulent_manifest"));

      await expect(
        credRegistry.connect(unauthorized).issueCredential(dummyHash)
      ).to.be.revertedWithCustomError(credRegistry, "UnauthorizedInstitution");
    });

    it("TC-NEG-07: should revert on duplicate credential issuance", async function () {
      const dummyHash = ethers.keccak256(ethers.toUtf8Bytes("duplicate_manifest"));
      await credRegistry.connect(muet).issueCredential(dummyHash);

      await expect(
        credRegistry.connect(muet).issueCredential(dummyHash)
      ).to.be.revertedWithCustomError(credRegistry, "CredentialAlreadyExists");
    });

    it("TC-NEG-08: should revert on zero bytes32 hash", async function () {
      await expect(
        credRegistry.connect(muet).issueCredential(ethers.ZeroHash)
      ).to.be.revertedWithCustomError(credRegistry, "InvalidCredentialHash");
    });
  });

  describe("Batch Credential Issuance", function () {
    it("TC-POS-05: should successfully issue a batch of credentials and emit BatchCredentialsIssued", async function () {
      const hashes = [];
      for (let i = 0; i < 5; i++) {
        hashes.push(ethers.keccak256(ethers.toUtf8Bytes(`student_batch_record_${i}`)));
      }

      const tx = await credRegistry.connect(muet).batchIssueCredentials(hashes);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      await expect(tx)
        .to.emit(credRegistry, "BatchCredentialsIssued")
        .withArgs(5, muet.address, block.timestamp);

      for (let i = 0; i < 5; i++) {
        const record = await credRegistry.getCredential(hashes[i]);
        expect(record.state).to.equal(1); // Issued
      }
    });

    it("TC-NEG-09: should revert batch issuance if array is empty or exceeds limit", async function () {
      await expect(
        credRegistry.connect(muet).batchIssueCredentials([])
      ).to.be.revertedWithCustomError(credRegistry, "EmptyBatchArray");

      const oversized = new Array(101).fill(ethers.keccak256(ethers.toUtf8Bytes("fill")));
      await expect(
        credRegistry.connect(muet).batchIssueCredentials(oversized)
      ).to.be.revertedWithCustomError(credRegistry, "BatchSizeExceeded");
    });
  });

  describe("Credential Revocation", function () {
    let targetHash;

    beforeEach(async function () {
      targetHash = ethers.keccak256(ethers.toUtf8Bytes("revocation_test_subject"));
      await credRegistry.connect(muet).issueCredential(targetHash);
    });

    it("TC-POS-06: should allow issuing institution to revoke its issued credential", async function () {
      const reason = "Administrative disciplinary board decision 2025-D4";
      const tx = await credRegistry.connect(muet).revokeCredential(targetHash, reason);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      await expect(tx)
        .to.emit(credRegistry, "CredentialRevoked")
        .withArgs(targetHash, muet.address, reason, block.timestamp);

      const record = await credRegistry.getCredential(targetHash);
      expect(record.isRevoked).to.be.true;
      expect(record.state).to.equal(2); // Revoked
    });

    it("TC-POS-07: should allow consortium admin (HEC) to revoke credential", async function () {
      const reason = "Accreditation audit non-compliance";
      await expect(
        credRegistry.connect(admin).revokeCredential(targetHash, reason)
      ).to.not.be.reverted;

      const record = await credRegistry.getCredential(targetHash);
      expect(record.isRevoked).to.be.true;
    });

    it("TC-NEG-10: should revert if non-issuer non-admin attempts revocation", async function () {
      await expect(
        credRegistry.connect(unauthorized).revokeCredential(targetHash, "Malicious attempt")
      ).to.be.revertedWithCustomError(credRegistry, "NotCredentialIssuerOrAdmin");
    });

    it("TC-NEG-11: should revert if credential is already revoked", async function () {
      await credRegistry.connect(muet).revokeCredential(targetHash, "First revocation");

      await expect(
        credRegistry.connect(muet).revokeCredential(targetHash, "Second revocation attempt")
      ).to.be.revertedWithCustomError(credRegistry, "CredentialAlreadyRevoked");
    });

    it("TC-NEG-12: should revert revocation on unissued hash or empty reason", async function () {
      const unissued = ethers.keccak256(ethers.toUtf8Bytes("ghost"));
      await expect(
        credRegistry.connect(muet).revokeCredential(unissued, "Reason")
      ).to.be.revertedWithCustomError(credRegistry, "CredentialNotFound");

      await expect(
        credRegistry.connect(muet).revokeCredential(targetHash, "")
      ).to.be.revertedWithCustomError(credRegistry, "EmptyRevocationReason");
    });
  });
});
