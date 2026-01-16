import { links, Env } from '../_shared/store'

// POST /api/link - Create new link
export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const { url, customCode } = await context.request.json() as { url: string; customCode?: string }

        if (!url) {
            return new Response(JSON.stringify({ error: 'URL is required' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            })
        }

        // Validate URL
        try {
            new URL(url)
        } catch {
            return new Response(JSON.stringify({ error: 'Invalid URL' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json' },
            })
        }

        // Check custom code format
        if (customCode) {
            if (!/^[a-zA-Z0-9_-]{3,20}$/.test(customCode)) {
                return new Response(JSON.stringify({ error: 'Custom code must be 3-20 alphanumeric characters' }), {
                    status: 400,
                    headers: { 'Content-Type': 'application/json' },
                })
            }
            // Check existence logic is now inside create() or we can pre-check
            const existing = await links.get(context.env, customCode)
            if (existing) {
                return new Response(JSON.stringify({ error: 'This custom code is already taken' }), {
                    status: 409,
                    headers: { 'Content-Type': 'application/json' },
                })
            }
        }

        const link = await links.create(context.env, url, customCode)
        return new Response(JSON.stringify(link), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
        })
    } catch (error: any) {
        console.error('Error creating link:', error)
        if (error.message === 'Code exists') {
            return new Response(JSON.stringify({ error: 'This custom code is already taken' }), {
                status: 409,
                headers: { 'Content-Type': 'application/json' },
            })
        }
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        })
    }
}

// GET /api/link - List all links
export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
        const allLinks = await links.list(context.env)
        return new Response(JSON.stringify(allLinks), {
            headers: { 'Content-Type': 'application/json' },
        })
    } catch (error) {
        console.error('Error listing links:', error)
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        })
    }
}
