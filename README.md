# 🚀 Bybit AI Manager (DCA Trading Bot)

An automated cryptocurrency trading script designed to execute a Dollar Cost Averaging (DCA) strategy on the Bybit exchange. Built to minimize market exposure risks and optimize entry points through automated grid order management.

## ⚙️ Key Features

*   **Algorithmic DCA Execution:** Automatically manages grid orders (ranging from 10 to 25 USDT) based on predefined market conditions.
*   **Proxy Bypass & Security:** Implemented custom network routing (proxy bypass) to ensure stable and uninterrupted connection to the Bybit API.
*   **Automated Trade Cycles:** Operates autonomously, monitoring live trade cycles on the Bybit Testnet.
*   **Risk Management:** Logic backtested against historical Bitcoin price shifts to evaluate safety variables.

## 🛠 Tech Stack

*   **Backend:** Node.js / JavaScript (Handling API requests & asynchronous logic)
*   **Data Processing & Algorithms:** Python
*   **Integration:** Bybit REST API

## 💡 Architecture Overview

The system consists of a Python-based analytical core that processes historical and live market data, and a JavaScript/Node.js engine that interacts securely with the Bybit API to execute grid orders without manual intervention.
