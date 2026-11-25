// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title ICredentialRegistry
 * @author MUET CS-491 Blockchain Technologies & Applications
 * @notice Interface managing academic credential hash anchoring and lifecycle states.
 * @dev Preserves student privacy: stores zero personal identifiable information (PII) or student wallet addresses.
 */
interface ICredentialRegistry {
    enum CredentialState {
        NotFound,
        Issued,
        Revoked
    }

    struct CredentialRecord {
        address issuer;
        uint64 issuedAt;
        bool isRevoked;
        uint64 revokedAt;
    }

    event CredentialIssued(
        bytes32 indexed credentialHash,
        address indexed issuer,
        uint64 issuedAt
    );

    event CredentialRevoked(
        bytes32 indexed credentialHash,
        address indexed revoker,
        string reason,
        uint64 revokedAt
    );

    event BatchCredentialsIssued(
        uint256 count,
        address indexed issuer,
        uint64 issuedAt
    );

    function issueCredential(bytes32 credentialHash) external;

    function batchIssueCredentials(bytes32[] calldata credentialHashes) external;

    function revokeCredential(bytes32 credentialHash, string calldata reason) external;

    function getCredential(bytes32 credentialHash)
        external
        view
        returns (
            address issuer,
            uint64 issuedAt,
            bool isRevoked,
            uint64 revokedAt,
            CredentialState state
        );
}
