/* License: See the COPYING file in this distribution.
 *
 * Copyright (c) 2010 Terry Riegel <riegel@clearimageonline.com>
 * Copyright (c) 2010 Aria Stewart <aredridel@nbtsc.org>
 */

var net = require('net');
var sys = require('sys');
var linebuffer = require('linebuffer');

var left = function (str, n) {
	if (n <= 0) {return "";}
	if (n > String(str).length) {return this;}
	return String(str).substring(0,n);
}

var debug;
var debugLevel = parseInt(process.env.NODE_DEBUG, 16);
if (debugLevel & 0x4) {
	debug = function (x) { sys.error('SMTP: ' + x); };
} else {
	debug = function () { };
}

function Server(clientListener) {
	net.Server.call(this);
	this.addListener('connection', connectionListener);
	if(clientListener) this.addListener('connection', clientListener);
}
sys.inherits(Server, net.Server);

exports.Server = Server;

exports.createServer = function(clientListener) {
	return new Server(clientListener);
}

function connectionListener(socket) {
	var In = new linebuffer.LineBuffer()
	var Out = socket
	sys.pump(socket, In)
	var self = this

	debug("new smtp connection");

	socket.setTimeout(2*60*1000); // 2 minute timeout
	socket.addListener('timeout', function () {
		socket.destroy();
	});

	In.setEncoding('utf8');
	Out.out = function(a){
		Out.write(a+'\r\n');
		console.info('>'+a);
	}
	socket.on('connect', function () {
		Out.out('220 ' + (this.hostname || 'hostname') + ' ESMTP node.js');
		socket.state = 'welcome';
	});
	In.on('data', function (line) {
		console.info('#'+line.trim());
		if (socket.state == 'data') {
			if(line.match(/^\.$/)) {
				socket.emit('message', 'will be here in the future')
				Out.out("250 Ok, but I don't know what to do with the message")
				socket.state = 'welcome';
			}
			// Ok body line recieved send it along :)
			// code to save to disk goes here hmm async I suppose 
			// body line end
		} else {
			var m
			if(line.match(/^HELO /i)) {
				Out.out('250 ' + (this.hostname || 'hostname.unconfigured'));
			} else if(m = line.match(/^MAIL FROM:(.*)/i)) {
				socket.emit('mailFrom', {address: m[1]})
				Out.out("250 MAIL...I hope that's right. I didn't check.")
			} else if(m = line.match(/^RCPT TO:(.*)/i)) {
				socket.emit('rcptTo', {address: m[1]})
				Out.out("250 RCPT...I hope that's right. I didn't check.)")
			} else if(line.match(/^DATA$/i)) {
				socket.state = 'data';
				Out.out('354 Enter mail, end with "." on a line by itself');
			} else if(line.match(/^NOOP$/i)) {
				Out.out('250 OK');
			} else if(line.match(/^QUIT$/i)) {
				Out.out('221 Bye');
				In.destroy()
				socket.destroy()
			} else if(line.match(/^RSET$/i)) {
				Out.out('250 Reset OK');
			} else if(line.match(/^HELP$/i)) {
				Out.out('214-Commands supported\r\n214 HELO MAIL RCPT DATA\r\n214 NOOP QUIT RSET HELP');
			} else if(line.match(/^EXPN /i)) {
				Out.out('550 EXPN not available');
			} else if(line.match(/^(EHLO|SEND|SAML|SOML|TURN)/i)) {
				Out.out('502 Unsupported here');
			} else if(line.match(/^VRFY /i)) {
				Out.out('252 VRFY not available');
			} else {
				Out.out('500 Unrecognized command');
			}
		}
	});
	In.on('end', function () {
		console.info(' Unexpected End, Terminating connection.');
		socket.destroy();
	});
}
