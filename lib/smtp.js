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
		In.state = 'welcome';
	});
	In.on('data', function (line) {
		console.info('#'+line.trim());
		if (socket.state == 'data') {
			if(line.trim() == '.'){
				Out.out('250 Ok, dont know what to do with it');
				socket.state='welcome';
			}
			// Ok body line recieved send it along :)
			// code to save to disk goes here hmm async I suppose 
			// body line end
		} else {
			data=line.trim();
			var cmd = left(line, 4).toUpperCase();
			var touch = false;
			if(cmd == 'HELO') {
				Out.out('250 mailer.youbelong.net');
				touch = true;
			}
			if(cmd == 'MAIL' && left(line, 10).toUpperCase() == 'MAIL FROM:') {
				Out.out('250 MAIL...I hope thats right :)');
				touch = true;
			}
			if(cmd == 'RCPT' && left(line, 8).toUpperCase()	== 'RCPT TO:') {
				Out.out('250 RCPT...I hope thats right :)');
				touch = true;
			}
			if(cmd == 'DATA') {
				socket.state='data';
				Out.out('354 Enter mail, end with "." on a line by itself');
				touch = true;
			}
			if(cmd == 'NOOP') {
				Out.out('250 OK');
				touch = true;
			}
			if(cmd == 'QUIT') {
				Out.out('221 Bye');
				In.destroy()
				socket.destroy()
				touch = true;
			}
			if(cmd == 'RSET') {
				Out.out('250 Reset OK');
				touch = true;
			}

			if(cmd == 'HELP') {
				Out.out('214-Commands supported\r\n214 HELO MAIL RCPT DATA\r\n214 NOOP QUIT RSET HELP');
				touch = true;
			}
			if(cmd == 'EXPN') {
				Out.out('550 EXPN not available');
				touch = true;
			}
			if(cmd == 'EHLO' || left(data, 4)=='SEND' || left(data, 4)=='SAML' || left(data, 4)=='SOML' | left(data, 4)=='TURN') {
				Out.out('502 Unsupported here');
				touch = true;
			}
			if(cmd == 'VRFY') {
				Out.out('252 VRFY not available');
				touch = true;
			}

			if(!touch) {
				Out.out('500 Unrecognized command');
			}
		}
	});
	In.on('end', function () {
		console.info(' Unexpected End, Terminating connection.');
		socket.destroy();
	});
}
