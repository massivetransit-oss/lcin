import { supabase } from './supabaseClient'

export async function fetchVisitedPlaceIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('visits')
    .select('place_id')
    .eq('user_id', userId)

  if (error) throw new Error(error.message)
  return new Set(data.map((row) => row.place_id as string))
}

export type Visit = {
  id: string
  user_id: string
  place_id: string
  photo_url: string
  comment: string
  created_at: string
  users: { name: string }
}

export async function fetchVisitsByPlace(placeId: string): Promise<Visit[]> {
  const { data, error } = await supabase
    .from('visits')
    .select('id, user_id, place_id, photo_url, comment, created_at, users(name)')
    .eq('place_id', placeId)
    .order('created_at', { ascending: false })

  if (error) throw new Error(error.message)
  return data as unknown as Visit[]
}

export async function createVisit(params: {
  userId: string
  placeId: string
  photo: File
  comment: string
}): Promise<void> {
  const ext = params.photo.name.split('.').pop() ?? 'jpg'
  const path = `${params.placeId}/${params.userId}-${Date.now()}.${ext}`

  const { error: uploadError } = await supabase.storage
    .from('visit-photos')
    .upload(path, params.photo)

  if (uploadError) throw new Error(uploadError.message)

  const { data: publicUrlData } = supabase.storage.from('visit-photos').getPublicUrl(path)

  const { error: insertError } = await supabase.from('visits').insert({
    user_id: params.userId,
    place_id: params.placeId,
    photo_url: publicUrlData.publicUrl,
    comment: params.comment,
  })

  if (insertError) {
    if (insertError.code === '23505') {
      throw new Error('ALREADY_VISITED')
    }
    throw new Error(insertError.message)
  }
}
