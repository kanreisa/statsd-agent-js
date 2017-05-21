'use strict';

const childProcess = require('child_process');
const fs = require("fs");
const _ = require('underscore');
const netstat = require('node-netstat');
const changeCase = require('change-case');
const socketStatisticsUtil = require('../utils/socket-statistics-util');

const Monitor = require('./objects/monitor');

const isPlatformLinux = process.platform === 'linux';

const regexpIfaceRxTx = / ([a-z0-9]+): +([0-9]+) +([0-9]+) +[0-9]+ +[0-9]+ +[0-9]+ +[0-9]+ +[0-9]+ +[0-9]+ +([0-9]+) +([0-9]+)/;

let lastRxBytes = -1;
let lastRxPackets = -1;
let lastTxBytes = -1;
let lastTxPackets = -1;
let lastTime = -1;

function getTraffics() {
    
    const netdev = fs.readFileSync("/proc/net/dev", {
        encoding: "utf8",
        flag: "r"
    });

    const [, rxBytes, rxPackets, txBytes, txPackets] = netdev.split("\n").slice(2, -1).map(line => {
        const parts = line.match(regexpIfaceRxTx);
        if (parts) {
            return parts.slice(1);
        } else {
            return [""];
        }
    }).filter(line => line[0] === "eth0")[0];

    if (lastRxBytes === -1) {
        lastRxBytes = rxBytes;
        lastRxPackets = rxPackets;
        lastTxBytes = txBytes;
        lastTxPackets = txPackets;
        lastTime = Date.now();

        return [0, 0, 0, 0];
    }

    const elapsedSec = (Date.now() - lastTime) / 1000;

    const ret = [
        (rxBytes - lastRxBytes) * 8 / elapsedSec, // bps
        (rxPackets - lastRxPackets) / elapsedSec, // pps
        (txBytes - lastTxBytes) * 8 / elapsedSec,
        (txPackets - lastTxPackets) / elapsedSec
    ];

    lastRxBytes = rxBytes;
    lastRxPackets = rxPackets;
    lastTxBytes = txBytes;
    lastTxPackets = txPackets;
    lastTime = Date.now();

    return ret;
}

class NetworkMonitor extends Monitor {
    constructor() {
        super('network');

        this.connectionsStatesCountStatsd = {};
    }

    collect() {
        if (isPlatformLinux) {
            this.collectLinuxPlatform();
        } else {
            this.collectOtherPlatform();
        }
    }

    collectLinuxPlatform() {
        socketStatisticsUtil
            .getTcpStateCounts()
            .then(tcpStateCounts => {
                const [rxBPS, rxPPS, txBPS, txPPS] = getTraffics();
                this.setStatistics([
                    ..._.pairs(tcpStateCounts),
                    ["eth0.rx.bps", rxBPS],
                    ["eth0.rx.pps", rxPPS],
                    ["eth0.tx.bps", txBPS],
                    ["eth0.tx.pps", txPPS]
                ]);
            })
            .catchConsoleError();
    }

    collectOtherPlatform() {
        const connections = [];

        netstat({
            filter: {
                protocol: 'tcp'
            },
            done: () => {
                const fullConnectionsStatesCount = this.getStatistics(connections);

                this.setStatistics(fullConnectionsStatesCount);
            }
        }, (connection) => connections.push(connection));
    }

    getStatistics(connections) {
        const connectionsStatesCount = _.countBy(connections, 'state');

        for (let connectionState in connectionsStatesCount) {
            this.connectionsStatesCountStatsd[changeCase.snakeCase(connectionState)] =
                connectionsStatesCount[connectionState];
        }

        return _.pairs(this.connectionsStatesCountStatsd);
    }
}

module.exports = NetworkMonitor;