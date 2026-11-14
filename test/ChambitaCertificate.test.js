const { expect } = require("chai");
const { ethers } = require("hardhat");

const BASE_URI = "https://verify.chambita.example/?hash=";

// Mirrors the backend: holder address = last 20 bytes of keccak256(pseudonymous holder id).
function holderAddressOf(pseudonymousId) {
  const digest = ethers.keccak256(ethers.toUtf8Bytes(pseudonymousId));
  return ethers.getAddress("0x" + digest.slice(-40));
}

describe("ChambitaCertificate (TS10)", function () {
  let contract, admin, issuer, stranger;
  const hash = ethers.keccak256(ethers.toUtf8Bytes("certificate-001"));
  const holder = holderAddressOf("holder-7f3a");

  beforeEach(async function () {
    [admin, issuer, stranger] = await ethers.getSigners();
    const Factory = await ethers.getContractFactory("ChambitaCertificate");
    contract = await Factory.deploy(admin.address, issuer.address, BASE_URI);
  });

  describe("Escenario 1: emisión autorizada", function () {
    it("emits the certificate to the derived holder address and records only the hash", async function () {
      await expect(contract.connect(issuer).issue(holder, hash))
        .to.emit(contract, "CertificateIssued").withArgs(1n, holder, hash)
        .and.to.emit(contract, "Locked").withArgs(1n);

      expect(await contract.ownerOf(1n)).to.equal(holder);
      const [exists, revoked, tokenId, owner] = await contract.verify(hash);
      expect(exists).to.equal(true);
      expect(revoked).to.equal(false);
      expect(tokenId).to.equal(1n);
      expect(owner).to.equal(holder);
    });

    it("rejects a hash that was already issued", async function () {
      await contract.connect(issuer).issue(holder, hash);
      await expect(contract.connect(issuer).issue(holder, hash))
        .to.be.revertedWithCustomError(contract, "HashAlreadyIssued");
    });

    it("rejects an empty hash", async function () {
      await expect(contract.connect(issuer).issue(holder, ethers.ZeroHash))
        .to.be.revertedWithCustomError(contract, "EmptyHash");
    });
  });

  describe("Escenario 2: emisión no autorizada", function () {
    it("rejects issuing from an account without ISSUER_ROLE", async function () {
      await expect(contract.connect(stranger).issue(holder, hash))
        .to.be.revertedWithCustomError(contract, "AccessControlUnauthorizedAccount");
    });
  });

  describe("Escenario 3: transferencia bloqueada", function () {
    it("is soulbound: locked, no approvals and no transfers", async function () {
      await contract.connect(issuer).issue(issuer.address, hash);
      expect(await contract.locked(1n)).to.equal(true);
      await expect(contract.connect(issuer).transferFrom(issuer.address, stranger.address, 1n))
        .to.be.revertedWithCustomError(contract, "Soulbound");
      await expect(contract.connect(issuer).approve(stranger.address, 1n))
        .to.be.revertedWithCustomError(contract, "Soulbound");
      await expect(contract.connect(issuer).setApprovalForAll(stranger.address, true))
        .to.be.revertedWithCustomError(contract, "Soulbound");
    });

    it("advertises the EIP-5192 interface", async function () {
      expect(await contract.supportsInterface("0xb45a3c0e")).to.equal(true);
    });
  });

  describe("Escenario 4: revocación", function () {
    it("marks the certificate as revoked", async function () {
      await contract.connect(issuer).issue(holder, hash);
      await expect(contract.connect(issuer).revoke(1n)).to.emit(contract, "CertificateRevoked").withArgs(1n, hash);
      const [exists, revoked, , , , revokedAt] = await contract.verify(hash);
      expect(exists).to.equal(true);
      expect(revoked).to.equal(true);
      expect(revokedAt).to.be.greaterThan(0n);
      await expect(contract.connect(issuer).revoke(1n)).to.be.revertedWithCustomError(contract, "AlreadyRevoked");
    });

    it("only an issuer can revoke", async function () {
      await contract.connect(issuer).issue(holder, hash);
      await expect(contract.connect(stranger).revoke(1n))
        .to.be.revertedWithCustomError(contract, "AccessControlUnauthorizedAccount");
    });
  });

  describe("Verificación pública (TS12)", function () {
    it("reports a non-existent certificate for an unknown or altered hash", async function () {
      const [exists, revoked, tokenId] = await contract.verify(ethers.keccak256(ethers.toUtf8Bytes("altered")));
      expect(exists).to.equal(false);
      expect(revoked).to.equal(false);
      expect(tokenId).to.equal(0n);
    });

    it("points tokenURI to the verification portal with the hash", async function () {
      await contract.connect(issuer).issue(holder, hash);
      expect(await contract.tokenURI(1n)).to.equal(BASE_URI + hash);
    });

    it("lets the admin rotate the issuer and the base URI", async function () {
      const role = await contract.ISSUER_ROLE();
      await contract.connect(admin).grantRole(role, stranger.address);
      await contract.connect(admin).revokeRole(role, issuer.address);
      await expect(contract.connect(issuer).issue(holder, hash))
        .to.be.revertedWithCustomError(contract, "AccessControlUnauthorizedAccount");
      await contract.connect(stranger).issue(holder, hash);
      await contract.connect(admin).setBaseURI("https://new.example/?hash=");
      expect(await contract.tokenURI(1n)).to.equal("https://new.example/?hash=" + hash);
    });
  });
});
