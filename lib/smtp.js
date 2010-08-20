/* License: See the COPYING file in this distribution.
	*
	* Copyright (c) 2010 Terry Riegel <riegel@clearimageonline.com>
	* Copyright (c) 2010 Aria Stewart <aredridel@nbtsc.org>
	*/

var net = require('net');
var sys = require('sys');

var left = function (str, n) {
	if (n <= 0) {return "";}
	if (n > String(str).length) {return this;}
	return String(str).substring(0,n);
}
var right = function(str, n) {
	if (n <= 0) {return "";}
	if (n > String(str).length) {return this;}
	return this.substr(str.length-n) ; 
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
	if(clientListener) this.addListener('client', clientListener);
	this.addListener('connection', connectionListener);
}
sys.inherits(Server, net.Server);

exports.Server = Server;

exports.createServer = function(clientListener) {
	return new Server(clientListener);
}

function connectionListener(stream) {
	var self = this;

	debug("new smtp connection");

	stream.setTimeout(2*60*1000); // 2 minute timeout
	stream.addListener('timeout', function () {
		stream.destroy();
	});

	stream.setEncoding('utf8');
	stream.out = function(a){
		stream.write(a+'\r\n');
		console.info('>'+a);
	}
	stream.on('connect', function () {
		stream.out('220 SMTP to HTTP Photo Emailer');
		stream.state='welcome';
	});
	stream.on('data', function (data) {
		// the incoming data may be multiple lines, not necessarily a single line at a time
		// this code assumes only one line at a time, so we spilt data initially then loop through it
		// The only reason to loop through it would be to replace any .. by itself on a line with a .
		// This seems like an edge case that may be ok if not implemented, and it would save the overhead
		// of going through each line of the body.
		//
		// Once I add code to parse the multi-part mime then I suppose I will have to traverse line by line
		//
		dataArray=data.split('\r\n');
		var i=0;
		for(i=0; i<dataArray.length-1; i=i+1) {

			console.info('#'+dataArray[i].trim());
			if (stream.state=='data') {
				if(dataArray[i].trim()=='.'){
					stream.out('250 Ok, dont know what to do with it'); stream.state='welcome';
				}
				// Ok body line recieved send it along :)
				// code to save to disk goes here hmm async I suppose 
				// body line end
			} else {
				data=dataArray[i].trim();
				var cmd = left(dataArray[i], 4).toUpperCase();
				var touch = false;
				if(cmd == 'HELO') {
					stream.out('250 mailer.youbelong.net');
					touch = true;
				}
				if(cmd == 'MAIL' && left(dataArray[i], 10).toUpperCase() == 'MAIL FROM:') {
					stream.out('250 MAIL...I hope thats right :)');
					touch = true;
				}
				if(cmd == 'RCPT' && left(dataArray[i], 8).toUpperCase()	== 'RCPT TO:') {
					stream.out('250 RCPT...I hope thats right :)'); touch = true;
				}
				if(cmd == 'DATA') {
					stream.state='data';
					stream.out('354 Enter mail, end with "." on a line by itself');
					touch = true;
				}
				if(cmd == 'NOOP') {
					stream.out('250 OK');
					touch = true;
				}
				if(cmd == 'QUIT') {
					stream.out('221 Bye'); stream.destroy();
					touch = true;
				}
				if(cmd == 'RSET') {
					stream.out('250 Reset OK');
					touch = true;
				}

				if(cmd == 'HELP') {
					stream.out('214-Commands supported\r\n214 HELO MAIL RCPT DATA\r\n214 NOOP QUIT RSET HELP');
					touch = true;
				}
				if(cmd == 'EXPN') {
					stream.out('550 EXPN not available');
					touch = true;
				}
				if(cmd == 'EHLO' || left(data, 4)=='SEND' || left(data, 4)=='SAML' || left(data, 4)=='SOML' | left(data, 4)=='TURN') {
					stream.out('502 Unsupported here');
					touch = true;
				}
				if(cmd == 'VRFY') {
					stream.out('252 VRFY not available');
					touch = true;
				}

				if(!touch) {
					stream.out('500 Unrecognized command');
				}
			}
		}
	});
	stream.on('end', function () {
		console.info(' Unexpected End, Terminating connection.');
		stream.destroy();
	});
}
