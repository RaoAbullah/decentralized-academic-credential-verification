/**
 * @file seedData.js
 * @notice Realistic Demonstration Workflow & Seeding Script
 * @dev Accurately executes and verifies the five core functional milestones:
 *      Milestone 1: Institution Registration (HEC registers MUET)
 *      Milestone 2: Credential Issuance (Two-stage Keccak-256 commitment anchored on-chain)
 *      Milestone 3: Initial Verification (Employer receives disclosure bundle, recomputes commitment, verifies via eth_call)
 *      Milestone 4: Credential Revocation (Issuing institution revokes credential)
 *      Milestone 5: Post-Revocation Verification (Employer verifies that gateway reflects revocation)
 *      NOTE: All student data in this demonstration is strictly SYNTHETIC.
 */

const { ethers } = require("hardhat");
const {
  createCredentialPackage,
  createAuthorizedDisclosureBundle,
  computePayloadHash,
  computeCredentialCommitment
} = require("./generateHash");

async function main() {
  console.log("===============================================================================");
  console.log("  MUET CS-491: FIVE FUNCTIONAL MILESTONES DEMONSTRATION WORKFLOW               ");
  console.log("===============================================================================\n");

  const [admin, muetRegistrar, employer] = await ethers.getSigners();

  // 0. Deploy Contracts to Local EVM
  console.log("[Setup] Deploying contract suite to clean local Hardhat EVM...");
  const InstFactory = await ethers.getContractFactory("InstitutionRegistry");
  const instRegistry = await InstFactory.deploy(admin.address);
  await instRegistry.waitForDeployment();

  const CredFactory = await ethers.getContractFactory("CredentialRegistry");
  const credRegistry = await CredFactory.deploy(admin.address, await instRegistry.getAddress());
  await credRegistry.waitForDeployment();

  const GatewayFactory = await ethers.getContractFactory("VerificationGateway");
  const gateway = await GatewayFactory.deploy(
    await instRegistry.getAddress(),
    await credRegistry.getAddress()
  );
  await gateway.waitForDeployment();

  console.log("  -> InstitutionRegistry:", await instRegistry.getAddress());
  console.log("  -> CredentialRegistry: ", await credRegistry.getAddress());
  console.log("  -> VerificationGateway:", await gateway.getAddress());

  // ---------------------------------------------------------------------------
  // MILESTONE 1: Institution Registration
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("MILESTONE 1: Institution Registration");
  console.log("-------------------------------------------------------------------------------");
  console.log("Action: HEC Admin registers MUET as an accredited issuing institution...");
  const regTx = await instRegistry.connect(admin).registerInstitution(
    muetRegistrar.address,
    "Mehran University of Engineering and Technology",
    "PK-MUET-001"
  );
  await regTx.wait();
  const isMuetActive = await instRegistry.isInstitutionActive(muetRegistrar.address);
  console.log("  -> Registered Address: ", muetRegistrar.address);
  console.log("  -> Accreditation Code: PK-MUET-001");
  console.log("  -> Standing Active?    ", isMuetActive);
  if (!isMuetActive) throw new Error("Milestone 1 Failed: Institution not active");
  console.log("  [MILESTONE 1 RESULT: SUCCESS]");

  // ---------------------------------------------------------------------------
  // MILESTONE 2: Credential Issuance
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("MILESTONE 2: Credential Issuance (Two-Stage Keccak-256 Commitment)");
  console.log("-------------------------------------------------------------------------------");
  const syntheticStudentData = {
    institution: "Mehran University of Engineering and Technology",
    institutionCode: "PK-MUET-001",
    rollNumber: "22CS102",
    fullName: "Student 22CS102",
    degree: "BE Computer Systems Engineering",
    cgpa: "3.89",
    graduationDate: "2025-11-20"
  };

  const credPackage = createCredentialPackage(syntheticStudentData);
  console.log("Step 2A (Off-Chain Canonicalization & Stage 1 Hash):");
  console.log("  -> Canonical JSON:    ", credPackage.canonicalJson);
  console.log("  -> Stage 1 PayloadHash:", credPackage.payloadHash);

  console.log("\nStep 2B (Private Salt Generation & Stage 2 Commitment):");
  const maskedSalt = credPackage.salt.slice(0, 6) + "..." + credPackage.salt.slice(-4) + " [REDACTED: 32 bytes stored in student private vault]";
  console.log("  -> Secret Salt:        ", maskedSalt);
  console.log("  -> On-Chain Commitment:", credPackage.credentialHash);

  console.log("\nStep 2C (Anchoring Commitment On-Chain):");
  const issueTx = await credRegistry.connect(muetRegistrar).issueCredential(credPackage.credentialHash);
  await issueTx.wait();
  console.log("  -> Commitment anchored by MUET in CredentialRegistry.");
  console.log("  -> On-Chain Data Check: Only bytes32 hash, issuer address, and timestamps reside on-chain.");
  console.log("  [MILESTONE 2 RESULT: SUCCESS]");

  // ---------------------------------------------------------------------------
  // MILESTONE 3: Initial Read-Only Verification
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("MILESTONE 3: Initial Verification (Employer Workflow via eth_call)");
  console.log("-------------------------------------------------------------------------------");
  console.log("Step 3A: Student authorizes employer by generating an Authorized Disclosure Bundle...");
  const disclosureBundle = createAuthorizedDisclosureBundle(credPackage, "Prospective Employer");
  console.log("  -> Notice:", disclosureBundle.notice);
  console.log("  -> Salt Disclosure Reality: Once shared with this employer, the employer possesses the salt");
  console.log("     and can reproduce the commitment. The salt is no longer secret from this employer,");
  console.log("     but remains unrevealed to unauthorized public observers.");

  console.log("\nStep 3B: Employer independently recalculates commitment locally...");
  const employerPayload = computePayloadHash(disclosureBundle.transcriptPayload);
  const employerCalculatedCommitment = computeCredentialCommitment(
    employerPayload.payloadHash,
    disclosureBundle.disclosedSalt
  );
  console.log("  -> Locally Calculated Hash:", employerCalculatedCommitment);
  console.log("  -> Does it match student's commitment? ", employerCalculatedCommitment === credPackage.credentialHash);

  console.log("\nStep 3C: Employer evaluates VerificationGateway via read-only eth_call ($0 tx fee)...");
  const initialResult = await gateway.verifyCredential(employerCalculatedCommitment);
  console.log("  Verification Output:");
  console.log("  -> Is Valid?          ", initialResult.isValid);
  console.log("  -> Status Message:    ", initialResult.statusMessage);
  console.log("  -> Institution Name:  ", initialResult.institutionName);
  console.log("  -> Accreditation Code:", initialResult.accreditationCode);
  console.log("  -> Issuer Address:    ", initialResult.issuerAddress);
  console.log("  -> Issued At (Time):  ", new Date(Number(initialResult.issuedAt) * 1000).toLocaleString());

  if (!initialResult.isValid) throw new Error("Milestone 3 Failed: Credential should be valid");
  console.log("  [MILESTONE 3 RESULT: SUCCESS]");

  // ---------------------------------------------------------------------------
  // MILESTONE 4: Credential Revocation
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("MILESTONE 4: Credential Revocation");
  console.log("-------------------------------------------------------------------------------");
  console.log("Action: MUET Disciplinary Council revokes credential with official audit reason...");
  const revokeTx = await credRegistry.connect(muetRegistrar).revokeCredential(
    credPackage.credentialHash,
    "Disciplinary Council Decision 2026-DC-08"
  );
  await revokeTx.wait();
  console.log("  -> Revocation transaction mined on-chain.");
  const record = await credRegistry.getCredential(credPackage.credentialHash);
  console.log("  -> State Machine on Registry: isRevoked =", record.isRevoked, "| State Code =", record.state);
  if (!record.isRevoked) throw new Error("Milestone 4 Failed: Credential flag isRevoked must be true");
  console.log("  [MILESTONE 4 RESULT: SUCCESS]");

  // ---------------------------------------------------------------------------
  // MILESTONE 5: Post-Revocation Verification
  // ---------------------------------------------------------------------------
  console.log("\n-------------------------------------------------------------------------------");
  console.log("MILESTONE 5: Post-Revocation Verification");
  console.log("-------------------------------------------------------------------------------");
  console.log("Action: Employer re-evaluates gateway using the identical credential package...");
  const revokedResult = await gateway.verifyCredential(employerCalculatedCommitment);
  console.log("  Verification Output:");
  console.log("  -> Is Valid?          ", revokedResult.isValid);
  console.log("  -> Status Message:    ", revokedResult.statusMessage);
  console.log("  -> Revoked Flag:      ", revokedResult.isRevoked);
  console.log("  -> Revoked At (Time): ", new Date(Number(revokedResult.revokedAt) * 1000).toLocaleString());

  if (revokedResult.isValid || !revokedResult.isRevoked) {
    throw new Error("Milestone 5 Failed: Revoked credential must return isValid=false and isRevoked=true");
  }
  console.log("  [MILESTONE 5 RESULT: SUCCESS]");

  console.log("\n===============================================================================");
  console.log("ALL FIVE FUNCTIONAL MILESTONES VERIFIED AND CONFIRMED SUCCESSFULLY!");
  console.log("===============================================================================");
}

main().catch((error) => {
  console.error("Demonstration script failed:", error);
  process.exitCode = 1;
});
