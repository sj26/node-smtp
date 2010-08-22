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
`smtp.createServer`

### smtp.createServer
