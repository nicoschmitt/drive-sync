require('dotenv').config({ silent: true });

const _ = require('lodash');
const fs = require('mz/fs');
const request = require('request-promise');
const ProgressBar = require('progress');
const retry = require('async-retry');

const Auth = require('../auth/onedrive');

async function getFolder(token, path) {
    path = path || 'root';
    const url = `https://graph.microsoft.com/v1.0/drive/${path}`;
    return request.get(url, { json: true, auth: { bearer: token } });
}

async function getAllChildren(token, path) {
    path = path || 'root';
    const url = `https://graph.microsoft.com/v1.0/drive/${path}/children?orderby=lastModifiedDateTime`;
    let data = await request.get(url, { json: true, auth: { bearer: token } });
    let children = data.value;
    while (_.has(data, '@odata.nextLink')) {
        data = await request.get(data['@odata.nextLink'], { json: true, auth: { bearer: token } });
        children = children.concat(data.value);
    }
    return children;
}

async function downloadFolder(token, path, destination) {
    const folder = await getFolder(token, path);

    const parent = destination + '/' + folder.name;
    try {
        await fs.mkdir(parent);
    } catch (e) { /* already there */ }

    console.log(`Downloading '${folder.name}'...`);
    if (fs.existsSync(parent + '/skip')) {
        console.log('  skiping.');
        return;
    }

    const children = await getAllChildren(token, path);
    const files = _.filter(children, file => !fs.existsSync(parent + '/' + file.name)
                                            && file.file
                                            && file.file.mimeType.indexOf('image') >= 0);

    console.log(`  ${files.length} files to download.`);

    if (files.length > 0) {
        const bar = new ProgressBar('[:bar] :current/:total', { total: files.length, width: 30 });
        bar.tick(0);
        for (const file of files) {
            await retry(async () => {
                const content = await request.get({ url: file['@microsoft.graph.downloadUrl'], encoding: null });
                await fs.writeFile(parent + '/' + file.name, content);
                bar.tick();
            }, { retries: 3 });
        }
    }

    const folders = _.filter(children, dir => dir.folder);
    for (const dir of folders) {
        await downloadFolder(token, 'items/' + dir.id, parent);
    }
}

async function Main() {
    console.log('Login...');

    const authOneDrive = await Auth.getAuthFromCache();
    if (!authOneDrive) {
        console.error('No auth found for OneDrive.');
        process.exit(1);
    }
    const token = await Auth.getAccessToken(authOneDrive.auth.refresh_token);

    const path = 'items/' + process.env.ONEDRIVE_FOLDER_ID;

    await downloadFolder(token, path, 'data');

    console.log('Done.');
}

Main()
.catch(e => console.error(e));
