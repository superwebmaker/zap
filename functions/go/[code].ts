import { links, Env } from '../_shared/store'

// GET /go/[code] - Redirect to original URL
export const onRequestGet: PagesFunction<Env> = async (context) => {
    const code = context.params.code as string

    // Use links.click to increment stats and get URL
    const link = await links.click(context.env, code)

    if (!link) {
        // Redirect to link creation page if not found
        return Response.redirect(new URL('/link', context.request.url).toString(), 302)
    }

    // Redirect to target URL
    return Response.redirect(link.url, 302)
}
