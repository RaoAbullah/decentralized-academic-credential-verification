const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("InstitutionRegistry (Module 1 - Governance & Identity)", function () {
  let InstitutionRegistry;
  let registry;
  let admin, regulator, muet, ned, unauthorized;

  const MUET_NAME = "Mehran University of Engineering and Technology";
  const MUET_CODE = "PK-MUET-001";
  const NED_NAME = "NED University of Engineering and Technology";
  const NED_CODE = "PK-NED-002";

  beforeEach(async function () {
    [admin, regulator, muet, ned, unauthorized] = await ethers.getSigners();

    const Factory = await ethers.getContractFactory("InstitutionRegistry");
    registry = await Factory.deploy(admin.address);
    await registry.waitForDeployment();

    // Grant regulator role to regulator account
    const REGULATOR_ROLE = await registry.REGULATOR_ROLE();
    await registry.connect(admin).grantRole(REGULATOR_ROLE, regulator.address);
  });

  describe("Deployment & Role Initialization", function () {
    it("should set deployer as DEFAULT_ADMIN_ROLE and REGULATOR_ROLE", async function () {
      const DEFAULT_ADMIN_ROLE = await registry.DEFAULT_ADMIN_ROLE();
      const REGULATOR_ROLE = await registry.REGULATOR_ROLE();

      expect(await registry.hasRole(DEFAULT_ADMIN_ROLE, admin.address)).to.be.true;
      expect(await registry.hasRole(REGULATOR_ROLE, admin.address)).to.be.true;
      expect(await registry.hasRole(REGULATOR_ROLE, regulator.address)).to.be.true;
    });

    it("should revert if initialized with zero address admin", async function () {
      const Factory = await ethers.getContractFactory("InstitutionRegistry");
      await expect(Factory.deploy(ethers.ZeroAddress)).to.be.revertedWithCustomError(
        registry,
        "ZeroAddressNotAllowed"
      );
    });
  });

  describe("Institution Registration", function () {
    it("TC-POS-01: should allow regulator to register an accredited university", async function () {
      const tx = await registry.connect(regulator).registerInstitution(
        muet.address,
        MUET_NAME,
        MUET_CODE
      );
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      await expect(tx)
        .to.emit(registry, "InstitutionRegistered")
        .withArgs(muet.address, MUET_NAME, MUET_CODE, block.timestamp);

      expect(await registry.isInstitutionActive(muet.address)).to.be.true;

      const inst = await registry.getInstitution(muet.address);
      expect(inst.name).to.equal(MUET_NAME);
      expect(inst.accreditationCode).to.equal(MUET_CODE);
      expect(inst.status).to.equal(1); // Active
    });

    it("TC-NEG-01: should revert if non-regulator attempts to register", async function () {
      await expect(
        registry.connect(unauthorized).registerInstitution(muet.address, MUET_NAME, MUET_CODE)
      ).to.be.revertedWithCustomError(registry, "AccessControlUnauthorizedAccount");
    });

    it("TC-NEG-02: should revert on zero address or empty name/code", async function () {
      await expect(
        registry.connect(regulator).registerInstitution(ethers.ZeroAddress, MUET_NAME, MUET_CODE)
      ).to.be.revertedWithCustomError(registry, "ZeroAddressNotAllowed");

      await expect(
        registry.connect(regulator).registerInstitution(muet.address, "", MUET_CODE)
      ).to.be.revertedWithCustomError(registry, "EmptyStringNotAllowed");

      await expect(
        registry.connect(regulator).registerInstitution(muet.address, MUET_NAME, "")
      ).to.be.revertedWithCustomError(registry, "EmptyStringNotAllowed");
    });

    it("TC-NEG-03: should prevent registering duplicate institution", async function () {
      await registry.connect(regulator).registerInstitution(muet.address, MUET_NAME, MUET_CODE);

      await expect(
        registry.connect(regulator).registerInstitution(muet.address, MUET_NAME, MUET_CODE)
      ).to.be.revertedWithCustomError(registry, "InstitutionAlreadyRegistered");
    });
  });

  describe("Status Transitions & Suspensions", function () {
    beforeEach(async function () {
      await registry.connect(regulator).registerInstitution(muet.address, MUET_NAME, MUET_CODE);
    });

    it("TC-POS-02: should allow regulator to suspend and reinstate an institution", async function () {
      // Suspend
      const tx = await registry.connect(regulator).updateInstitutionStatus(muet.address, 2); // Suspended
      const receipt = await tx.wait();
      const block = await ethers.provider.getBlock(receipt.blockNumber);

      await expect(tx)
        .to.emit(registry, "InstitutionStatusUpdated")
        .withArgs(muet.address, 1, 2, block.timestamp);

      expect(await registry.isInstitutionActive(muet.address)).to.be.false;

      // Reinstate
      await registry.connect(regulator).updateInstitutionStatus(muet.address, 1); // Active
      expect(await registry.isInstitutionActive(muet.address)).to.be.true;
    });

    it("TC-NEG-04: should revert if transition to identical status is requested", async function () {
      await expect(
        registry.connect(regulator).updateInstitutionStatus(muet.address, 1) // Already Active
      ).to.be.revertedWithCustomError(registry, "IdenticalStatusTransition");
    });

    it("TC-NEG-05: should revert status update for unregistered institution", async function () {
      await expect(
        registry.connect(regulator).updateInstitutionStatus(ned.address, 2)
      ).to.be.revertedWithCustomError(registry, "InstitutionNotRegistered");
    });
  });

  describe("Emergency Circuit Breaker (Pausable)", function () {
    it("should allow admin to pause and block mutations", async function () {
      await registry.connect(admin).pause();

      await expect(
        registry.connect(regulator).registerInstitution(ned.address, NED_NAME, NED_CODE)
      ).to.be.revertedWithCustomError(registry, "EnforcedPause");

      await registry.connect(admin).unpause();
      await expect(
        registry.connect(regulator).registerInstitution(ned.address, NED_NAME, NED_CODE)
      ).to.not.be.reverted;
    });
  });
});
