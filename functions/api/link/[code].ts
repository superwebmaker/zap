import { links, Env } from '../../_shared/store'

// GET /api/link/[code] - Get link stats
export const onRequestGet: PagesFunction<Env> = async (context) => {
    const code = context.params.code as string
    const link = await links.get(context.env, code)

    if (!link) {
        return new Response(JSON.stringify({ error: 'Link not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
        })
    }

    return new Response(JSON.stringify(link), {
        headers: { 'Content-Type': 'application/json' },
    })
}

// DELETE /api/link/[code] - Delete link
export const onRequestDelete: PagesFunction<Env> = async (context) => {
    const code = context.params.code as string
    const deleted = await links.delete(context.env, code)

    if (!deleted) {
        return new Response(JSON.stringify({ error: 'Link not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
        })
    }

    return new Response(JSON.stringify({ success: true }), {
        headers: { 'Content-Type': 'application/json' },
    })
}
