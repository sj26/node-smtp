smtp.Server -- SMTP server (and soon, client) library and daemon for node.js
============================================================================

## Synopsis

An example of an SMTP server written with Node which dumps to the console
any mail sent to it:

    var smtp = require('smtp')

    smtp.createServer(function(connection) {
        connection.on('DATA', function(message) {
           console.log('Message from ' + message.sender)
           message.on('data', function(data) {
              console.log("DATA: " + data)
           })
           message.on('end', function() {
              console.log('EOT')
           })      
        })
    }).listen(25)

    console.log("SMTP server running on port 25")

## smtp.Server

Ths main SMTP server constructor. Usually instantiated with
`'smtp.createServer'`

### Event: 'connection'

`function(connection) { }`

Emitted when each client connects

### smtp.createServer([callback])

The `'callback'` parameter will be passed each new connection

## smtp.Connection

This object is created internally and returned from the `'connection'`
callback.

It is an EventEmitter that implements the `Readable Stream` interface, as
well as the following events:

### Event: 'HELO' and 'EHLO'

`function(helodata) {}`

Emitted when a client sends the `'HELO'` or `'EHLO'` commands.

The `'helodata'` object has the following properties:

* `'heloname'`, the argument given to the command
* `'valid'`, whether or not the command will be accepted. Can be set to
  false to reject the helo name.
* `'extended'`, true if the client is using ESMTP

### Event: 'MAIL FROM'

`function(sender) {}`

Emitted when a sender is specified by the client.

The `'sender'` object has the following properties:

* `'address'`, the SMTP address specified
* `'valid'`, whether the address will be accepted. Can be set to false to
  reject a sender.

### Event: 'RCPT TO'

`function(recipient) {}`

Emitted for each recipient the client specifies.

The `'recipient'` object has the following properties:

* `'address'`, the SMTP address specified
* `'valid'`, whether the address will be accepted. Can be set to false to
  reject a sender.

### Event: 'DATA'

`function(message) {}`

Emitted when the client begins sending message data.

The `'message'` object has the following properties:

* `'sender'`, the SMTP sender object
* `'receivers'`, an array of SMTP receiver objects
* `'connection'`, the `'smtp.Connection'` object

It implements the `Readable Stream` interface.
