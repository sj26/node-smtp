/* License: See the COPYING file in this distribution.
 *
 * Copyright (c) 2010 Terry Riegel <riegel@clearimageonline.com>
 * Copyright (c) 2010 Aria Stewart <aredridel@nbtsc.org>
 */

var net = require('net');
var events = require('events')
var sys = require('sys');
var linebuffer = require('linebuffer');

var left = function (str, n) {
	if (n <= 0) {return "";}
	if (n > String(str).length) {return this;}
	return String(str).substring(0,n);
}

function Message() {
	events.EventEmitter.call(this)
}
sys.inherits(Message, events.EventEmitter)

var debug;
var debugLevel = parseInt(process.env.NODE_DEBUG, 16);
if (debugLevel & 0x4) {
	debug = function (x) { sys.error('SMTP: ' + x); };
} else {
	debug = function () { };
}

function Server(clientListener) {
	net.Server.call(this);
	this.allowPipelining = true
	this.hostname = 'hostname.unconfigured'
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
		Out.out('220 ' + self.hostname + ' ESMTP node.js');
		socket.state = 'welcome';
		resetSMTPState(socket)
	});
	In.on('data', function (line) {
		console.info('#'+line.trim());
		if (socket.state == 'data') {
			if(line.match(/^\./)) {
				socket.state = 'welcome'
				socket.currentMessage.emit('end')
				if(socket.currentMessage.accepted) {
					Out.out("250 Ok, but I don't know what to do with the message")
				} else {
					Out.out("421 Something went wrong")
				}
			} else {
				socket.currentMessage.emit('data', line)
			}
		} else {
			var m
			line = line.trimRight()
			if(m = line.match(/^(HELO|EHLO)\s+(.*)/i)) {
				var helodata = {name: m[2], valid: true, extended: m[1] == 'EHLO' }
				socket.emit(m[1], helodata)
				if(helodata.valid) {
					socket.helo = helodata
					if(helodata.extended) {
						Out.out('250-' + self.hostname)
						if(socket.maxSize) Out.out("250-SIZE " + socket.maxsize")
						if(socket.allowPipelining) Out.out("250-PIPELINING")
						if(socket.authMethods) Out.out("250-AUTH "+socket.authMethods.join(' '))
						Out.out('250 HELP')
					} else {
						Out.out('250 ' + self.hostname)
					}
				} else {
					Out.out('550 Bad argument to HELO')
				}
			} else if(m = line.match(/^MAIL FROM:\s*(.*)\s*/i)) {
				if(socket.sender) Out.out("503 We already got one, you see.")
				var sender = {address: m[1], valid: true}
				socket.emit('MAIL FROM', sender)
				if(sender.valid) {
					socket.sender = sender
					Out.out("250 MAIL FROM looks good enough for me.")
				} else {
					Out.out("550 Go Away, you silly English Knnnniiight")
				}
			} else if(m = line.match(/^RCPT TO:\s*(.*)\s*/i)) {
				var recip = {address: m[1], valid: true}
				socket.emit('RCPT TO', recip)
				if(recip.valid) {
					socket.recipients.push(recip)
					Out.out("250 RCPT TO ...I hope that's right. I didn't check.)")
				} else {
					Out.out("550 We found a witch! May we burn her?")
				}
			} else if(line.match(/^DATA\b/i)) {
				socket.state = 'data';
				Out.out('354 Enter mail, end with "." on a line by itself');
				socket.currentMessage = new Message()
				socket.currentMessage.recipients = socket.recipients
				socket.currentMessage.sender = socket.sender
				socket.currentMessage.connection = socket
				socket.emit('DATA', socket.currentMessage)
			} else if(line.match(/^NOOP\b/i)) {
				Out.out('250 OK');
			} else if(line.match(/^QUIT\b/i)) {
				socket.emit('QUIT')
				Out.out('221 Go away, you silly English pig-dog types');
				In.destroy()
				socket.destroy()
			} else if(line.match(/^RSET\b/i)) {
				socket.emit('RSET')
				resetSMTPState(socket)
				Out.out('250 Reset OK');
			} else if(line.match(/^HELP\b/i)) {
				Out.out('214-Commands supported\r\n214 HELO MAIL RCPT DATA\r\n214 NOOP QUIT RSET HELP');
			} else if(line.match(/^EXPN\b/i)) {
				socket.emit('EXPN')
				Out.out('550 EXPN not available');
			} else if(line.match(/^(EHLO|SEND|SAML|SOML|TURN)\b/i)) {
				Out.out('502 Unsupported here');
			} else if(line.match(/^VRFY\b/i)) {
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

function resetSMTPState(socket) {
	socket.recipients = []
	socket.sender = null
	socket.currentMessage = null
	socket.heloname = null
}
