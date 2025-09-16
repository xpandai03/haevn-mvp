import { createClient } from '@/lib/supabase/client'

export async function likePartnership(fromId: string, toId: string) {
  // For localStorage implementation during development
  if (typeof window !== 'undefined') {
    const likesKey = 'haevn_likes'
    const handshakesKey = 'haevn_handshakes'

    // Get existing likes
    const existingLikes = JSON.parse(localStorage.getItem(likesKey) || '[]')

    // Check if already liked
    const alreadyLiked = existingLikes.some(
      (like: any) => like.from === fromId && like.to === toId
    )

    if (alreadyLiked) {
      return { matched: false, error: 'Already liked' }
    }

    // Add new like
    existingLikes.push({
      from: fromId,
      to: toId,
      created_at: new Date().toISOString()
    })
    localStorage.setItem(likesKey, JSON.stringify(existingLikes))

    // Check for reciprocal like
    const hasReciprocalLike = existingLikes.some(
      (like: any) => like.from === toId && like.to === fromId
    )

    if (hasReciprocalLike) {
      // Create handshake
      const existingHandshakes = JSON.parse(localStorage.getItem(handshakesKey) || '[]')

      // Check if handshake already exists
      const handshakeExists = existingHandshakes.some(
        (h: any) =>
          (h.a_partnership === fromId && h.b_partnership === toId) ||
          (h.a_partnership === toId && h.b_partnership === fromId)
      )

      if (!handshakeExists) {
        // Order by ID to keep unique
        const [a, b] = [fromId, toId].sort()
        const handshakeId = `handshake-${a}-${b}`

        existingHandshakes.push({
          id: handshakeId,
          a_partnership: a,
          b_partnership: b,
          created_at: new Date().toISOString()
        })
        localStorage.setItem(handshakesKey, JSON.stringify(existingHandshakes))

        return { matched: true, handshakeId }
      }
    }

    return { matched: false }
  }

  // Production Supabase implementation
  try {
    const supabase = createClient()

    // Insert signal
    const { error: signalError } = await supabase
      .from('signals')
      .insert({
        from_partnership: fromId,
        to_partnership: toId,
        signal_type: 'like'
      })

    if (signalError && !signalError.message.includes('duplicate')) {
      console.error('Error creating signal:', signalError)
      return { matched: false, error: signalError.message }
    }

    // Check for reciprocal like
    const { data: reciprocal } = await supabase
      .from('signals')
      .select('id')
      .eq('from_partnership', toId)
      .eq('to_partnership', fromId)
      .eq('signal_type', 'like')
      .single()

    if (reciprocal) {
      // Check if handshake already exists
      const { data: existingHandshake } = await supabase
        .from('handshakes')
        .select('id')
        .or(`and(a_partnership.eq.${fromId},b_partnership.eq.${toId}),and(a_partnership.eq.${toId},b_partnership.eq.${fromId})`)
        .single()

      if (!existingHandshake) {
        // Order partnerships by ID to maintain uniqueness
        const [a, b] = [fromId, toId].sort()

        const { data: handshake, error: handshakeError } = await supabase
          .from('handshakes')
          .insert({
            a_partnership: a,
            b_partnership: b
          })
          .select('id')
          .single()

        if (handshakeError) {
          console.error('Error creating handshake:', handshakeError)
          return { matched: true } // Still matched, just couldn't create handshake
        }

        return { matched: true, handshakeId: handshake.id }
      }

      return { matched: true, handshakeId: existingHandshake.id }
    }

    return { matched: false }

  } catch (error) {
    console.error('Error in likePartnership:', error)
    return { matched: false, error: 'Failed to process like' }
  }
}

export async function getUserLikes(partnershipId: string) {
  // For localStorage implementation
  if (typeof window !== 'undefined') {
    const likesKey = 'haevn_likes'
    const likes = JSON.parse(localStorage.getItem(likesKey) || '[]')
    return likes.filter((like: any) => like.from === partnershipId)
  }

  // Production Supabase implementation
  const supabase = createClient()

  const { data, error } = await supabase
    .from('signals')
    .select('*')
    .eq('from_partnership', partnershipId)
    .eq('signal_type', 'like')

  if (error) {
    console.error('Error fetching likes:', error)
    return []
  }

  return data || []
}

export async function getHandshakes(partnershipId: string) {
  // For localStorage implementation
  if (typeof window !== 'undefined') {
    const handshakesKey = 'haevn_handshakes'
    const handshakes = JSON.parse(localStorage.getItem(handshakesKey) || '[]')
    return handshakes.filter(
      (h: any) => h.a_partnership === partnershipId || h.b_partnership === partnershipId
    )
  }

  // Production Supabase implementation
  const supabase = createClient()

  const { data, error } = await supabase
    .from('handshakes')
    .select('*')
    .or(`a_partnership.eq.${partnershipId},b_partnership.eq.${partnershipId}`)

  if (error) {
    console.error('Error fetching handshakes:', error)
    return []
  }

  return data || []
}