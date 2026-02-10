import { NextResponse } from 'next/server'
import { DEFAULT_ERROR_MESSAGE } from '@/lib/constants'
import { EventRepository } from '@/lib/db/queries/event'
import { UserRepository } from '@/lib/db/queries/user'
import { PolymarketEventRepository } from '@/lib/db/queries/polymarket_events'

// Helper function to convert BigInt to string recursively
function convertBigIntToString(obj: any): any {
  if (obj === null || obj === undefined) {
    return obj
  }

  if (typeof obj === 'bigint') {
    return obj.toString()
  }

  if (Array.isArray(obj)) {
    return obj.map(item => convertBigIntToString(item))
  }

  if (typeof obj === 'object') {
    const converted: any = {}
    for (const [key, value] of Object.entries(obj)) {
      converted[key] = convertBigIntToString(value)
    }
    return converted
  }

  return obj
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const tag = searchParams.get('tag') || 'trending'
  const search = searchParams.get('search') || ''
  const bookmarked = searchParams.get('bookmarked') === 'true'
  const status = searchParams.get('status') || 'active'
  const offset = Number.parseInt(searchParams.get('offset') || '0', 10)
  const clampedOffset = Number.isNaN(offset) ? 0 : Math.max(0, offset)

  if (status !== 'active' && status !== 'resolved') {
    return NextResponse.json({ error: 'Invalid status filter.' }, { status: 400 })
  }

  const user = await UserRepository.getCurrentUser()
  const userId = user?.id
  try {
    // const { data: events, error } = await EventRepository.listEvents({
    //   tag,
    //   search,
    //   userId,
    //   bookmarked,
    //   status,
    //   offset: clampedOffset,
    // })

    const { data: events,error } = await PolymarketEventRepository.listEvents({tag,
      search,
      userId,
      bookmarked,
      status,
      offset: clampedOffset,
    })

    console.log("Polymarket Events Count:", events?.length || 0)

    if (error) {
      return NextResponse.json({ error: DEFAULT_ERROR_MESSAGE }, { status: 500 })
    }

    // Convert BigInt to string before returning
    const serializedEvents = convertBigIntToString(events)
    return NextResponse.json(serializedEvents)
  }
  catch (error) {
    console.error('API Error:', error)
    return NextResponse.json({ error: DEFAULT_ERROR_MESSAGE }, { status: 500 })
  }
}
