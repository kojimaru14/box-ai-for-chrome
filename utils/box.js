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
        this.tokens = tokens;
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
        };
        const encrypted = await this.#encryptData(this.tokens);
        await chrome.storage.local.set({
            ["BOX__CREDENTIALS"]: encrypted
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

    /**
     * Ask Box AI with a custom instruction and optional model.
     * @param {string} fileId - The Box file ID to query.
     * @param {string} query - The prompt or instruction to send.
     * @param {string} [modelId] - Optional AI model ID to use.
     */
    async askBoxAI(fileId, query, modelConfig) {
        const accessToken = await this.getBoxAccessToken();
        const payload = {
            mode: 'single_item_qa',
            prompt: `${query}`,
            items: [ { type: 'file', id: `${fileId}` } ]
        };
        if (modelConfig) payload.ai_agent = modelConfig;
        console.log(`${this.LOG} Asking Box AI with payload:`, payload);
        const response = await fetch(`https://api.box.com/2.0/ai/ask`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(payload)
        });
        return response;
    }

    /**
     * Retrieve the default AI agent prompt template for a given model.
     * @param {string} modelId - The AI model ID to fetch the system prompt template for.
     * @returns {Promise<string>} The prompt template string.
     */
    async getAiAgentDefaultConfig(modelId, lang = 'en') {
        const accessToken = await this.getBoxAccessToken();
        const response = await fetch(`https://api.box.com/2.0/ai_agent_default?mode=ask&model=${modelId}&language=${lang}`, {
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Failed to fetch default AI agent configuration: ${errorText}`);
        }
        const result = await response.json();
        return result;
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
    
    /**
     * Delete a file from Box by its file ID.
     * @param {string} fileId - The ID of the file to delete.
     */
    async deleteFile(fileId) {
        const accessToken = await this.getBoxAccessToken();
        const res = await fetch(`https://api.box.com/2.0/files/${fileId}`, {
            method: 'DELETE',
            headers: { Authorization: `Bearer ${accessToken}` }
        });
        if (!res.ok) {
            const errText = await res.text();
            throw new Error(`${this.LOG} Failed to delete file: ${errText}`);
        }
    }
}

export default BOX;