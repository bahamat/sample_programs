#!/usr/bin/env node

/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at https://mozilla.org/MPL/2.0/. */

/*
 * Copyright 2021 Brian Bennett
 */

'use strict';

var bunyan = require('bunyan');
var dashdash = require('dashdash');
var net = require('net');
var path = require('path');

var progname = path.basename(process.argv[1]);

var options = [
    {
        // Print lots
        names: ['debug'],
        type: 'bool',
        help: 'Print lots of debugging info',
        env: 'TRACE',
        hidden: true
    },
    {
        // Server mode
        names: ['l'],
        type: 'bool',
        help: 'Listen mode, for inbound connects'
    },
    {
        // UDP
        names: ['u'],
        type: 'bool',
        help: 'UDP mode',
        hidden: true // Not implemented yet
    },
    {
        // UNIX socket
        names: ['U'],
        type: 'bool',
        help: 'Use UNIX domain socket',
        hidden: true // Not implemented yet
    },
    {
        names: ['help', 'h'],
        type: 'bool',
        help: 'This help text'
    }
];

var parser = dashdash.createParser({options: options});

var do_help = function (x) {
    var help = parser.help({includeEnv: true}).trimRight();
    console.log('usage: ' + progname + ' [OPTIONS]\n'
                + 'options:\n'
                + help);
    process.exit(x || 0);
};

/*
 * Connection listener. Both client and server will pass the connection
 * to this function for local I/O.
 */
var cl = function (c, log) {
    log.debug({connection: c}, 'Socket connected');
    c.on('data', function (data) {
        log.debug(data, 'Received data');
        process.stdout.write(data.toString());
    });
    c.on('end', function () {
        log.debug('Socket disconnected');
        process.exit(0);
    });
    process.stdin.on('readable', function () {
        var chunk;
        /*jslint ass: true*/
        while ((chunk = process.stdin.read()) !== null) {
            c.write(chunk);
        }
        /*jslint ass: true*/
    });
    process.stdin.on('end', function () {
        c.end();
        process.exit(0);
    });
};

try {
    var opts = parser.parse(process.argv);
} catch (e) {
    console.error('nc: error: %s', e.message);
    do_help(1);
}

var logLevel;
if (opts.debug) {
    logLevel = 'trace';
} else {
    logLevel = 'info';
}
var log = bunyan.createLogger({
    name: 'nc',
    level: logLevel,
    src: true
});

log.debug("# opts:", opts);
/*jslint nomen: true*/
log.debug("# args:", opts._args);
/*jslint nomen: false*/

if (opts.help) {
    do_help();
}

var do_server = function (opts, log) {
    var port, server;

    // netcat does service name lookup in /etc/services.
    // Does node support that kind of thing?
    /*jslint nomen: true*/
    if (opts._args.length < 1) {
        /*jslint nomen: false*/
        console.log('Port number required to listen');
        do_help(1);
    }

    /*jslint nomen: true*/
    port = parseInt(opts._args[0], 10);
    /*jslint nomen: false*/

    if (isNaN(port)) {
        console.log('port must be a number');
        process.exit(1);
    }
    log.debug('ok, will listen on port ' + port);

    server = new net.createServer(function (c) {
        // Call the connection listener
        cl(c, log);
    });

    server.listen(port);
    server.on('err', function (err) {
        log.error({err: err}, 'Error!');
        throw err;
    });
};

var do_client = function (opts, log) {
    var host, port;
    if (opts._args.length < 2) {
        console.log(progname + ': missing hostname and port');
        do_help(1);
    };
    host = opts._args[0];
    port = opts._args[1];

    var client = net.createConnection({
        host: host,
        port: port
    }, function() {
        log.debug('Connected to server');
    });
    // Call the connection listener
    cl(client, log);
};

if (opts.l) {
    do_server(opts, log);
} else {
    do_client(opts, log);
}
