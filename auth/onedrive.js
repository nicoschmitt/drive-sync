const Datastore = require('nedb-promise');
const request = require('request-promise');

const authDb = new Datastore({ filename: 'data/auth.db', autoload: true });

async function getAuthFromCache() {
    return authDb.findOne({ type: 'onedrive' });
}

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

    await authDb.update({ type: 'onedrive' }, { type: 'onedrive', auth: token }, { upsert: true });

    return token.access_token;
}

module.exports = {
    getAuthFromCache,
    getAccessToken,
};