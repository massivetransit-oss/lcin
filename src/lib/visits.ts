import { supabase } from './supabaseClient'

export async function fetchVisitedPlaceIds(userId: string): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('visits')
    .select('place_id')
    .eq('user_id', userId)

  if (error) throw new Error(error.message)
  return new Set(data.map((row) => row.place_id as string))
}
