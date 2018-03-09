pragma solidity ^0.4.18;

import "./ERC20Basic.sol";

// https://github.com/OpenZeppelin/zeppelin-solidity/blob/c5d66183abcb63a90a2528b8333b2b17067629fc/contracts/token/ERC20/ERC20.sol
/**
 * @title ERC20 interface
 * @dev see https://github.com/ethereum/EIPs/issues/20
 */
contract ERC20 is ERC20Basic {
  function allowance(address owner, address spender) public view returns (uint256);
  function transferFrom(address from, address to, uint256 value) public returns (bool);
  function approve(address spender, uint256 value) public returns (bool);
  event Approval(address indexed owner, address indexed spender, uint256 value);
}
