// SPDX-License-Identifier: MIT

/*
 * Created by masataka.eth (@masataka_net)
 */

pragma solidity >=0.7.0 <0.9.0;

interface IWalletFamily {
    // approve ----------------------------
    function approveChild(address _parent,bytes32 _nonce, bytes memory _signature) external;
    function deleteApprove(address _parent,address _child) external returns (bool);
    function getApproveList() external view returns(address[] memory);
    // fix ----------------------------
    function fixChild(address _child) external;
    function isChild(address _child) external view returns (bool);
    function isChildPair(address _parent, address _child) external view returns (bool);
    function getFixList(address _parent) external view returns (address[] memory);
    // VerifySignature ----------------------------
    function getMessageHash(address _child,address _parent,bytes32 _nonce) external pure returns (bytes32);
    function getEthSignedMessageHash(bytes32 _messageHash) external pure returns (bytes32);
    function isVerify(address _parent,bytes32 _nonce,bytes memory signature) external view returns (bool);
    function recoverSigner(bytes32 _ethSignedMessageHash, bytes memory _signature) external pure returns (address);
    function splitSignature(bytes memory sig) external pure returns (bytes32 r, bytes32 s,uint8 v);

}