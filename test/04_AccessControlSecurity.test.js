const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("AccessControl & STRIDE Security Attacks Suite", function () {
  let instRegistry;
  let credRegistry;
  let gateway;
  let admin, regulator, muet, attacker, employer;

  const MUET_NAME = "Mehran University of Engineering and Technology";
  const MUET_CODE = "PK-MUET-001";

  beforeEach(async function () {
    [admin, regulator, muet, attacker, employer] = await ethers.getSigners();

    const InstFactory = await ethers.getContractFactory("InstitutionRegistry");
    instRegistry = await InstFactory.deploy(admin.address);
    await instRegistry.waitForDeployment();

    const REGULATOR_ROLE = await instRegistry.REGULATOR_ROLE();
    await instRegistry.connect(admin).grantRole(REGULATOR_ROLE, regulator.address);
    await instRegistry.connect(regulator).registerInstitution(muet.address, MUET_NAME, MUET_CODE);

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

  describe("STRIDE Attack Vector 1: Spoofing & Unauthorized Issuance", function () {
    it("TC-SEC-01: Attacker attempts to forge degree issuance as an unaccredited entity", async function () {
      const forgedHash = ethers.keccak256(ethers.toUtf8Bytes("fraudulent_muet_degree"));

      // Attacker wallet is not in InstitutionRegistry
      await expect(
        credRegistry.connect(attacker).issueCredential(forgedHash)
      ).to.be.revertedWithCustomError(credRegistry, "UnauthorizedInstitution")
        .withArgs(attacker.address);
    });
  });

  describe("STRIDE Attack Vector 2: Elevation of Privilege", function () {
    it("TC-SEC-02: Attacker attempts to grant itself REGULATOR_ROLE or DEFAULT_ADMIN_ROLE", async function () {
      const REGULATOR_ROLE = await instRegistry.REGULATOR_ROLE();

      await expect(
        instRegistry.connect(attacker).grantRole(REGULATOR_ROLE, attacker.address)
      ).to.be.revertedWithCustomError(instRegistry, "AccessControlUnauthorizedAccount")
        .withArgs(attacker.address, await instRegistry.DEFAULT_ADMIN_ROLE());
    });
  });

  describe("STRIDE Attack Vector 3: Repudiation & Cross-Institution Tampering", function () {
    it("TC-SEC-03: Malicious institution or rogue actor attempts to revoke another university's legitimate credential", async function () {
      const validHash = ethers.keccak256(ethers.toUtf8Bytes("legit_muet_graduate_2025"));
      await credRegistry.connect(muet).issueCredential(validHash);

      // Attacker attempts to revoke MUET's credential
      await expect(
        credRegistry.connect(attacker).revokeCredential(validHash, "Malicious sabotaged revocation")
      ).to.be.revertedWithCustomError(credRegistry, "NotCredentialIssuerOrAdmin")
        .withArgs(attacker.address, muet.address);
    });
  });

  describe("STRIDE Attack Vector 4: Denial of Service via Batch Array Griefing", function () {
    it("TC-SEC-04: Attacker or misconfigured client attempts to pass unbounded arrays to exhaust gas limits", async function () {
      const hugeBatch = new Array(105).fill(
        ethers.keccak256(ethers.toUtf8Bytes("dos_spam_item"))
      );

      await expect(
        credRegistry.connect(muet).batchIssueCredentials(hugeBatch)
      ).to.be.revertedWithCustomError(credRegistry, "BatchSizeExceeded")
        .withArgs(105, 100);
    });
  });

  describe("STRIDE Attack Vector 5: Tampering During Emergency Circuit Breaker (Pause)", function () {
    it("TC-SEC-05: Attacker attempts state modifications while the contract is paused by consortium admin", async function () {
      await credRegistry.connect(admin).pause();

      const credHash = ethers.keccak256(ethers.toUtf8Bytes("pause_attack_target"));
      await expect(
        credRegistry.connect(muet).issueCredential(credHash)
      ).to.be.revertedWithCustomError(credRegistry, "EnforcedPause");

      await expect(
        credRegistry.connect(muet).revokeCredential(credHash, "Reason")
      ).to.be.revertedWithCustomError(credRegistry, "EnforcedPause");
    });
  });
});
