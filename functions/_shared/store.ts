// Storage interface compatible with Cloudflare KV and In-Memory fallback

export interface Env {
    ZAP_KV?: KVNamespace
}

interface StoredLink {
    url: string
    code: string
    createdAt: number
    clicks: number
}

interface StoredBin {
    id: string
    createdAt: number
    requests: Array<{
        id: string
        method: string
        headers: Record<string, string>
        query: Record<string, string>
        body: unknown
        timestamp: number
        ip?: string
    }>
}

// Base62 charset
const CHARSET = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ'

export function generateCode(length = 6): string {
    let code = ''
    for (let i = 0; i < length; i++) {
        code += CHARSET[Math.floor(Math.random() * CHARSET.length)]
    }
    return code
}

export function generateId(): string {
    return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

// In-memory fallback stores
const linkStore = new Map<string, StoredLink>()
const binStore = new Map<string, StoredBin>()

// 1 Day in seconds
const TTL = 86400

export const links = {
    async create(env: Env, url: string, customCode?: string): Promise<StoredLink> {
        const code = customCode || generateCode()
        const link: StoredLink = { url, code, createdAt: Date.now(), clicks: 0 }

        if (env.ZAP_KV) {
            // Check if exists first if customCode (KV doesn't have secure generic 'has', usually we get)
            // But for simplicity, we just overwrite or trust collision resistance of random code
            if (customCode) {
                const existing = await env.ZAP_KV.get(`link:${code}`)
                if (existing) throw new Error('Code exists')
            }
            await env.ZAP_KV.put(`link:${code}`, JSON.stringify(link), { expirationTtl: TTL })
            // Also store in a list? KV doesn't support list well without separate key.
            // For 'list()' functionality to work in KV, we need a list key.
            // CAUTION: High concurrency updating a single list key is an anti-pattern in KV (eventual consistency).
            // For this 'Micro' SaaS, we will accept the limitation that 'list()' might only show local/recent or be disabled in KV mode?
            // OR: We skip implementing 'list all' properly for KV to stay fast, or use a simplified prefix list (expensive).
            // DECISION: For this scale, we'll try to maintain a 'links:index' key, but beware of write conflicts.
            // Better approach for scaling: Don't support global listing in production, only direct access.
            // However, to keep existing dashboard working, we hack a simple index.
            const indexStr = await env.ZAP_KV.get('links:index') || '[]'
            const index = JSON.parse(indexStr) as StoredLink[]
            index.unshift(link)
            if (index.length > 50) index.length = 50 // Keep only last 50 global links
            await env.ZAP_KV.put('links:index', JSON.stringify(index), { expirationTtl: TTL })
        } else {
            if (customCode && linkStore.has(customCode)) throw new Error('Code exists')
            linkStore.set(code, link)
        }
        return link
    },

    async get(env: Env, code: string): Promise<StoredLink | null> {
        if (env.ZAP_KV) {
            const val = await env.ZAP_KV.get(`link:${code}`)
            return val ? JSON.parse(val) : null
        }
        return linkStore.get(code) || null
    },

    async click(env: Env, code: string): Promise<StoredLink | null> {
        let link: StoredLink | null = null
        if (env.ZAP_KV) {
            const val = await env.ZAP_KV.get(`link:${code}`)
            if (val) {
                link = JSON.parse(val)
                link!.clicks++
                // Update KV silently (background)
                await env.ZAP_KV.put(`link:${code}`, JSON.stringify(link), { expirationTtl: TTL })
            }
        } else {
            link = linkStore.get(code) || null
            if (link) link.clicks++
        }
        return link
    },

    async list(env: Env): Promise<StoredLink[]> {
        if (env.ZAP_KV) {
            const val = await env.ZAP_KV.get('links:index')
            return val ? JSON.parse(val) : []
        }
        return Array.from(linkStore.values()).sort((a, b) => b.createdAt - a.createdAt)
    },

    async delete(env: Env, code: string): Promise<boolean> {
        if (env.ZAP_KV) {
            await env.ZAP_KV.delete(`link:${code}`)
            // We don't remove from index because it's expensive/complex, let it be stale or handle gracefully
            return true
        }
        return linkStore.delete(code)
    },
}

export const bins = {
    async create(env: Env): Promise<StoredBin> {
        const id = generateId()
        const bin: StoredBin = { id, createdAt: Date.now(), requests: [] }

        if (env.ZAP_KV) {
            await env.ZAP_KV.put(`bin:${id}`, JSON.stringify(bin), { expirationTtl: TTL })

            // Update index
            const indexStr = await env.ZAP_KV.get('bins:index') || '[]'
            const index = JSON.parse(indexStr) as StoredBin[]
            index.unshift(bin)
            if (index.length > 20) index.length = 20 // Keep last 20 bins only to avoid large keys
            await env.ZAP_KV.put('bins:index', JSON.stringify(index), { expirationTtl: TTL })
        } else {
            binStore.set(id, bin)
        }
        return bin
    },

    async get(env: Env, id: string): Promise<StoredBin | null> {
        if (env.ZAP_KV) {
            const val = await env.ZAP_KV.get(`bin:${id}`)
            return val ? JSON.parse(val) : null
        }
        return binStore.get(id) || null
    },

    async addRequest(
        env: Env,
        id: string,
        request: {
            method: string
            headers: Record<string, string>
            query: Record<string, string>
            body: unknown
            ip?: string
        }
    ): Promise<StoredBin | null> {
        let bin: StoredBin | null = null

        if (env.ZAP_KV) {
            const val = await env.ZAP_KV.get(`bin:${id}`)
            if (val) {
                bin = JSON.parse(val)
                bin!.requests.unshift({
                    id: generateId(),
                    ...request,
                    timestamp: Date.now(),
                })
                if (bin!.requests.length > 50) {
                    bin!.requests = bin!.requests.slice(0, 50)
                }
                await env.ZAP_KV.put(`bin:${id}`, JSON.stringify(bin), { expirationTtl: TTL })
            }
        } else {
            bin = binStore.get(id) || null
            if (bin) {
                bin.requests.unshift({
                    id: generateId(),
                    ...request,
                    timestamp: Date.now(),
                })
                if (bin.requests.length > 50) {
                    bin.requests = bin.requests.slice(0, 50)
                }
            }
        }
        return bin
    },

    async list(env: Env): Promise<StoredBin[]> {
        if (env.ZAP_KV) {
            const val = await env.ZAP_KV.get('bins:index')
            return val ? JSON.parse(val) : []
        }
        return Array.from(binStore.values()).sort((a, b) => b.createdAt - a.createdAt)
    },

    async delete(env: Env, id: string): Promise<boolean> {
        if (env.ZAP_KV) {
            await env.ZAP_KV.delete(`bin:${id}`)
            return true
        }
        return binStore.delete(id)
    },
}
