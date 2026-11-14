const { ethers, network } = require("hardhat");
require("dotenv").config();

// Deploys ChambitaCertificate. The deployer becomes admin; ISSUER_ADDRESS is the backend's
// issuing account (defaults to the deployer for a first deployment).
async function main() {
  const [deployer] = await ethers.getSigners();
  const issuer = process.env.ISSUER_ADDRESS || deployer.address;
  const baseUri = process.env.CERTIFICATE_BASE_URI;
  if (!baseUri) throw new Error("CERTIFICATE_BASE_URI is required, e.g. https://<portal>/?hash=");

  const Factory = await ethers.getContractFactory("ChambitaCertificate");
  const contract = await Factory.deploy(deployer.address, issuer, baseUri);
  await contract.waitForDeployment();

  console.log(`network:  ${network.name}`);
  console.log(`admin:    ${deployer.address}`);
  console.log(`issuer:   ${issuer}`);
  console.log(`contract: ${await contract.getAddress()}`);
  console.log(`tx:       ${contract.deploymentTransaction().hash}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
