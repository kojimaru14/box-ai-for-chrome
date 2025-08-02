const BOX_API_URL = "https://api.box.com/2.0";
const BOX_OAUTH_URL = "https://api.box.com/oauth2";
const BOX_AUTHROIZE_URL = "https://account.box.com/api/oauth2/authorize";
const BOX_UPLOAD_URL = "https://upload.box.com/api/2.0";

class BOX {
    #LOGHEADER = "[BOX]"; // Header for logging

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

    async #deriveKey() {
        const enc = new TextEncoder();
        const keyMaterial = await crypto.subtle.importKey(
            'raw',
            enc.encode(this.clientSecret),
            'PBKDF2',
            false,
            ['deriveKey']
        );
        return crypto.subtle.deriveKey(
            {
                name: 'PBKDF2',
                salt: enc.encode(this.clientId),
                iterations: 100000,
                hash: 'SHA-256'
            },
            keyMaterial,
            { name: 'AES-GCM', length: 256 },
            false,
            ['encrypt', 'decrypt']
        );
    }

    async #encryptData(data) {
        const key = await this.#deriveKey();
        const enc = new TextEncoder();
        const iv = crypto.getRandomValues(new Uint8Array(12));
        const cipherBuffer = await crypto.subtle.encrypt(
            { name: 'AES-GCM', iv },
            key,
            enc.encode(JSON.stringify(data))
        );
        const ivArr = Array.from(iv);
        const ctArr = Array.from(new Uint8Array(cipherBuffer));
        return {
            iv: btoa(String.fromCharCode(...ivArr)),
            ciphertext: btoa(String.fromCharCode(...ctArr))
        };
    }

    async #decryptData(encrypted) {
        const key = await this.#deriveKey();
        const iv = Uint8Array.from(atob(encrypted.iv), c => c.charCodeAt(0));
        const ct = Uint8Array.from(atob(encrypted.ciphertext), c => c.charCodeAt(0));
        const plainBuffer = await crypto.subtle.decrypt(
            { name: 'AES-GCM', iv },
            key,
            ct
        );
        const dec = new TextDecoder();
        return JSON.parse(dec.decode(plainBuffer));
    }

    getAuthorizeURL(redirectUri) {
        return `${BOX_AUTHROIZE_URL}?response_type=code&client_id=${this.clientId}&redirect_uri=${encodeURIComponent(redirectUri)}`;
    }

    async #apiRequest(endpoint, options = {}, baseUrl = BOX_API_URL) {
        const accessToken = await this.getBoxAccessToken();
        if (!accessToken) {
            throw new Error(`${this.LOG} Cannot make API request without access token`);
        }

        const headers = {
            ...options.headers,
            Authorization: `Bearer ${accessToken}`
        };

        const response = await fetch(`${baseUrl}${endpoint}`, { ...options, headers });

        if (!response.ok) {
            const errText = await response.text();
            throw new Error(`${this.LOG} API request failed: ${errText}`);
        }

        return response;
    }

    async getTokensAuthorizationCodeGrant(code, redirectUri) {
        const response = await fetch(`${BOX_OAUTH_URL}/token`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code: code,
                client_id: this.clientId,
                client_secret: this.clientSecret,
                redirect_uri: redirectUri,
            })
        });
        const tokenData = await response.json();
        await this.saveTokens(tokenData);
    }

    async getBoxAccessToken() {
        const result = await chrome.storage.local.get("BOX__CREDENTIALS");
        let tokens;
        if (result.BOX__CREDENTIALS) {
            try {
                tokens = await this.#decryptData(result.BOX__CREDENTIALS);
            } catch (e) {
                console.error(`${this.LOG} Failed to decrypt stored tokens:`, e);
                await chrome.storage.local.remove("BOX__CREDENTIALS");
                tokens = null;
            }
        }
        if (tokens && Date.now() < tokens.expires_at) {
            return tokens.access_token;
        } else if (tokens && tokens.refresh_token) {
            try {
                return await this.refreshAccessToken(tokens.refresh_token);
            } catch (e) {
                console.warn(`${this.LOG} Token refresh failed. You need to re-authorize the app via Options page:`, e);
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

        const res = await fetch(`${BOX_OAUTH_URL}/token`, {
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
        const tokens = {
            access_token: tokenData.access_token,
            refresh_token: tokenData.refresh_token,
            expires_at: tokenData.expires_in ? Date.now() + tokenData.expires_in * 1000 : null
        };
        const encrypted = await this.#encryptData(tokens);
        await chrome.storage.local.set({
            ["BOX__CREDENTIALS"]: encrypted
        });
    }

    async getUser(userId = "me") {
        const res = await this.#apiRequest(`/users/${userId}`);
        return await res.json();
    }

    async askBoxAI(fileId, query, modelConfig) {
        const payload = {
            mode: 'single_item_qa',
            prompt: `${query}`,
            items: [{ type: 'file', id: `${fileId}` }]
        };
        if (modelConfig) payload.ai_agent = modelConfig;
        console.log(`${this.LOG} Asking Box AI with payload:`, payload);
        return await this.#apiRequest(`/ai/ask`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
    }

    async getAiAgentDefaultConfig(modelId, lang = 'en') {
        const res = await this.#apiRequest(`/ai_agent_default?mode=ask&model=${modelId}&language=${lang}`);
        return await res.json();
    }

    async uploadFile(fileName, fileData, parentFolderId = '0') {
        const form = new FormData();
        form.append('attributes', JSON.stringify({ name: fileName, parent: { id: parentFolderId } }));
        form.append('file', fileData, fileName);

        const res = await this.#apiRequest(`/files/content`, {
            method: 'POST',
            body: form
        }, BOX_UPLOAD_URL);

        const json = await res.json();
        const fileId = json.entries?.[0]?.id;
        if (!fileId) {
            throw new Error(`${this.LOG} Uploaded file ID not found in response`);
        }
        return fileId;
    }

    async deleteFile(fileId) {
        await this.#apiRequest(`/files/${fileId}`, { method: 'DELETE' });
    }
}

export default BOX;
