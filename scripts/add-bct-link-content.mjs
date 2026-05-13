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
      key: 'footer_bct_link',
      value: 'https://online.gov.vn',
      section: 'footer',
      type: 'text',
      label: 'Link thông báo Bộ Công Thương'
    }, { onConflict: 'key' })

  if (error) {
    console.error('Error inserting BCT link:', error)
  } else {
    console.log('Successfully inserted/updated BCT link key.')
  }
}

main()
