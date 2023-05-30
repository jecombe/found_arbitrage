import Web3 from "web3";
import dotenv from "dotenv";
import ethers from "ethers";
import axios from "axios";
import { Telegraf } from "telegraf";
dotenv.config();

export default class {
  constructor() {
    this.bot = new Telegraf(process.env.BOT_TOKEN);
    this.launch();
  }

  launch() {
    this.bot.launch();
  }

  sendMessage(message) {
    this.bot.telegram.sendMessage(process.env.CHAT_ID, message);
  }
}
