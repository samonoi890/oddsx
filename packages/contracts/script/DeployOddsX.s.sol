// SPDX-License-Identifier: MIT
// packages/contracts/script/DeployOddsX.s.sol
pragma solidity 0.8.30;

import {Script, console2} from "forge-std/Script.sol";
import {OddsX} from "../src/OddsX.sol";

contract DeployOddsX is Script {
    uint16 internal constant DEFAULT_FEE_BPS = 150;

    function run() external returns (OddsX oddsX) {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        address deployer = vm.addr(deployerPrivateKey);

        vm.startBroadcast(deployerPrivateKey);
        oddsX = new OddsX(deployer, DEFAULT_FEE_BPS);
        vm.stopBroadcast();

        console2.log("OddsX deployed at", address(oddsX));
        console2.log("Administrator", deployer);
        console2.log("Default fee basis points", DEFAULT_FEE_BPS);
    }
}
