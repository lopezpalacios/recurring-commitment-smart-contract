// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract MyContract {

    string public ourString = "Hello World!";

    function updateOurString(string memory _updateString) public {
        ourString = _updateString;
        if(msg.value == 0.1 ether) {
            myString = _newString;
         }   else {
                payable(msg.sender).transfer(msg.value);
            }
        }
    }


