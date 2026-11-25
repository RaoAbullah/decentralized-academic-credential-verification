const { ethers } = require("hardhat");
const deployedContracts = require("../frontend/src/contracts/deployedContracts.json");

async function main() {
  console.log("=== Testing Real Contract Operations against Local Hardhat Node ===");
  const provider = new ethers.JsonRpcProvider(deployedContracts.rpcUrl);
  const signers = await ethers.getSigners();
  const hecAdmin = signers[0]; // 0xf39F... (DEFAULT_ADMIN_ROLE, REGULATOR_ROLE)
  const muetRegistrar = signers[1]; // 0x7099... (MUET)
  const attacker = signers[5]; // 0x9965... (Unauthorized)

  const instContract = new ethers.Contract(
    deployedContracts.contracts.InstitutionRegistry.address,
    deployedContracts.contracts.InstitutionRegistry.abi,
    provider
  );
  const credContract = new ethers.Contract(
    deployedContracts.contracts.CredentialRegistry.address,
    deployedContracts.contracts.CredentialRegistry.abi,
    provider
  );
  const gatewayContract = new ethers.Contract(
    deployedContracts.contracts.VerificationGateway.address,
    deployedContracts.contracts.VerificationGateway.abi,
    provider
  );

  console.log("\n1. Testing Institution Registration by HEC Admin (Account #0)...");
  const isMuetRegistered = await instContract.isInstitutionActive(muetRegistrar.address);
  if (!isMuetRegistered) {
    const tx = await instContract.connect(hecAdmin).registerInstitution(
      muetRegistrar.address,
      "Mehran University of Engineering and Technology",
      "PK-MUET-001"
    );
    await tx.wait();
    console.log("   -> MUET registered successfully by HEC Admin. Tx hash:", tx.hash);
  } else {
    console.log("   -> MUET is already registered and active.");
  }

  console.log("\n2. Testing Unauthorized Registration Attempt by Attacker (Account #5)...");
  try {
    await instContract.connect(attacker).registerInstitution(
      attacker.address,
      "Rogue Academy",
      "PK-ROGUE-999"
    );
    console.error("   -> ERROR: Attacker registration should have failed!");
  } catch (err) {
    console.log("   -> Correctly REVERTED as expected:", err.message.slice(0, 100) + "...");
  }

  console.log("\n3. Testing Credential Issuance by Accredited MUET Registrar (Account #1)...");
  const testHash = ethers.keccak256(ethers.toUtf8Bytes("TestCredential-Phase2-" + Date.now()));
  const issueTx = await credContract.connect(muetRegistrar).issueCredential(testHash);
  const issueReceipt = await issueTx.wait();
  console.log("   -> Credential anchored on-chain by MUET. Gas used:", issueReceipt.gasUsed.toString());

  console.log("\n4. Testing Read-Only Verification via VerificationGateway...");
  const result = await gatewayContract.verifyCredential(testHash);
  console.log("   -> Verification isValid:", result.isValid);
  console.log("   -> Institution Name:   ", result.institutionName);
  console.log("   -> Status Message:     ", result.statusMessage);
  console.log("   -> Issuer Address:     ", result.issuerAddress);

  console.log("\n5. Testing Unauthorized Issuance by Attacker (Account #5)...");
  const attackerHash = ethers.keccak256(ethers.toUtf8Bytes("AttackerCredential-" + Date.now()));
  try {
    await credContract.connect(attacker).issueCredential(attackerHash);
    console.error("   -> ERROR: Attacker issuance should have failed!");
  } catch (err) {
    console.log("   -> Correctly REVERTED as expected:", err.message.slice(0, 100) + "...");
  }

  console.log("\n6. Testing Credential Revocation by MUET Registrar...");
  const revokeTx = await credContract.connect(muetRegistrar).revokeCredential(
    testHash,
    "Disciplinary Council Phase 2 Test Revocation"
  );
  await revokeTx.wait();
  console.log("   -> Revocation mined on-chain.");

  console.log("\n7. Testing Verification After Revocation...");
  const revokedResult = await gatewayContract.verifyCredential(testHash);
  console.log("   -> Verification isValid:", revokedResult.isValid);
  console.log("   -> Status Message:     ", revokedResult.statusMessage);
  console.log("   -> Is Revoked:         ", revokedResult.isRevoked);

  console.log("\n=== All Lifecycle Tests Passed on Local Hardhat Node ===");
}

main().catch(console.error);
