const { ethers } = require("ethers");
const manifest = require("../frontend/src/contracts/deployedContracts.json");

async function check() {
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8545");
  const gwAddr = manifest.contracts.VerificationGateway.address;
  console.log("Checking code at old address:", gwAddr);
  const code = await provider.getCode(gwAddr);
  console.log("Bytecode length:", code.length, "Bytecode:", code);
  if (code === "0x" || code.length <= 2) {
    console.log("VERIFIED: As expected, restarting an in-memory node wipes EVM state. Redeployment is REQUIRED.");
  } else {
    console.log("Code exists!");
  }
}

check().catch(console.error);
