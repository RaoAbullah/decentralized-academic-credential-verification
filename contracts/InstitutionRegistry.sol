// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

import { AccessControl } from "@openzeppelin/contracts/access/AccessControl.sol";
import { Pausable } from "@openzeppelin/contracts/utils/Pausable.sol";
import { IInstitutionRegistry } from "./interfaces/IInstitutionRegistry.sol";

/**
 * @title InstitutionRegistry
 * @author MUET CS-491 Blockchain Technologies & Applications
 * @notice Manages registration, accreditation codes, and operational status of academic institutions.
 * @dev Governed by HEC / consortium administrator using OpenZeppelin AccessControl.
 */
contract InstitutionRegistry is IInstitutionRegistry, AccessControl, Pausable {
    bytes32 public constant REGULATOR_ROLE = keccak256("REGULATOR_ROLE");

    mapping(address => Institution) private _institutions;

    error ZeroAddressNotAllowed();
    error EmptyStringNotAllowed();
    error InstitutionAlreadyRegistered(address institutionAddress);
    error InstitutionNotRegistered(address institutionAddress);
    error IdenticalStatusTransition();

    /**
     * @notice Initializes the registry and assigns initial governance roles to the deployer.
     * @param admin The address granted default admin and regulator capabilities.
     */
    constructor(address admin) {
        if (admin == address(0)) {
            revert ZeroAddressNotAllowed();
        }
        _grantRole(DEFAULT_ADMIN_ROLE, admin);
        _grantRole(REGULATOR_ROLE, admin);
    }

    /**
     * @notice Registers a recognized academic institution into the consortium registry.
     * @param institutionAddress The primary signing/issuing wallet address of the institution.
     * @param name The official name of the university (e.g., "Mehran University of Engineering and Technology").
     * @param accreditationCode Official accreditation or regulatory identifier (e.g., "PK-MUET-001").
     */
    function registerInstitution(
        address institutionAddress,
        string calldata name,
        string calldata accreditationCode
    ) external onlyRole(REGULATOR_ROLE) whenNotPaused {
        if (institutionAddress == address(0)) {
            revert ZeroAddressNotAllowed();
        }
        if (bytes(name).length == 0 || bytes(accreditationCode).length == 0) {
            revert EmptyStringNotAllowed();
        }
        if (_institutions[institutionAddress].registeredAt != 0) {
            revert InstitutionAlreadyRegistered(institutionAddress);
        }

        uint64 currentTime = uint64(block.timestamp);
        _institutions[institutionAddress] = Institution({
            name: name,
            accreditationCode: accreditationCode,
            status: InstitutionStatus.Active,
            registeredAt: currentTime
        });

        emit InstitutionRegistered(
            institutionAddress,
            name,
            accreditationCode,
            currentTime
        );
    }

    /**
     * @notice Updates the accreditation or operating status of an existing institution.
     * @param institutionAddress The address of the university being modified.
     * @param newStatus The updated operational status (Inactive, Active, or Suspended).
     */
    function updateInstitutionStatus(
        address institutionAddress,
        InstitutionStatus newStatus
    ) external onlyRole(REGULATOR_ROLE) whenNotPaused {
        Institution storage inst = _institutions[institutionAddress];
        if (inst.registeredAt == 0) {
            revert InstitutionNotRegistered(institutionAddress);
        }
        if (inst.status == newStatus) {
            revert IdenticalStatusTransition();
        }

        InstitutionStatus oldStatus = inst.status;
        inst.status = newStatus;

        emit InstitutionStatusUpdated(
            institutionAddress,
            oldStatus,
            newStatus,
            uint64(block.timestamp)
        );
    }

    /**
     * @notice Checks if an institution is registered and currently in Active standing.
     * @param institutionAddress The address to verify.
     * @return bool True if registered and status is Active.
     */
    function isInstitutionActive(address institutionAddress)
        external
        view
        override
        returns (bool)
    {
        return _institutions[institutionAddress].status == InstitutionStatus.Active;
    }

    /**
     * @notice Retrieves detailed institutional metadata.
     * @param institutionAddress The address to query.
     */
    function getInstitution(address institutionAddress)
        external
        view
        override
        returns (
            string memory name,
            string memory accreditationCode,
            InstitutionStatus status,
            uint64 registeredAt
        )
    {
        Institution storage inst = _institutions[institutionAddress];
        if (inst.registeredAt == 0) {
            revert InstitutionNotRegistered(institutionAddress);
        }
        return (
            inst.name,
            inst.accreditationCode,
            inst.status,
            inst.registeredAt
        );
    }

    /**
     * @notice Emergency circuit breaker pause.
     */
    function pause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _pause();
    }

    /**
     * @notice Resume registry operations after pause.
     */
    function unpause() external onlyRole(DEFAULT_ADMIN_ROLE) {
        _unpause();
    }
}
