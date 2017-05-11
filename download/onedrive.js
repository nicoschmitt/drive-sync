require('dotenv').config({ silent: true });

const _ = require('lodash');
const fs = require('mz/fs');
const Datastore = require('nedb-promise');
const request = require('request-promise');

const authDb = new Datastore({ filename: 'data/auth.db', autoload: true });

async function getAccessToken(refreshToken) {
    const url = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
    const data = {
        client_id: process.env.MS_APP_ID,
        redirect_uri: process.env.MS_REDIRECT_URL,
        client_secret: process.env.MS_APP_SECRET,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
    };
    const token = await request.post({ url: url, form: data, json: true });
    return token.access_token;
}

async function getFolder(token, path) {
    path = path || 'root';
    const url = `https://graph.microsoft.com/v1.0/drive/${path}`;
    return request.get(url, { json: true, auth: { bearer: token } });
}

async function getAllChildren(token, path) {
    path = path || 'root';
    const url = `https://graph.microsoft.com/v1.0/drive/${path}/children`;
    let data = await request.get(url, { json: true, auth: { bearer: token } });
    let children = data.value;
    while (_.has(data, '@odata.nextLink')) {
        data = await request.get(data['@odata.nextLink'], { json: true, auth: { bearer: token } });
        children = children.concat(data.value);
    }
    return children;
}

async function Main() {
    const authOneDrive = await authDb.findOne({ type: 'onedrive' });
    if (!authOneDrive) {
        console.error('No auth found for OneDrive.');
        process.exit(1);
    }
    const token = await getAccessToken(authOneDrive.auth.refresh_token);

    const path = 'items/6D3950F38CB09171%21532943';
    const folder = await getFolder(token, path);
    try {
        await fs.mkdir('data/' + folder.name);
    } catch (e) { /* already there */ }

    let children = await getAllChildren(token, path);
    children = _.filter(children, file => !fs.existsSync('data/' + folder.name + '/' + file.name)
                                            && file.file.mimeType.indexOf('image') >= 0);

    console.log(children.length + ' files to download.');

    for (const file of children) {
        console.log(file.name + '...');
        const content = await request.get({ url: file['@microsoft.graph.downloadUrl'], encoding: null });
        await fs.writeFile('data/' + folder.name + '/' + file.name, content);
    }

    // await Promise.all(
    //     children.map(file => {
    //         if (file.file.mimeType.indexOf('image') >= 0) {
    //             return request.get({ url: file['@microsoft.graph.downloadUrl'], encoding: null })
    //                     .then(data => fs.writeFile(file.name, data))
    //                     .then(() => console.log(file.name));
    //         }
    //         return true;
    //     })
    // );
}

Main()
.catch(e => console.error(e));
