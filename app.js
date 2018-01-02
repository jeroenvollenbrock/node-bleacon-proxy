"use strict";

const Bleacon = require('bleacon');

const net = require('net');
const dgram = require('dgram');
const os = require('os');
const fs = require('fs');

const PORT = 1337;


function getIdentifier() {
    const adapter = Object.values(os.networkInterfaces())
        .reduce((a,b) => a.concat(b))
        .filter(net => !net.internal && net.mac)
        .shift();
    if(adapter && adapter.mac) return adapter.mac;
    try {
        return fs.readFileSync('/sys/class/net/wlan0/address', {encoding:'utf8'});
    } catch(e) {}
    
    try {
        return fs.readFileSync('/etc/machine-id', {encoding:'utf8'});
    } catch(e) {}
}
const monitorID = getIdentifier()
        .replace(/:|\-/g, '')
        .toUpperCase();
        
const name = os.hostname();

console.log('Monitor ID:', monitorID);
console.log('Monitor Name:', name);


//beacon server
const server = net.createServer((socket) => {
    function onDiscover(bleacon) {
        socket.write(JSON.stringify(bleacon)+'\n');
    }
    console.log('Client Connected...', socket.remoteAddress);
    Bleacon.on('discover', onDiscover);
    socket.on('close', () => Bleacon.removeListener('discover', onDiscover));
    socket.on('error', () => Bleacon.removeListener('discover', onDiscover))
    socket.on('data', (data) => {});
    Bleacon.startScanning();
});

server.listen(PORT);





const client = dgram.createSocket('udp4');
client.on('listening', () => {
    console.log('Discovery service listening...');
    client.setBroadcast(true);
    client.unref();
});

client.on('message', (message, rinfo) => {
    try {
        message = JSON.parse(message);
        if(message.type !== 'bleacon-discover') return;
        console.log('Discovery Message from: ' + rinfo.address + ':' + rinfo.port +' - ' + message);
        client.send(JSON.stringify({
            name: name,
            id: monitorID,
            port: PORT,
            type: 'bleacon-discover'
        }), rinfo.port, rinfo.address);
    } catch(e) {}
});

client.on('error', (err) => {
    console.error(err);
});

client.bind(PORT);