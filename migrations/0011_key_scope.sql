-- What a device key may do. NULL: a browser's key (or a sync link's), which
-- reaches every cloud endpoint. 'mcp': an AI assistant's OAuth token
-- (functions/api/oauth/token.ts), which only the MCP server (/mcp) accepts.
-- Before this, an assistant's token was a full browser key: any connected app
-- could call /api/profile, /api/keys directly — delete the cloud copy, sign
-- out every device, or switch activity linking back on — which /authorize
-- promises it can't. Keys minted before this stay NULL (full); "Sign out other
-- devices" and connecting the assistant again replaces them with scoped ones.
ALTER TABLE device_keys ADD COLUMN scope TEXT;
