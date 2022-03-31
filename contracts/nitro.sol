//SPDX-License-Identifier: Unlicense
pragma solidity 0.8.7;

import "hardhat/console.sol";

contract NitroTest {
    constructor(){
    }
    function foo() external{
    }
}

contract SuicideTo {
    constructor(address payable _to) payable{
        selfdestruct(_to);
    }
}

contract CreateTwo {
    function create2(bytes32 _salt) external{
        address payable _to = payable(address(this));
        SuicideTo newContract = new SuicideTo{salt: _salt}(_to);
        bytes memory bytecode = abi.encodePacked(type(SuicideTo).creationCode, abi.encode(_to));
        bytes32 hash = keccak256(
            abi.encodePacked(bytes1(0xff), address(this), _salt, keccak256(bytecode))
        );
        require(address(newContract) == address(uint160(uint(hash))), "address unexpected");
    }
}

contract StorageSpam {
    uint256[] public data;
    function spam(uint x) external{
        for(uint256 i; i < x;){
            data.push(i);
            unchecked {
                ++i;
            }    
        }
        
    }
}

contract ECRecover {
    function recover(bytes32 msgHash, uint8 v, bytes32 r, bytes32 s) external pure returns (address) {
        return ecrecover(msgHash, v, r, s);
    }
}