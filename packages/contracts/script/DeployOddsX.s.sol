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
        address administrator = vm.envOr("ODDSX_ADMIN", deployer);
        uint256 configuredResolutionDelay = vm.envOr("ODDSX_RESOLUTION_DELAY", uint256(0));
        require(configuredResolutionDelay <= type(uint64).max, "Resolution delay exceeds uint64");

        vm.startBroadcast(deployerPrivateKey);
        // Safe because configuredResolutionDelay is bounded to uint64 above.
        // forge-lint: disable-next-line(unsafe-typecast)
        oddsX = new OddsX(administrator, DEFAULT_FEE_BPS, uint64(configuredResolutionDelay));
        vm.stopBroadcast();

        console2.log("OddsX deployed at", address(oddsX));
        console2.log("Administrator", administrator);
        console2.log("Default fee basis points", DEFAULT_FEE_BPS);
        console2.log("Default resolution delay", configuredResolutionDelay);
    }
}
