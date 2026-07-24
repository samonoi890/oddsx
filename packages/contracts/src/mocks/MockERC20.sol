// SPDX-License-Identifier: MIT
// packages/contracts/src/mocks/MockERC20.sol
pragma solidity 0.8.30;

import {ERC20} from "@openzeppelin/contracts/token/ERC20/ERC20.sol";

contract MockERC20 is ERC20 {
    constructor() ERC20("OddsX Test Token", "OXT") {}

    function mint(address recipient, uint256 amount) external {
        _mint(recipient, amount);
    }
}
