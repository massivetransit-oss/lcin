import { supabase } from './supabaseClient'

export type Place = {
  id: string
  name: string
  description: string
  address: string
  lat: number
  lng: number
  order_index: number
}

export async function fetchPlaces(): Promise<Place[]> {
  const { data, error } = await supabase
    .from('places')
    .select('id, name, description, address, lat, lng, order_index')
    .order('order_index', { ascending: true })

  if (error) throw new Error(error.message)
  return data as Place[]
}

export async function fetchPlaceById(id: string): Promise<Place> {
  const { data, error } = await supabase
    .from('places')
    .select('id, name, description, address, lat, lng, order_index')
    .eq('id', id)
    .single()

  if (error) throw new Error(error.message)
  return data as Place
}
