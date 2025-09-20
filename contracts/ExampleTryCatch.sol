// SPDX-License-Identifier: MIT
pragma solidity 0.8.15;


contract WillThrow {
    
    error NotAllowedError(string);
    function aFunction() public pure {
        //require(false,"Error Message");
        //assert(false);
    }
}

contract ErrorHandling {
    event ErrorLogging(string reason);
    event ErrorLogCode(uint code);
    event ErrorLogBytes(bytes lowlevelData);
    function catchTheError() public {
        WillThrow will = new WillThrow();
        try will.aFunction(){
            // add code here if it works
        } catch Error (string memory reason){
            emit ErrorLogging(reason);
        } catch Panic(uint errorcode){
            emit ErrorLogCode(errorcode);
        } catch(bytes memory lowLevelData){
            emit ErrorLogBytes(lowLevelData);
        }
    }
}