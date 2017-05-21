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

                this.setStatistics([
                    ..._.pairs(tcpStateCounts),
                    ["eth0.rx.bytes", rxBytes],
                    ["eth0.rx.packets", rxPackets],
                    ["eth0.tx.bytes", txBytes],
                    ["eth0.tx.packets", txPackets]
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