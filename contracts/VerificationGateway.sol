// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { IVerificationGateway } from "./interfaces/IVerificationGateway.sol";
import { IInstitutionRegistry } from "./interfaces/IInstitutionRegistry.sol";
import { ICredentialRegistry } from "./interfaces/ICredentialRegistry.sol";

/**
 * @title VerificationGateway
 * @author MUET CS-491 Blockchain Technologies & Applications
 * @notice Unified gateway aggregating InstitutionRegistry and CredentialRegistry.
 * @dev Employs cross-contract queries to verify credentials.
 *      Default verification is read-only (zero gas, zero metadata leakage).
 */
contract VerificationGateway is IVerificationGateway {
    IInstitutionRegistry public immutable INSTITUTION_REGISTRY;
    ICredentialRegistry public immutable CREDENTIAL_REGISTRY;

    error ZeroAddressNotAllowed();

    /**
     * @notice Initializes the gateway with the addresses of both registries.
     * @param institutionRegistryAddress Address of the deployed InstitutionRegistry.
     * @param credentialRegistryAddress Address of the deployed CredentialRegistry.
     */
    constructor(
        address institutionRegistryAddress,
        address credentialRegistryAddress
    ) {
        if (
            institutionRegistryAddress == address(0) ||
            credentialRegistryAddress == address(0)
        ) {
            revert ZeroAddressNotAllowed();
        }
        INSTITUTION_REGISTRY = IInstitutionRegistry(institutionRegistryAddress);
        CREDENTIAL_REGISTRY = ICredentialRegistry(credentialRegistryAddress);
    }

    /**
     * @notice Read-only credential verification function.
     * @dev Zero-cost view function. Emits zero on-chain events to prevent profiling of
     *      student employment inquiries.
     * @param credentialHash The cryptographic hash computed off-chain from the degree manifest.
     * @return VerificationResult Full verification payload including institution accreditation standing.
     */
    function verifyCredential(bytes32 credentialHash)
        external
        view
        override
        returns (VerificationResult memory)
    {
        return _performVerification(credentialHash);
    }

    /**
     * @notice Optional state-modifying verification that generates an on-chain audit receipt.
     * @dev WARNING: Calling this function costs gas and logs `VerificationLogged` with msg.sender.
     *      Should only be used when official audit logging is legally or organizationally mandated.
     * @param credentialHash The cryptographic hash being audited.
     * @return VerificationResult The verification output.
     */
    function logVerificationReceipt(bytes32 credentialHash)
        external
        override
        returns (VerificationResult memory)
    {
        VerificationResult memory result = _performVerification(credentialHash);

        emit VerificationLogged(
            credentialHash,
            msg.sender,
            result.isValid,
            uint64(block.timestamp)
        );

        return result;
    }

    /**
     * @dev Internal cross-contract verification logic.
     */
    function _performVerification(bytes32 credentialHash)
        internal
        view
        returns (VerificationResult memory)
    {
        (
            address issuer,
            uint64 issuedAt,
            ,
            uint64 revokedAt,
            ICredentialRegistry.CredentialState state
        ) = CREDENTIAL_REGISTRY.getCredential(credentialHash);

        if (state == ICredentialRegistry.CredentialState.NotFound) {
            return
                VerificationResult({
                    isValid: false,
                    statusMessage: "Credential hash not found on ledger",
                    issuerAddress: address(0),
                    institutionName: "",
                    accreditationCode: "",
                    issuedAt: 0,
                    isRevoked: false,
                    revokedAt: 0
                });
        }

        (
            string memory name,
            string memory code,
            IInstitutionRegistry.InstitutionStatus instStatus,

        ) = INSTITUTION_REGISTRY.getInstitution(issuer);

        if (state == ICredentialRegistry.CredentialState.Revoked) {
            return
                VerificationResult({
                    isValid: false,
                    statusMessage: "Credential has been officially revoked",
                    issuerAddress: issuer,
                    institutionName: name,
                    accreditationCode: code,
                    issuedAt: issuedAt,
                    isRevoked: true,
                    revokedAt: revokedAt
                });
        }

        if (instStatus != IInstitutionRegistry.InstitutionStatus.Active) {
            return
                VerificationResult({
                    isValid: false,
                    statusMessage: "Credential exists but issuing institution is suspended or inactive",
                    issuerAddress: issuer,
                    institutionName: name,
                    accreditationCode: code,
                    issuedAt: issuedAt,
                    isRevoked: false,
                    revokedAt: 0
                });
        }

        return
            VerificationResult({
                isValid: true,
                statusMessage: "Credential is valid and issuing institution is accredited",
                issuerAddress: issuer,
                institutionName: name,
                accreditationCode: code,
                issuedAt: issuedAt,
                isRevoked: false,
                revokedAt: 0
            });
    }
}
