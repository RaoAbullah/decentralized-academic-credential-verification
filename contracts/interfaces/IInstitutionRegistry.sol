// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title IInstitutionRegistry
 * @author MUET CS-491 Blockchain Technologies & Applications
 * @notice Interface defining governance and directory functions for accredited academic institutions.
 */
interface IInstitutionRegistry {
    enum InstitutionStatus {
        Inactive,
        Active,
        Suspended
    }

    struct Institution {
        string name;
        string accreditationCode;
        InstitutionStatus status;
        uint64 registeredAt;
    }

    event InstitutionRegistered(
        address indexed institutionAddress,
        string name,
        string accreditationCode,
        uint64 registeredAt
    );

    event InstitutionStatusUpdated(
        address indexed institutionAddress,
        InstitutionStatus oldStatus,
        InstitutionStatus newStatus,
        uint64 updatedAt
    );

    function isInstitutionActive(address institutionAddress) external view returns (bool);

    function getInstitution(address institutionAddress)
        external
        view
        returns (
            string memory name,
            string memory accreditationCode,
            InstitutionStatus status,
            uint64 registeredAt
        );
}
