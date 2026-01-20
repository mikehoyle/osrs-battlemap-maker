export async function onRequest(context) {
    const url = new URL(context.request.url);

    // Let static assets pass through to the asset server
    if (
        url.pathname.match(
            /\.(js|css|png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|json|wasm|map|txt|xml)$/,
        )
    ) {
        return context.next();
    }

    // For all other routes, serve index.html with 200 status
    const response = await context.env.ASSETS.fetch(new URL("/index.html", url.origin));
    return new Response(response.body, {
        headers: response.headers,
        status: 200,
    });
}
