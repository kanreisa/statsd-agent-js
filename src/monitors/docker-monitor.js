'use strict';

const Promise = require('bluebird');
const childProcess = require('child_process');
const _ = require('underscore');

const Monitor = require('./objects/monitor');

class DockerMonitor extends Monitor {
    constructor() {
        super('docker');
    }

    collect() {
        const ps = childProcess.execSync("docker ps -q", {
            encoding: "utf8"
        });

        const count = ps.trim().split("\n").length;

        const stateCounts = {
            count: count
        };

        this.setStatistics(_.pairs(stateCounts));
    }
}

module.exports = DockerMonitor;