import { ethers } from 'ethers';
import deploymentManifest from '../contracts/deployedContracts.json';

const RPC_URL = deploymentManifest.rpcUrl || "http://127.0.0.1:8545";

// Default well-known Hardhat accounts for demonstration of multi-party roles
export const HARDHAT_ACCOUNTS = [
  {
    index: 0,
    label: "HEC Consortium Admin (Regulator)",
    address: "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266",
    role: "DEFAULT_ADMIN_ROLE + REGULATOR_ROLE",
    description: "Authorized to register universities, suspend/reinstate, and trigger emergency circuit breaker."
  },
  {
    index: 1,
    label: "MUET Jamshoro Registrar",
    address: "0x70997970C51812dc3A010C7d01b50e0d17dc79C8",
    role: "Accredited University Issuer (PK-MUET-001)",
    description: "Authorized to issue single and batch credentials for MUET graduates and revoke MUET credentials."
  },
  {
    index: 2,
    label: "NED UET Karachi Registrar",
    address: "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC",
    role: "Accredited University Issuer (PK-NED-002)",
    description: "Authorized to issue NED credentials. Reverts if attempting to revoke MUET credentials."
  },
  {
    index: 3,
    label: "NUST Islamabad Registrar",
    address: "0x90F79bf6EB2c4f870365E785982E1f101E93b906",
    role: "Accredited University Issuer (PK-NUST-003)",
    description: "Accredited consortium partner university."
  },
  {
    index: 5,
    label: "Unauthorized / Rogue Actor",
    address: "0x9965507D1a55bcC2695C58ba16FB37d819B0A4dc",
    role: "Unaccredited External Account",
    description: "Used to demonstrate on-chain access control rejections (UnauthorizedInstitution, AccessControlUnauthorizedAccount)."
  }
];

export function getProvider() {
  return new ethers.JsonRpcProvider(RPC_URL);
}

export async function checkBlockchainStatus() {
  try {
    const provider = getProvider();
    const network = await provider.getNetwork();
    const blockNumber = await provider.getBlockNumber();

    const gwAddress = deploymentManifest.contracts?.VerificationGateway?.address;
    let isDeployed = false;
    if (gwAddress) {
      const code = await provider.getCode(gwAddress);
      isDeployed = code !== "0x" && code.length > 2;
    }

    return {
      isConnected: true,
      chainId: Number(network.chainId),
      blockNumber,
      isDeployed,
      rpcUrl: RPC_URL,
      addresses: {
        InstitutionRegistry: deploymentManifest.contracts?.InstitutionRegistry?.address || "Not deployed",
        CredentialRegistry: deploymentManifest.contracts?.CredentialRegistry?.address || "Not deployed",
        VerificationGateway: deploymentManifest.contracts?.VerificationGateway?.address || "Not deployed",
      },
      error: null
    };
  } catch (err) {
    return {
      isConnected: false,
      chainId: null,
      blockNumber: null,
      isDeployed: false,
      rpcUrl: RPC_URL,
      addresses: {},
      error: "Unable to connect to local Hardhat node at " + RPC_URL + ". Ensure 'npx hardhat node' is running."
    };
  }
}

export async function getSigner(accountIndex = 0) {
  const provider = getProvider();
  return provider.getSigner(accountIndex);
}

export function getContractInstances(signerOrProvider) {
  const { InstitutionRegistry, CredentialRegistry, VerificationGateway } = deploymentManifest.contracts;
  return {
    institutionRegistry: new ethers.Contract(InstitutionRegistry.address, InstitutionRegistry.abi, signerOrProvider),
    credentialRegistry: new ethers.Contract(CredentialRegistry.address, CredentialRegistry.abi, signerOrProvider),
    verificationGateway: new ethers.Contract(VerificationGateway.address, VerificationGateway.abi, signerOrProvider),
  };
}

export function parseContractError(err) {
  if (!err) return "Unknown error occurred.";

  const message = err.message || err.toString();

  // Match custom Solidity errors defined in contracts
  if (message.includes("AccessControlUnauthorizedAccount") || message.includes("REGULATOR_ROLE")) {
    return "On-Chain Rejection: Caller lacks the required administrative role (REGULATOR_ROLE). Only HEC Admin can perform this action.";
  }
  if (message.includes("UnauthorizedInstitution")) {
    return "On-Chain Rejection: Caller is not registered as an Active accredited institution in InstitutionRegistry.";
  }
  if (message.includes("CredentialAlreadyExists")) {
    return "On-Chain Rejection: This credential commitment hash has already been issued on-chain.";
  }
  if (message.includes("CredentialNotFound")) {
    return "On-Chain Rejection: The requested credential hash was not found on the blockchain ledger.";
  }
  if (message.includes("CredentialAlreadyRevoked")) {
    return "On-Chain Rejection: This credential has already been officially revoked.";
  }
  if (message.includes("NotCredentialIssuerOrAdmin")) {
    return "On-Chain Rejection: Only the original issuing university or the HEC Consortium Admin is authorized to revoke this credential.";
  }
  if (message.includes("InstitutionAlreadyRegistered")) {
    return "On-Chain Rejection: An institution with this address is already registered.";
  }
  if (message.includes("IdenticalStatusTransition")) {
    return "On-Chain Rejection: The institution already possesses this exact operational status.";
  }
  if (message.includes("EnforcedPause")) {
    return "On-Chain Rejection: The contract is currently PAUSED by the emergency consortium circuit breaker.";
  }
  if (message.includes("EmptyBatchArray") || message.includes("BatchSizeExceeded")) {
    return "On-Chain Rejection: Invalid batch array size (must be between 1 and 100 credentials).";
  }

  if (err.reason) return `Reverted: ${err.reason}`;
  return message.length > 180 ? message.slice(0, 180) + "..." : message;
}
