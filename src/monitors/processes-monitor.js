'use strict';

const Promise = require('bluebird');
const childProcess = require('child_process');
const _ = require('underscore');
const readline = require('readline');

const command = {
    cmd: 'ps',
    args: ['-ax']
};

const Monitor = require('./objects/monitor');

const isPlatformLinux = process.platform === 'linux';

const regexpPS = /[0-9]+ [^ ]+ +([DRSTWXZ])([<NLsl+]+) +[0-9]/;

const statusCodeTable = {
    D: "uninterruptible",
    R: "runnable",
    S: "sleeping",
    T: "stopped",
    W: "paging",
    X: "dead",
    Z: "zombie"
};

function getStateCounts() {
    return new Promise((resolve, reject) => {
        const proc = childProcess.spawn(command.cmd, command.args);

        proc.on('error', reject);

        const stateCounts = {};

        const lineReader = readline.createInterface({
            input: proc.stdout
        });

        lineReader.on('line', line => {
            const matches = line.match(regexpPS);
            if (!matches) {
                return;
            }
            const code = matches[1];
            const status = statusCodeTable[code];

            stateCounts[status] = (stateCounts[status] || 0) + 1;
        });

        proc.stdout.on('close', () => {
            resolve(stateCounts);
        });
    });
}

class ProcessesMonitor extends Monitor {
    constructor() {
        super('processes');
    }

    collect() {
        if (isPlatformLinux) {
            this.collectLinuxPlatform();
        }
    }

    collectLinuxPlatform() {
        getStateCounts()
            .then(stateCounts => {
                this.setStatistics(_.pairs(stateCounts));
            })
            .catchConsoleError();
    }
}

module.exports = ProcessesMonitor;