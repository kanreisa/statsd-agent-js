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

        this.setStatistics(diskStatistics);
    }
}

module.exports = DiskMonitor;