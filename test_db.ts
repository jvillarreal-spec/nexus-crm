import { createClient } from '@supabase/supabase-js'

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function test() {
  const { data, error } = await supabase.from('profiles').select('*').limit(1)
  console.log('Profile sample:', data)
  console.log('Error:', error)
  
  const { data: companies, error: compError } = await supabase.from('companies').select('*')
  console.log('Companies:', companies)
}

test()
