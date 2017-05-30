'use strict';

const Promise = require('bluebird');
const diskusage = require('diskusage');

const Monitor = require('./objects/monitor');

class DiskMonitor extends Monitor {
    constructor() {
        super('disk');
    }

    collect() {
        const diskInfo = diskusage.checkSync("/");

        const diskStatistics = [
            [`free`, diskInfo.available],
            [`total`, diskInfo.total]
        ];

        const allStatistics = [];

        for (let i = 0; i < diskStatisticsList.length; i++) {
            const diskStatistics = diskStatisticsList[i];

            Array.prototype.push.apply(allStatistics, diskStatistics);
        }

        this.setStatistics(allStatistics);
    }
}

module.exports = DiskMonitor;