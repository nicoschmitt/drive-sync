const request = require('request-promise');

exports.register = (DriveSync, app) => {
    const authDb = DriveSync.authDb;

    app.get('/auth/onedrive/login', (req, res) => {
        // https://dev.onedrive.com/auth/graph_oauth.htm#code-flow
        const appId = process.env.MS_APP_ID;
        const scope = 'files.read offline_access';
        const redirect = process.env.MS_REDIRECT_URL;
        let url = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
        url += `?client_id=${appId}&scope=${scope}&response_type=code&redirect_uri=${redirect}`;
        res.redirect(url);
    });

    app.get('/auth/onedrive/redirect', async (req, res) => {
        // https://dev.onedrive.com/auth/graph_oauth.htm#step-2-redeem-the-code-for-access-tokens
        const url = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';
        const data = {
            client_id: process.env.MS_APP_ID,
            redirect_uri: process.env.MS_REDIRECT_URL,
            client_secret: process.env.MS_APP_SECRET,
            code: req.query.code,
            grant_type: 'authorization_code',
        };
        try {
            const body = await request.post({ url: url, form: data, json: true });
            await authDb.insert({ type: 'onedrive', auth: body });
            res.redirect('/');
        } catch (err) {
            console.error(err);
            res.status(500).json(err);
        }
    });

    app.get('/auth/amazon/login', (req, res) => {
        // https://developer.amazon.com/public/apis/engage/login-with-amazon/docs/authorization_code_grant.html
        const appId = process.env.AMZN_CLIENT_ID;
        const scope = 'clouddrive:read_all';
        const redirect = process.env.AMZN_REDIRECT_URL;
        let url = 'https://www.amazon.com/ap/oa';
        url += `?client_id=${appId}&scope=${scope}&response_type=code&redirect_uri=${redirect}`;
        res.redirect(url);
    });

    app.get('/auth/amazon/redirect', async (req, res) => {
        // https://developer.amazon.com/public/apis/engage/login-with-amazon/docs/authorization_code_grant.html#Access Token Request
        const url = 'https://api.amazon.com/auth/o2/token';
        const data = {
            client_id: process.env.AMZN_CLIENT_ID,
            redirect_uri: process.env.AMZN_REDIRECT_URL,
            client_secret: process.env.AMZN_APP_SECRET,
            code: req.query.code,
            grant_type: 'authorization_code',
        };
        try {
            const body = await request.post({ url: url, form: data, json: true });
            await authDb.insert({ type: 'amazon', auth: body });
            res.redirect('/');
        } catch (err) {
            console.error(err);
            res.status(500).json(err);
        }
    });
};