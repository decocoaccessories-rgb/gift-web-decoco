import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('Missing Supabase environment variables')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, supabaseKey)

async function main() {
  const { data, error } = await supabase
    .from('site_content')
    .upsert({
      key: 'footer_bct_visible',
      value: 'true',
      section: 'footer',
      type: 'text',
      label: 'Hiển thị logo Bộ Công Thương (true/false)'
    }, { onConflict: 'key' })

  if (error) {
    console.error('Error inserting BCT visibility:', error)
  } else {
    console.log('Successfully inserted/updated BCT visibility key.')
  }
}

main()
