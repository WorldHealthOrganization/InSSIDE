const path = require('path');
const { workerData } = require('worker_threads');
require('ts-node').register();
console.log(path.resolve(__dirname, workerData.path));
require(path.resolve(__dirname, workerData.path));
