class BOX {
    #LOGHEADER = "[BOX]"; // Header for logging
    tokens = null; // Store tokens in a private field

    constructor(config) {
        this.initialize(config);
        console.log(`${this.#LOGHEADER} Initializing...`);
    }

    initialize(config) {   
        if (!config || !config.BOX__CLIENT_ID || !config.BOX__CLIENT_SECRET) {
            throw new Error(`${this.#LOGHEADER} Missing Box client ID or secret in config.`);
        }
        this.clientId = config.BOX__CLIENT_ID;
        this.clientSecret = config.BOX__CLIENT_SECRET;
        console.log(`${this.#LOGHEADER} Configuration initialized with client ID: ${this.clientId}`);
    }
    
    get LOG() {
        return this.#LOGHEADER;
    }

    async getTokensAuthorizationCodeGrant(code, clientId, clientSecret, redirectUri) {
        const response = await fetch('https://api.box.com/oauth2/token', {
            method: 'POST',
            headers: {'Content-Type': 'application/x-www-form-urlencoded'},
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code: code,
                client_id: clientId,
                client_secret: clientSecret,
                redirect_uri: redirectUri,
            })
        });
        const tokenData = await response.json();
        this.saveTokens(tokenData);
    }

    async getBoxAccessToken() {
        const { BOX__CREDENTIALS: tokens }  = await chrome.storage.local.get("BOX__CREDENTIALS");
        this.tokens = tokens;
        if (tokens && Date.now() < tokens.expires_at) {
            return tokens.access_token; // Within valid period
        } else if (tokens && tokens.refresh_token) {
            try {
                return await this.refreshAccessToken(tokens.refresh_token);
            } catch (e) {
                console.warn("Token refresh failed. You need to re-authorize the app via Options page:", e);
            }
        }
    }

    async refreshAccessToken(refreshToken) {
        const body = new URLSearchParams({
            grant_type: 'refresh_token',
            refresh_token: refreshToken,
            client_id: this.clientId,
            client_secret: this.clientSecret
        });

        const res = await fetch("https://api.box.com/oauth2/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body
        });

        if (!res.ok) throw new Error(await res.text());
        const data = await res.json();

        await this.saveTokens(data);
        return data.access_token;
    }

    async saveTokens(tokenData) {
        this.tokens = {
                access_token: tokenData.access_token,
                refresh_token: tokenData.refresh_token,
                expires_at: tokenData.expires_in ? Date.now() + tokenData.expires_in * 1000 : null
            }
        await chrome.storage.local.set({
            ["BOX__CREDENTIALS"]: this.tokens
        });
    }

    async getUser(userId="me") {
        const accessToken = await this.getBoxAccessToken();
        const res = await fetch(`https://api.box.com/2.0/users/${userId}`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        const json = await res.json();
        return json;
    }

    async askBoxAI(fileId, query) {
        const accessToken = await this.getBoxAccessToken();
        const response = await fetch(`https://api.box.com/2.0/ai/ask`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                "mode": "single_item_qa",
                "prompt": `${query}`,
                "items": [
                    {
                        "type": "file",
                        "id": `${fileId}`
                    }
                ]
            })
        });
        return response;
    }

    async uploadFile(fileName, fileData, parentFolderId = '0') {
        const accessToken = await this.getBoxAccessToken();
        if (!accessToken) {
            throw new Error(`${this.LOG} Cannot upload file without access token`);
        }
        const form = new FormData();
        form.append('attributes', JSON.stringify({ name: fileName, parent: { id: parentFolderId } }));
        form.append('file', fileData, fileName);
        const res = await fetch('https://upload.box.com/api/2.0/files/content', {
            method: 'POST',
            headers: { Authorization: `Bearer ${accessToken}` },
            body: form
        });
        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`${this.LOG} File upload failed: ${errText}`);
        }
        const json = await res.json();
        const fileId = json.entries?.[0]?.id;
        if (!fileId) {
            throw new Error(`${this.LOG} Uploaded file ID not found in response`);
        }
        return fileId;
    }
}

export default BOX;