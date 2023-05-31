import Web3 from "web3";
import dotenv from "dotenv";
import ethers from "ethers";
import axios from "axios";
import { Telegraf } from "telegraf";
dotenv.config();

export default class {
  constructor(arbitrage) {
    this.bot = new Telegraf(process.env.BOT_TOKEN);
    this.arbitrage = arbitrage;
    this.launch();
  }

  listenCommand() {
    this.bot.command("stop", () => {
      this.arbitrage.stop();
    });
    this.bot.command("executions", (cxt) => {
      cxt.reply(JSON.stringify(this.arbitrage.executions));
    });
  }

  launch() {
    this.bot.launch();
    this.listenCommand();
  }

  sendMessage(message) {
    this.bot.telegram.sendMessage(process.env.CHAT_ID, message);
  }
}
