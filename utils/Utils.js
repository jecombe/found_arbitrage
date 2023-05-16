import Web3 from "web3";
import dotenv from 'dotenv';
import { ethers } from 'ethers';

dotenv.config();

export default class {
    constructor() {
        this.web3 = new Web3;

    }

    getProvider() {
      //  return new ethers.JsonRpcProvider(process.env.PROVIDER);
        return new Web3.providers.HttpProvider(process.env.PROVIDER);
    }
    
    encodeAbi(model, orderPayload) {
        return this.web3.eth.abi.encodeParameter(model, orderPayload);
    }

    getBigNumber(value) {
       return ethers.BigNumber.from(value).toString();
    }

    getAddr(addr) {
        return ethers.utils.getAddress(addr);
    }

    convertToEth(number) {
        return Number(ethers.utils.formatUnits(`${number}`, 18)).toFixed(4);
    }
}