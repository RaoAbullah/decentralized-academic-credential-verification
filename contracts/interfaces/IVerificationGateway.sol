// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title IVerificationGateway
 * @author MUET CS-491 Blockchain Technologies & Applications
 * @notice Interface for unified, read-only credential verification and optional audit logging.
 */
interface IVerificationGateway {
    struct VerificationResult {
        bool isValid;
        string statusMessage;
        address issuerAddress;
        string institutionName;
        string accreditationCode;
        uint64 issuedAt;
        bool isRevoked;
        uint64 revokedAt;
    }

    event VerificationLogged(
        bytes32 indexed credentialHash,
        address indexed verifier,
        bool isValid,
        uint64 timestamp
    );

    function verifyCredential(bytes32 credentialHash)
        external
        view
        returns (VerificationResult memory);

    function logVerificationReceipt(bytes32 credentialHash)
        external
        returns (VerificationResult memory);
}
