// app/api/po-token/route.js
export async function POST(req) {
  const { videoId } = await req.json();
  try {
    const { Innertube } = await import('youtubei.js');
    const yt = await Innertube.create();
    const poToken = yt.session.po_token;   // already generated internally
    console.log('PO Token generated for videoId', videoId, ':', poToken);
    return Response.json({ token: poToken ?? null });
  } catch (err) {
    console.log('Error generating PO token for videoId', videoId, ':', err);    
    console.error(err);
    return Response.json({ token: null });
  }
}