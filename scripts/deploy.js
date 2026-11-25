/**
 * @file deploy.js
 * @notice Multi-Contract Deployment & Linking Script
 * @dev Deploys InstitutionRegistry, CredentialRegistry, and VerificationGateway.
 */

const { ethers } = require("hardhat");

async function main() {
  console.log("===============================================================================");
  console.log("    MUET CS-491: DECENTRALIZED ACADEMIC CREDENTIAL VERIFICATION DEPLOYMENT    ");
  console.log("===============================================================================\n");

  const [deployer] = await ethers.getSigners();
  console.log("Deployer Address:", deployer.address);
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("Deployer Balance:", ethers.formatEther(balance), "ETH\n");

  // Step 1: Deploy InstitutionRegistry
  console.log("1. Deploying InstitutionRegistry...");
  const InstFactory = await ethers.getContractFactory("InstitutionRegistry");
  const instRegistry = await InstFactory.deploy(deployer.address);
  await instRegistry.waitForDeployment();
  const instAddress = await instRegistry.getAddress();
  console.log("   -> InstitutionRegistry deployed at:", instAddress);

  // Step 2: Deploy CredentialRegistry
  console.log("2. Deploying CredentialRegistry...");
  const CredFactory = await ethers.getContractFactory("CredentialRegistry");
  const credRegistry = await CredFactory.deploy(deployer.address, instAddress);
  await credRegistry.waitForDeployment();
  const credAddress = await credRegistry.getAddress();
  console.log("   -> CredentialRegistry deployed at:", credAddress);

  // Step 3: Deploy VerificationGateway
  console.log("3. Deploying VerificationGateway...");
  const GatewayFactory = await ethers.getContractFactory("VerificationGateway");
  const gateway = await GatewayFactory.deploy(instAddress, credAddress);
  await gateway.waitForDeployment();
  const gatewayAddress = await gateway.getAddress();
  console.log("   -> VerificationGateway deployed at:", gatewayAddress);

  // Step 4: Register accredited institutions
  console.log("4. Registering accredited institutions in InstitutionRegistry...");
  const signers = await ethers.getSigners();
  const muetRegistrar = signers[1];
  const regTx1 = await instRegistry.registerInstitution(
    muetRegistrar.address,
    "Mehran University of Engineering and Technology",
    "PK-MUET-001"
  );
  await regTx1.wait();
  console.log("   -> MUET Examination Branch accredited at:", muetRegistrar.address);

  const regTx2 = await instRegistry.registerInstitution(
    deployer.address,
    "MUET Central Administration",
    "PK-MUET-HEC"
  );
  await regTx2.wait();
  console.log("   -> MUET Central Administration accredited at:", deployer.address);

  console.log("\n===============================================================================");
  console.log("All three interacting contracts deployed and linked successfully!");
  console.log("===============================================================================");

  // Persist deployment addresses and ABIs to deployment artifacts for frontend integration
  const fs = require("fs");
  const path = require("path");

  const deploymentData = {
    network: "localhost",
    chainId: 1337,
    rpcUrl: "http://127.0.0.1:8545",
    deployedAt: new Date().toISOString(),
    contracts: {
      InstitutionRegistry: {
        address: instAddress,
        abi: (await artifacts.readArtifact("InstitutionRegistry")).abi,
      },
      CredentialRegistry: {
        address: credAddress,
        abi: (await artifacts.readArtifact("CredentialRegistry")).abi,
      },
      VerificationGateway: {
        address: gatewayAddress,
        abi: (await artifacts.readArtifact("VerificationGateway")).abi,
      },
    },
  };

  const deploymentsDir = path.join(__dirname, "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }
  fs.writeFileSync(
    path.join(deploymentsDir, "localhost.json"),
    JSON.stringify(deploymentData, null, 2)
  );

  const frontendContractsDir = path.join(__dirname, "..", "frontend", "src", "contracts");
  if (!fs.existsSync(frontendContractsDir)) {
    fs.mkdirSync(frontendContractsDir, { recursive: true });
  }
  fs.writeFileSync(
    path.join(frontendContractsDir, "deployedContracts.json"),
    JSON.stringify(deploymentData, null, 2)
  );
  console.log("Deployment manifest & ABIs successfully synced to frontend/src/contracts/deployedContracts.json\n");
}

main().catch((error) => {
  console.error("Deployment failed:", error);
  process.exitCode = 1;
});
