// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { ICredentialRegistry } from "./interfaces/ICredentialRegistry.sol";
import { IInstitutionRegistry } from "./interfaces/IInstitutionRegistry.sol";

/**
 * @title CredentialRegistry
 * @author MUET CS-491 Blockchain Technologies & Applications
 * @notice Manages lifecycle and cryptographic hashes of academic credentials.
 * @dev Interacts with InstitutionRegistry to authorize issuing institutions.
 *      Stores zero student PII or wallet addresses on-chain to maximize privacy.
 */
contract CredentialRegistry is ICredentialRegistry, AccessControl, Pausable {
    uint256 public constant MAX_BATCH_SIZE = 100;

    IInstitutionRegistry public immutable INSTITUTION_REGISTRY;

    mapping(bytes32 => CredentialRecord) private _credentials;

    error ZeroAddressNotAllowed();
    error InvalidCredentialHash();
    error EmptyBatchArray();
    error BatchSizeExceeded(uint256 requested, uint256 maxAllowed);
    error UnauthorizedInstitution(address caller);
    error CredentialAlreadyExists(bytes32 credentialHash);
    error CredentialNotFound(bytes32 credentialHash);
    error CredentialAlreadyRevoked(bytes32 credentialHash);
    error NotCredentialIssuerOrAdmin(address caller, address actualIssuer);
    error EmptyRevocationReason();

    /**
     * @notice Initializes the CredentialRegistry linked to an InstitutionRegistry instance.
     * @param admin Deployer / regulator address granted DEFAULT_ADMIN_ROLE.
     * @param institutionRegistryAddress Contract address of the deployed InstitutionRegistry.
     */
    constructor(address admin, address institutionRegistryAddress) {
        if (admin == address(0) || institutionRegistryAddress == address(0)) {
            revert ZeroAddressNotAllowed();
        }
        INSTITUTION_REGISTRY = IInstitutionRegistry(institutionRegistryAddress);
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
    }

    /**
     * @notice Issues a single academic credential cryptographic hash.
     * @dev Cross-contract call: validates caller standing via IInstitutionRegistry.
     * @param credentialHash Blinded keccak256 hash of the canonical manifest + salt.
     */
    function issueCredential(bytes32 credentialHash)
        external
        override
        whenNotPaused
    {
        _issueSingle(credentialHash);
    }

    /**
     * @notice Batch issues multiple credential hashes in a single transaction to reduce gas costs.
     * @param credentialHashes Array of cryptographic hashes to anchor on-chain.
     */
    function batchIssueCredentials(bytes32[] calldata credentialHashes)
        external
        override
        whenNotPaused
    {
        uint256 count = credentialHashes.length;
        if (count == 0) {
            revert EmptyBatchArray();
        }
        if (count > MAX_BATCH_SIZE) {
            revert BatchSizeExceeded(count, MAX_BATCH_SIZE);
        }

        // Validate caller's institutional standing once per batch for gas efficiency
        if (!INSTITUTION_REGISTRY.isInstitutionActive(msg.sender)) {
            revert UnauthorizedInstitution(msg.sender);
        }

        uint64 currentTime = uint64(block.timestamp);
        for (uint256 i = 0; i < count; ) {
            bytes32 credHash = credentialHashes[i];
            if (credHash == bytes32(0)) {
                revert InvalidCredentialHash();
            }
            if (_credentials[credHash].issuedAt != 0) {
                revert CredentialAlreadyExists(credHash);
            }

            _credentials[credHash] = CredentialRecord({
                issuer: msg.sender,
                issuedAt: currentTime,
                isRevoked: false,
                revokedAt: 0
            });

            emit CredentialIssued(credHash, msg.sender, currentTime);

            unchecked {
                ++i;
            }
        }

        emit BatchCredentialsIssued(count, msg.sender, currentTime);
    }

    /**
     * @notice Revokes an academic credential (e.g., due to administrative disciplinary action).
     * @param credentialHash The hash of the credential to revoke.
     * @param reason The audit explanation for revocation.
     */
    function revokeCredential(bytes32 credentialHash, string calldata reason)
        external
        override
        whenNotPaused
    {
        if (bytes(reason).length == 0) {
            revert EmptyRevocationReason();
        }

        CredentialRecord storage record = _credentials[credentialHash];
        if (record.issuedAt == 0) {
            revert CredentialNotFound(credentialHash);
        }
        if (record.isRevoked) {
            revert CredentialAlreadyRevoked(credentialHash);
        }

        // Only the original issuing institution or consortium admin can revoke
        if (msg.sender != record.issuer && !hasRole(DEFAULT_ADMIN_ROLE, msg.sender)) {
            revert NotCredentialIssuerOrAdmin(msg.sender, record.issuer);
        }

        record.isRevoked = true;
        uint64 currentTime = uint64(block.timestamp);
        record.revokedAt = currentTime;

        emit CredentialRevoked(credentialHash, msg.sender, reason, currentTime);
    }

    /**
     * @notice Retrieves the on-chain record and lifecycle state for a given credential hash.
     * @param credentialHash The cryptographic hash to lookup.
     */
    function getCredential(bytes32 credentialHash)
        external
        view
        override
        returns (
            address issuer,
            uint64 issuedAt,
            bool isRevoked,
            uint64 revokedAt,
            CredentialState state
        )
    {
        CredentialRecord storage record = _credentials[credentialHash];
        if (record.issuedAt == 0) {
            return (address(0), 0, false, 0, CredentialState.NotFound);
        }
        if (record.isRevoked) {
            return (
                record.issuer,
                record.issuedAt,
                true,
                record.revokedAt,
                CredentialState.Revoked
            );
        }
        return (
            record.issuer,
            record.issuedAt,
            false,
            0,
            CredentialState.Issued
        );
    }

    /**
     * @dev Internal helper for issuing a single credential.
     */
    function _issueSingle(bytes32 credHash) internal {
        if (credHash == bytes32(0)) {
            revert InvalidCredentialHash();
        }
        if (!INSTITUTION_REGISTRY.isInstitutionActive(msg.sender)) {
            revert UnauthorizedInstitution(msg.sender);
        }
        if (_credentials[credHash].issuedAt != 0) {
            revert CredentialAlreadyExists(credHash);
        }

        uint64 currentTime = uint64(block.timestamp);
        _credentials[credHash] = CredentialRecord({
            issuer: msg.sender,
            issuedAt: currentTime,
            isRevoked: false,
            revokedAt: 0
        });

        emit CredentialIssued(credHash, msg.sender, currentTime);
    }

    /**
     * @notice Emergency circuit breaker pause.
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /**
     * @notice Resume credential operations after pause.
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}
