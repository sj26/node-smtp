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
		Out.out('220 ' + (self.hostname || 'hostname') + ' ESMTP node.js');
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
					socket.heloname = helodata.name
					Out.out('250 ' + (self.hostname || 'hostname.unconfigured'));
				} else {
					Out.out('550 Bad argument to HELO')
				}
			} else if(m = line.match(/^MAIL FROM:(.*)\s*/i)) {
				if(socket.sender) Out.out("503 We already got one, you see.")
				var sender = {address: m[1], valid: true}
				socket.emit('MAIL FROM', sender)
				if(sender.valid) {
					socket.sender = sender
					Out.out("250 MAIL FROM looks good enough for me.")
				} else {
					Out.out("550 Go Away, you silly English Knnnniiight")
				}
			} else if(m = line.match(/^RCPT TO:(.*)\s*/i)) {
				var recip = {address: m[1], valid: true}
				socket.emit('RCPT TO', recip)
				if(recip.valid) {
					socket.recipients.push(recip)
					Out.out("250 RCPT TO ...I hope that's right. I didn't check.)")
				} else {
					Out.out("550 We found a witch! May we burn her?")
				}
			} else if(line.match(/^DATA\s*$/i)) {
				socket.state = 'data';
				Out.out('354 Enter mail, end with "." on a line by itself');
				socket.currentMessage = new Message()
				socket.currentMessage.recipients = socket.recipients
				socket.currentMessage.sender = socket.sender
				socket.currentMessage.connection = socket
				socket.emit('DATA', socket.currentMessage)
			} else if(line.match(/^NOOP\s*$/i)) {
				Out.out('250 OK');
			} else if(line.match(/^QUIT\s*$/i)) {
				Out.out('221 Bye');
				In.destroy()
				socket.destroy()
			} else if(line.match(/^RSET\s*$/i)) {
				resetSMTPState(socket)
				Out.out('250 Reset OK');
			} else if(line.match(/^HELP\s*$/i)) {
				Out.out('214-Commands supported\r\n214 HELO MAIL RCPT DATA\r\n214 NOOP QUIT RSET HELP');
			} else if(line.match(/^EXPN\s+/i)) {
				Out.out('550 EXPN not available');
			} else if(line.match(/^(EHLO|SEND|SAML|SOML|TURN)\s*/i)) {
				Out.out('502 Unsupported here');
			} else if(line.match(/^VRFY\s+/i)) {
				Out.out('252 VRFY not available');
			} else {
				Out.out('500 Unrecognized command '+sys.inspect(line));
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
