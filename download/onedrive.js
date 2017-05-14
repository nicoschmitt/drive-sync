require('dotenv').config({ silent: true });

const _ = require('lodash');
const fs = require('mz/fs');
const request = require('request-promise');

const Auth = require('../auth/onedrive');

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
    const authOneDrive = await Auth.getAuthFromCache();
    if (!authOneDrive) {
        console.error('No auth found for OneDrive.');
        process.exit(1);
    }
    const token = await Auth.getAccessToken(authOneDrive.auth.refresh_token);

    const path = 'items/6D3950F38CB09171%21536783';
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

    console.log('Done.');
}

Main()
.catch(e => console.error(e));
