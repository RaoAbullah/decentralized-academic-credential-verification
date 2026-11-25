const { expect } = require("chai");
const { ethers } = require("hardhat");
const { createCredentialManifest } = require("../scripts/generateHash");

describe("VerificationGateway (Module 3 - Cross-Contract Verification & Public Audit)", function () {
  let instRegistry;
  let credRegistry;
  let gateway;
  let admin, regulator, muet, employer, unaccredited;

  const MUET_NAME = "Mehran University of Engineering and Technology";
  const MUET_CODE = "PK-MUET-001";

  let sampleManifest;

  beforeEach(async function () {
    [admin, regulator, muet, employer, unaccredited] = await ethers.getSigners();

    // 1. Deploy InstitutionRegistry
    const InstFactory = await ethers.getContractFactory("InstitutionRegistry");
    instRegistry = await InstFactory.deploy(admin.address);
    await instRegistry.waitForDeployment();

    // Grant regulator role and register MUET
    const REGULATOR_ROLE = await instRegistry.REGULATOR_ROLE();
    await instRegistry.connect(admin).grantRole(REGULATOR_ROLE, regulator.address);
    await instRegistry.connect(regulator).registerInstitution(muet.address, MUET_NAME, MUET_CODE);

    // 2. Deploy CredentialRegistry linked to InstitutionRegistry
    const CredFactory = await ethers.getContractFactory("CredentialRegistry");
    credRegistry = await CredFactory.deploy(admin.address, await instRegistry.getAddress());
    await credRegistry.waitForDeployment();

    // 3. Deploy VerificationGateway linked to both registries
    const GatewayFactory = await ethers.getContractFactory("VerificationGateway");
    gateway = await GatewayFactory.deploy(
      await instRegistry.getAddress(),
      await credRegistry.getAddress()
    );
    await gateway.waitForDeployment();

    // 4. Issue a valid credential hash
    sampleManifest = createCredentialManifest({
      rollNumber: "21CS045-SYNTHETIC",
      fullName: "Synthetic Test Student",
      degree: "BE Computer Systems Engineering",
      cgpa: "3.85",
      graduationDate: "2025-12-15"
    });

    await credRegistry.connect(muet).issueCredential(sampleManifest.credentialHash);
  });

  describe("Cross-Contract Read-Only Verification (Zero Gas, Default Mode)", function () {
    it("TC-POS-08: should verify a valid credential and return full institutional metadata", async function () {
      const result = await gateway.verifyCredential(sampleManifest.credentialHash);

      expect(result.isValid).to.be.true;
      expect(result.statusMessage).to.equal("Credential is valid and issuing institution is accredited");
      expect(result.issuerAddress).to.equal(muet.address);
      expect(result.institutionName).to.equal(MUET_NAME);
      expect(result.accreditationCode).to.equal(MUET_CODE);
      expect(result.isRevoked).to.be.false;
      expect(result.revokedAt).to.equal(0);
    });

    it("TC-NEG-13: should return isValid = false when credential hash is not found on ledger", async function () {
      const nonexistentHash = ethers.keccak256(ethers.toUtf8Bytes("fake_unissued_degree"));
      const result = await gateway.verifyCredential(nonexistentHash);

      expect(result.isValid).to.be.false;
      expect(result.statusMessage).to.equal("Credential hash not found on ledger");
      expect(result.issuerAddress).to.equal(ethers.ZeroAddress);
    });

    it("TC-NEG-14: should return isValid = false when credential has been revoked", async function () {
      await credRegistry.connect(muet).revokeCredential(
        sampleManifest.credentialHash,
        "Forged prerequisite documentation"
      );

      const result = await gateway.verifyCredential(sampleManifest.credentialHash);

      expect(result.isValid).to.be.false;
      expect(result.statusMessage).to.equal("Credential has been officially revoked");
      expect(result.isRevoked).to.be.true;
      expect(result.revokedAt).to.be.gt(0);
      expect(result.institutionName).to.equal(MUET_NAME);
    });

    it("TC-INT-02: should return isValid = false when issuing institution is suspended by regulator", async function () {
      // Regulator suspends MUET
      await instRegistry.connect(regulator).updateInstitutionStatus(muet.address, 2); // Suspended

      const result = await gateway.verifyCredential(sampleManifest.credentialHash);

      expect(result.isValid).to.be.false;
      expect(result.statusMessage).to.equal(
        "Credential exists but issuing institution is suspended or inactive"
      );
      expect(result.isRevoked).to.be.false;
    });
  });

  describe("Optional State-Modifying Verification Audit Log", function () {
    it("TC-POS-09: should record verification receipt and emit VerificationLogged", async function () {
      const tx = await gateway.connect(employer).logVerificationReceipt(sampleManifest.credentialHash);
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      await expect(tx)
        .to.emit(gateway, "VerificationLogged")
        .withArgs(
          sampleManifest.credentialHash,
          employer.address,
          true,
          block.timestamp
        );
    });
  });
});
