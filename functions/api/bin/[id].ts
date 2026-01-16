import { bins, Env } from '../../_shared/store'

// GET /api/bin/[id] - Get bin details
export const onRequestGet: PagesFunction<Env> = async (context) => {
    const id = context.params.id as string
    const bin = await bins.get(context.env, id)

    if (!bin) {
        return new Response(JSON.stringify({ error: 'Bin not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
        })
    }

    return new Response(JSON.stringify(bin), {
        headers: { 'Content-Type': 'application/json' },
    })
}

// Handle webhook (POST, PUT, PATCH, DELETE)
async function handleWebhook(context: EventContext<Env, string, unknown>): Promise<Response> {
    const id = context.params.id as string
    const bin = await bins.get(context.env, id)

    if (!bin) {
        return new Response(JSON.stringify({ error: 'Bin not found' }), {
            status: 404,
            headers: { 'Content-Type': 'application/json' },
        })
    }

    // Extract headers
    const headers: Record<string, string> = {}
    context.request.headers.forEach((value, key) => {
        headers[key] = value
    })

    // Extract query params
    const query: Record<string, string> = {}
    const url = new URL(context.request.url)
    url.searchParams.forEach((value, key) => {
        query[key] = value
    })

    // Extract body
    let body: unknown = null
    const contentType = context.request.headers.get('content-type') || ''

    try {
        if (contentType.includes('application/json')) {
            body = await context.request.json()
        } else if (contentType.includes('application/x-www-form-urlencoded')) {
            const formData = await context.request.formData()
            const formObj: Record<string, string> = {}
            formData.forEach((value, key) => {
                formObj[key] = value.toString()
            })
            body = formObj
        } else if (contentType.includes('text/')) {
            body = await context.request.text()
        } else {
            try {
                body = await context.request.text()
            } catch {
                body = null
            }
        }
    } catch (e) {
        console.error('Error parsing body:', e)
    }

    // Get IP
    const ip = context.request.headers.get('cf-connecting-ip') ||
        context.request.headers.get('x-forwarded-for')?.split(',')[0] ||
        'unknown'

    // Add request to bin
    await bins.addRequest(context.env, id, {
        method: context.request.method,
        headers,
        query,
        body,
        ip,
    })

    return new Response(JSON.stringify({
        success: true,
        message: 'Request captured',
        timestamp: Date.now(),
    }), {
        headers: { 'Content-Type': 'application/json' },
    })
}

export const onRequestPost = handleWebhook
export const onRequestPut = handleWebhook
export const onRequestPatch = handleWebhook
export const onRequestDelete = handleWebhook
