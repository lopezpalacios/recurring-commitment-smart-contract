// SPDX-License-Identifier: MIT
pragma solidity 0.8.15;

contract ExampleExceptionRequire {

    mapping(address => uint8) public balanceReceived;

    function receiveMoney() public payable {
        assert(msg.value == uint8(msg.value));
        balanceReceived[msg.sender] += uint8(msg.value);


    }

    function withdrawMoney(address payable _to, uint _amount) public {
        require(_amount <= balanceReceived[msg.sender], "Not enough funds, aborting!");
            balanceReceived[msg.sender] -= uint8(_amount);
            _to.transfer(_amount);
        
    }
}