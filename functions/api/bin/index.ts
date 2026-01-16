import { bins, Env } from '../_shared/store'

// POST /api/bin - Create new bin
export const onRequestPost: PagesFunction<Env> = async (context) => {
    try {
        const bin = await bins.create(context.env)
        return new Response(JSON.stringify(bin), {
            status: 201,
            headers: { 'Content-Type': 'application/json' },
        })
    } catch (error) {
        console.error('Error creating bin:', error)
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        })
    }
}

// GET /api/bin - List all bins
export const onRequestGet: PagesFunction<Env> = async (context) => {
    try {
        const allBins = await bins.list(context.env)
        return new Response(JSON.stringify(allBins), {
            headers: { 'Content-Type': 'application/json' },
        })
    } catch (error) {
        console.error('Error listing bins:', error)
        return new Response(JSON.stringify({ error: 'Internal server error' }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        })
    }
}
