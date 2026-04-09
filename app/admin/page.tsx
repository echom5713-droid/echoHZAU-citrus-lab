import { AdminClient } from '@/components/AdminClient'
import { mockRecords } from '@/lib/mock-data'
import { getServerSupabase } from '@/lib/supabase'

async function getRecords() {
  const supabase = getServerSupabase()
  if (!supabase) return mockRecords
  const { data } = await supabase
    .from('experiment_records')
    .select('*')
    .order('created_at', { ascending: false })
  return data ?? mockRecords
}

export default async function AdminPage() {
  const records = await getRecords()
  return <AdminClient initialRecords={records} />
}
