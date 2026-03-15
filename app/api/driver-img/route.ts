import { NextRequest, NextResponse } from 'next/server'

export const runtime = 'edge'

export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get('code')
  const url  = req.nextUrl.searchParams.get('url')
  
  if (!url) return new NextResponse('Missing url', { status: 400 })
  
  // Only allow F1 official media URLs
  if (!url.startsWith('https://media.formula1.com/')) {
    return new NextResponse('Invalid source', { status: 403 })
  }

  try {
    const img = await fetch(url, {
      headers: {
        'Referer': 'https://www.formula1.com/',
        'Origin': 'https://www.formula1.com',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
      },
      signal: AbortSignal.timeout(5000),
    })

    if (!img.ok) return new NextResponse(null, { status: img.status })

    const blob = await img.arrayBuffer()
    return new NextResponse(blob, {
      headers: {
        'Content-Type': img.headers.get('content-type') ?? 'image/png',
        'Cache-Control': 'public, max-age=86400, s-maxage=86400',
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch {
    return new NextResponse(null, { status: 404 })
  }
}
