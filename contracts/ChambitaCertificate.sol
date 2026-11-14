// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import {ERC721} from "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import {AccessControl} from "@openzeppelin/contracts/access/AccessControl.sol";
import {Strings} from "@openzeppelin/contracts/utils/Strings.sol";

/// @notice Minimal soulbound interface (EIP-5192).
interface IERC5192 {
    event Locked(uint256 tokenId);
    event Unlocked(uint256 tokenId);

    function locked(uint256 tokenId) external view returns (bool);
}

/// @title Chambita experience certificates
/// @notice Non-transferable ERC-721 tokens. Each token stores only the certificate hash
///         and is minted to an address derived from the holder's pseudonymous id, so no
///         personal data is ever written on-chain.
contract ChambitaCertificate is ERC721, AccessControl, IERC5192 {
    bytes32 public constant ISSUER_ROLE = keccak256("ISSUER_ROLE");

    struct Certificate {
        bytes32 certificateHash;
        uint64 issuedAt;
        uint64 revokedAt;
    }

    uint256 private _nextTokenId = 1;
    string private _baseTokenURI;

    mapping(uint256 tokenId => Certificate) private _certificates;
    mapping(bytes32 certificateHash => uint256 tokenId) private _tokenIdByHash;

    event CertificateIssued(uint256 indexed tokenId, address indexed holder, bytes32 indexed certificateHash);
    event CertificateRevoked(uint256 indexed tokenId, bytes32 indexed certificateHash);

    error Soulbound();
    error EmptyHash();
    error HashAlreadyIssued(bytes32 certificateHash);
    error AlreadyRevoked(uint256 tokenId);

    constructor(address admin, address issuer, string memory baseTokenURI)
        ERC721("Chambita Experience Certificate", "CHAMBITA")
    {
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(ISSUER_ROLE, issuer);
        _baseTokenURI = baseTokenURI;
    }

    /// @notice Issues a certificate to the holder address derived from a pseudonymous id.
    function issue(address holder, bytes32 certificateHash) external onlyRole(ISSUER_ROLE) returns (uint256 tokenId) {
        if (certificateHash == bytes32(0)) revert EmptyHash();
        if (_tokenIdByHash[certificateHash] != 0) revert HashAlreadyIssued(certificateHash);

        tokenId = _nextTokenId++;
        _certificates[tokenId] = Certificate(certificateHash, uint64(block.timestamp), 0);
        _tokenIdByHash[certificateHash] = tokenId;
        _safeMint(holder, tokenId);

        emit CertificateIssued(tokenId, holder, certificateHash);
        emit Locked(tokenId);
    }

    /// @notice Revokes a certificate (proven fraud). The token stays, flagged as revoked.
    function revoke(uint256 tokenId) external onlyRole(ISSUER_ROLE) {
        _requireOwned(tokenId);
        Certificate storage certificate = _certificates[tokenId];
        if (certificate.revokedAt != 0) revert AlreadyRevoked(tokenId);
        certificate.revokedAt = uint64(block.timestamp);
        emit CertificateRevoked(tokenId, certificate.certificateHash);
    }

    /// @notice Public verification by certificate hash; used by the verification portal.
    function verify(bytes32 certificateHash)
        external
        view
        returns (bool exists, bool revoked, uint256 tokenId, address holder, uint64 issuedAt, uint64 revokedAt)
    {
        tokenId = _tokenIdByHash[certificateHash];
        if (tokenId == 0) {
            return (false, false, 0, address(0), 0, 0);
        }
        Certificate memory certificate = _certificates[tokenId];
        return (true, certificate.revokedAt != 0, tokenId, ownerOf(tokenId), certificate.issuedAt, certificate.revokedAt);
    }

    function certificateOf(uint256 tokenId) external view returns (Certificate memory) {
        _requireOwned(tokenId);
        return _certificates[tokenId];
    }

    function locked(uint256 tokenId) external view returns (bool) {
        _requireOwned(tokenId);
        return true;
    }

    function setBaseURI(string calldata baseTokenURI) external onlyRole(DEFAULT_ADMIN_ROLE) {
        _baseTokenURI = baseTokenURI;
    }

    /// @notice Points to the public verification portal, e.g. https://verify.example/?hash=0x...
    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireOwned(tokenId);
        return string.concat(_baseTokenURI, Strings.toHexString(uint256(_certificates[tokenId].certificateHash), 32));
    }

    function approve(address, uint256) public pure override {
        revert Soulbound();
    }

    function setApprovalForAll(address, bool) public pure override {
        revert Soulbound();
    }

    /// @dev Blocks every transfer and burn; only minting (from == address(0)) is allowed.
    function _update(address to, uint256 tokenId, address auth) internal override returns (address) {
        address from = _ownerOf(tokenId);
        if (from != address(0)) revert Soulbound();
        return super._update(to, tokenId, auth);
    }

    function supportsInterface(bytes4 interfaceId) public view override(ERC721, AccessControl) returns (bool) {
        return interfaceId == type(IERC5192).interfaceId || super.supportsInterface(interfaceId);
    }
}
