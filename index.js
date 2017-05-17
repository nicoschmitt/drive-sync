require('dotenv').config({ silent: true });

const express = require('express');
const fs = require('fs');
const https = require('https');
const path = require('path');
const Datastore = require('nedb-promise');
// const request = require('request-promise');

const DriveSync = {};

const authDb = DriveSync.authDb = new Datastore({ filename: 'data/auth.db', autoload: true });
// const stateDb = DriveSync.stateDb = new Datastore({ filename: 'data/state.db', autoload: true });

var app = express();
const server = https.createServer({
    key: fs.readFileSync('./certs/dev.cert.key'),
    cert: fs.readFileSync('./certs/dev.cert.crt')
}, app);

server.listen(443, process.env.IP || '0.0.0.0', () => {
    var addr = server.address();
    console.log('Server listening at ', addr.address + ':' + addr.port);
});

app.use(express.static(path.resolve(__dirname, 'www')));

app.get('/config', async (req, res) => {
    const authOneDrive = await authDb.findOne({ type: 'onedrive' });
    if (authOneDrive) console.log('OneDrive refresh token: ' + authOneDrive.auth.refresh_token);

    const authAmzn = await authDb.findOne({ type: 'amazon' });
    if (authOneDrive) console.log('Amazon refresh token: ' + authOneDrive.auth.refresh_token);

    res.json({
        onedrive: {
            auth: authOneDrive != null,
        },
        amazon: {
            auth: authAmzn != null,
        }
    });
});
