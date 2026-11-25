// SPDX-License-Identifier: MIT
pragma solidity 0.8.24;

/**
 * @title CryptoTestHelper
 * @author MUET CS-491 Blockchain Technologies & Applications
 * @notice Test helper contract to formally verify that JavaScript off-chain Keccak-256
 *         and abi.encode commitment calculations match on-chain EVM execution identically.
 */
contract CryptoTestHelper {
    /**
     * @notice Computes native EVM keccak256 hash of raw bytes (payload hash).
     * @param data Canonical JSON UTF-8 payload bytes.
     * @return bytes32 The payload digest keccak256(data).
     */
    function computePayloadHash(bytes calldata data) external pure returns (bytes32) {
        return keccak256(data);
    }

    /**
     * @notice Computes standard ABI-encoded commitment hash: keccak256(abi.encode(payloadHash, salt)).
     * @dev Uses standard abi.encode (not ambiguous encodePacked) with two fixed bytes32 types.
     * @param payloadHash 32-byte Keccak-256 digest of canonical student data.
     * @param salt 32-byte (256-bit) cryptographically random salt.
     * @return bytes32 The final commitment credential hash anchored on-chain.
     */
    function computeCredentialHash(bytes32 payloadHash, bytes32 salt)
        external
        pure
        returns (bytes32)
    {
        return keccak256(abi.encode(payloadHash, salt));
    }

    /**
     * @notice Direct end-to-end calculation: keccak256(abi.encode(keccak256(data), salt)).
     * @param data Canonical JSON UTF-8 payload bytes.
     * @param salt 32-byte (256-bit) salt.
     * @return bytes32 The final commitment hash.
     */
    function computeFullCredentialHash(bytes calldata data, bytes32 salt)
        external
        pure
        returns (bytes32)
    {
        bytes32 payloadHash = keccak256(data);
        return keccak256(abi.encode(payloadHash, salt));
    }
}
